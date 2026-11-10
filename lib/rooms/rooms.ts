import "server-only";
import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { roomBans, roomMembers, rooms, users } from "@/db/schema";
import { abandonRace, closeRace } from "@/lib/race/manager";
import { notifyKicked, notifyRoomChanged, notifyRoomClosed } from "@/lib/realtime/notify";
import { isConnected } from "@/lib/realtime/presence";
import { generateRoomCode } from "./code";
import type { RoomFilters } from "./filters";
import {
  JOINABLE_STATES,
  raceConfigSchema,
  type HostRole,
  type EditableSettings,
  type RaceConfig,
  type RoomSettings,
  type RoomState,
  type Visibility,
} from "./settings";

type Database = ReturnType<typeof getDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type RoomError =
  | "alreadyInRoom"
  | "notFound"
  | "notJoinable"
  | "full"
  | "nameTaken"
  | "banned";

export type RoomResult =
  | { ok: true; code: string }
  | { ok: false; error: RoomError; currentCode?: string };

const CODE_ATTEMPTS = 5;

function isUniqueViolation(error: unknown, index: string): boolean {
  const cause = error instanceof Error ? (error.cause ?? error) : error;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    cause.constraint === index
  );
}

export async function findCurrentRoom(
  userId: string,
): Promise<{ roomId: string; code: string } | null> {
  const [found] = await getDb()
    .select({ roomId: rooms.id, code: rooms.code })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .where(eq(roomMembers.userId, userId))
    .limit(1);
  return found ?? null;
}

type RemainingMember = { userId: string; isGuest: boolean };

function planLeave(
  wasHost: boolean,
  remaining: RemainingMember[],
): { closes: boolean; next: RemainingMember | undefined } {
  const connected = remaining.filter((member) => isConnected(member.userId));
  const next = wasHost ? connected.find((member) => !member.isGuest) : undefined;
  return { closes: connected.length === 0 || (wasHost && !next), next };
}

export async function leaveClosesRoom(userId: string): Promise<boolean> {
  const current = await findCurrentRoom(userId);
  if (!current) {
    return false;
  }
  const db = getDb();
  const [room] = await db
    .select({ hostId: rooms.hostId })
    .from(rooms)
    .where(eq(rooms.id, current.roomId));
  const others = await db
    .select({ userId: roomMembers.userId, isGuest: users.isGuest })
    .from(roomMembers)
    .innerJoin(users, eq(users.id, roomMembers.userId))
    .where(and(eq(roomMembers.roomId, current.roomId), ne(roomMembers.userId, userId)))
    .orderBy(asc(roomMembers.joinedAt));
  return planLeave(room?.hostId === userId, others).closes;
}

/**
 * If the host leaves, the connected account that has been there longest
 * takes over; a guest never does. With nobody to take over, or nobody
 * connected left, the room closes and releases the others.
 */
export async function leaveRoom(userId: string): Promise<void> {
  const result = await getDb().transaction(async (tx) => {
    const [membership] = await tx
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .where(eq(roomMembers.userId, userId));
    if (!membership) {
      return null;
    }
    // Locked so two people leaving at once can't both skip the handover.
    const [room] = await tx
      .select({ id: rooms.id, code: rooms.code, hostId: rooms.hostId })
      .from(rooms)
      .where(eq(rooms.id, membership.roomId))
      .for("update");
    const deleted = await tx
      .delete(roomMembers)
      .where(eq(roomMembers.userId, userId))
      .returning({ id: roomMembers.id });
    if (!room || deleted.length === 0) {
      return null;
    }

    const remaining = await tx
      .select({ userId: roomMembers.userId, isGuest: users.isGuest })
      .from(roomMembers)
      .innerJoin(users, eq(users.id, roomMembers.userId))
      .where(eq(roomMembers.roomId, room.id))
      .orderBy(asc(roomMembers.joinedAt));
    const wasHost = room.hostId === userId;
    const { closes, next } = planLeave(wasHost, remaining);

    if (closes) {
      await tx.delete(roomMembers).where(eq(roomMembers.roomId, room.id));
      await tx
        .update(rooms)
        .set({ state: "closed", closedAt: new Date() })
        .where(eq(rooms.id, room.id));
      return {
        code: room.code,
        released: remaining.map((member) => member.userId),
        closed: true,
      };
    }
    if (next) {
      await tx.update(rooms).set({ hostId: next.userId }).where(eq(rooms.id, room.id));
    }
    return { code: room.code, released: [], closed: false };
  });
  if (result) {
    abandonRace(userId);
    if (result.closed) {
      void closeRace(result.code);
    }
    // Before the room-wide notice, so released pages show why instead of a 404.
    notifyRoomClosed(result.released, result.code);
    notifyRoomChanged(result.code);
  }
}

/** Every user in a room, to check after a restart who never came back. */
export async function listRoomMemberIds(): Promise<string[]> {
  const rows = await getDb().select({ userId: roomMembers.userId }).from(roomMembers);
  return rows.map((row) => row.userId);
}

export async function canWatchRoom(userId: string | null, code: string): Promise<boolean> {
  const [room] = await getDb()
    .select({ id: rooms.id, visibility: rooms.visibility })
    .from(rooms)
    .where(and(eq(rooms.code, code), ne(rooms.state, "closed")));
  if (!room) {
    return false;
  }
  if (room.visibility === "public") {
    return true;
  }
  if (!userId) {
    return false;
  }
  const [member] = await getDb()
    .select({ id: roomMembers.id })
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, userId)));
  return member !== undefined;
}

async function checkCurrentRoom(
  userId: string,
  leaveCurrent: boolean,
  joining?: string,
): Promise<RoomResult | null> {
  const current = await findCurrentRoom(userId);
  if (!current || current.code === joining) {
    return null;
  }
  if (!leaveCurrent) {
    return { ok: false, error: "alreadyInRoom", currentCode: current.code };
  }
  await leaveRoom(userId);
  return null;
}

export async function createRoom(
  userId: string,
  settings: RoomSettings,
  leaveCurrent: boolean,
  name: string,
): Promise<RoomResult> {
  const blocked = await checkCurrentRoom(userId, leaveCurrent);
  if (blocked) {
    return blocked;
  }
  const { hostRole, visibility, capacity, ...rest } = settings;
  const config: RaceConfig = raceConfigSchema.parse(rest);

  try {
    const result = await getDb().transaction(async (tx) => {
      const room = await insertRoom(tx, { userId, visibility, capacity, config });
      await tx
        .insert(roomMembers)
        .values({ roomId: room.id, userId, role: hostRole, name });
      return { ok: true as const, code: room.code };
    });
    notifyRoomChanged(result.code);
    return result;
  } catch (error) {
    // Another tab put the user in a room in the meantime.
    if (isUniqueViolation(error, "room_members_user_idx")) {
      const current = await findCurrentRoom(userId);
      return { ok: false, error: "alreadyInRoom", currentCode: current?.code };
    }
    throw error;
  }
}

async function insertRoom(
  tx: Transaction,
  values: { userId: string; visibility: Visibility; capacity: number; config: RaceConfig },
): Promise<{ id: string; code: string }> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const [room] = await tx
      .insert(rooms)
      .values({
        code: generateRoomCode(),
        hostId: values.userId,
        visibility: values.visibility,
        capacity: values.capacity,
        config: values.config,
      })
      .onConflictDoNothing({ target: rooms.code })
      .returning({ id: rooms.id, code: rooms.code });
    if (room) {
      return room;
    }
  }
  throw new Error("Could not find a free room code.");
}

/**
 * Only public rooms for now: code and private rooms answer "not found" so a
 * code reveals nothing.
 */
export async function joinRoom(
  userId: string,
  code: string,
  role: HostRole,
  leaveCurrent: boolean,
  name: string,
): Promise<RoomResult> {
  const blocked = await checkCurrentRoom(userId, leaveCurrent, code);
  if (blocked) {
    return blocked;
  }

  try {
    const result = await getDb().transaction(async (tx): Promise<RoomResult> => {
      // Locked so two people can't both take the last seat.
      const [room] = await tx
        .select({
          id: rooms.id,
          visibility: rooms.visibility,
          capacity: rooms.capacity,
          state: rooms.state,
        })
        .from(rooms)
        .where(eq(rooms.code, code))
        .for("update");
      if (!room || room.state === "closed" || room.visibility !== "public") {
        return { ok: false, error: "notFound" };
      }
      if (await isBannedFrom(tx, room.id, userId)) {
        return { ok: false, error: "banned" };
      }

      const [already] = await tx
        .select({ id: roomMembers.id })
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, userId)));
      // A second tab or a double click: nothing to do.
      if (already) {
        return { ok: true, code };
      }
      if (!JOINABLE_STATES.includes(room.state)) {
        return { ok: false, error: "notJoinable" };
      }
      if (role === "participant") {
        const [{ value: participants } = { value: 0 }] = await tx
          .select({ value: count() })
          .from(roomMembers)
          .where(
            and(eq(roomMembers.roomId, room.id), eq(roomMembers.role, "participant")),
          );
        if (participants >= room.capacity) {
          return { ok: false, error: "full" };
        }
      }
      // A name already used in the room is refused by room_members_room_name_idx.
      await tx.insert(roomMembers).values({ roomId: room.id, userId, role, name });
      return { ok: true, code };
    });
    if (result.ok) {
      notifyRoomChanged(code);
    }
    return result;
  } catch (error) {
    if (isUniqueViolation(error, "room_members_user_idx")) {
      const current = await findCurrentRoom(userId);
      return { ok: false, error: "alreadyInRoom", currentCode: current?.code };
    }
    if (isUniqueViolation(error, "room_members_room_name_idx")) {
      return { ok: false, error: "nameTaken" };
    }
    throw error;
  }
}

async function isBannedFrom(db: Database | Transaction, roomId: string, userId: string) {
  const [ban] = await db
    .select({ id: roomBans.id })
    .from(roomBans)
    .where(and(eq(roomBans.roomId, roomId), eq(roomBans.userId, userId)));
  return ban !== undefined;
}

export async function isBanned(userId: string, code: string): Promise<boolean> {
  const db = getDb();
  const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, code));
  return room ? isBannedFrom(db, room.id, userId) : false;
}

export type KickError =
  | "notHost"
  | "notMember";

export type KickResult = { ok: true } | { ok: false; error: KickError };

export async function kickMember(hostId: string, targetId: string): Promise<KickResult> {
  if (hostId === targetId) {
    return { ok: false, error: "notMember" };
  }
  const result = await getDb().transaction(
    async (tx): Promise<KickResult & { code?: string }> => {
      const [membership] = await tx
        .select({ roomId: roomMembers.roomId })
        .from(roomMembers)
        .where(eq(roomMembers.userId, hostId));
      if (!membership) {
        return { ok: false, error: "notHost" };
      }
      // Locked like leaveRoom, so the host role can't move away mid-kick.
      const [room] = await tx
        .select({ id: rooms.id, code: rooms.code, hostId: rooms.hostId, state: rooms.state })
        .from(rooms)
        .where(eq(rooms.id, membership.roomId))
        .for("update");
      if (!room || room.hostId !== hostId || room.state === "closed") {
        return { ok: false, error: "notHost" };
      }
      const deleted = await tx
        .delete(roomMembers)
        .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, targetId)))
        .returning({ id: roomMembers.id });
      if (deleted.length === 0) {
        return { ok: false, error: "notMember" };
      }
      await tx
        .insert(roomBans)
        .values({ roomId: room.id, userId: targetId })
        .onConflictDoNothing();
      return { ok: true, code: room.code };
    },
  );
  if (!result.ok || !result.code) {
    return result;
  }
  abandonRace(targetId);
  notifyKicked(targetId, result.code);
  notifyRoomChanged(result.code);
  return { ok: true };
}

export type TransferHostError =
  | "notHost"
  | "notMember"
  | "guest";

export type TransferHostResult = { ok: true } | { ok: false; error: TransferHostError };

export async function transferHost(
  hostId: string,
  targetId: string,
): Promise<TransferHostResult> {
  if (hostId === targetId) {
    return { ok: false, error: "notMember" };
  }
  const result = await getDb().transaction(
    async (tx): Promise<TransferHostResult & { code?: string }> => {
      const [membership] = await tx
        .select({ roomId: roomMembers.roomId })
        .from(roomMembers)
        .where(eq(roomMembers.userId, hostId));
      if (!membership) {
        return { ok: false, error: "notHost" };
      }
      // Locked like leaveRoom, so two hand-overs can't cross.
      const [room] = await tx
        .select({ id: rooms.id, code: rooms.code, hostId: rooms.hostId, state: rooms.state })
        .from(rooms)
        .where(eq(rooms.id, membership.roomId))
        .for("update");
      if (!room || room.hostId !== hostId || room.state === "closed") {
        return { ok: false, error: "notHost" };
      }
      const [target] = await tx
        .select({ isGuest: users.isGuest })
        .from(roomMembers)
        .innerJoin(users, eq(users.id, roomMembers.userId))
        .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, targetId)));
      if (!target) {
        return { ok: false, error: "notMember" };
      }
      if (target.isGuest) {
        return { ok: false, error: "guest" };
      }
      await tx.update(rooms).set({ hostId: targetId }).where(eq(rooms.id, room.id));
      return { ok: true, code: room.code };
    },
  );
  if (!result.ok || !result.code) {
    return result;
  }
  notifyRoomChanged(result.code);
  return { ok: true };
}

export type UpdateSettingsError =
  | "notHost"
  | "notBetweenRaces"
  | "belowRunners";

export type UpdateSettingsResult = { ok: true } | { ok: false; error: UpdateSettingsError };

export async function updateRoomSettings(
  hostId: string,
  settings: EditableSettings,
): Promise<UpdateSettingsResult> {
  const { visibility, capacity, ...rest } = settings;
  const config: RaceConfig = raceConfigSchema.parse(rest);

  const result = await getDb().transaction(
    async (tx): Promise<UpdateSettingsResult & { code?: string }> => {
      const [membership] = await tx
        .select({ roomId: roomMembers.roomId })
        .from(roomMembers)
        .where(eq(roomMembers.userId, hostId));
      if (!membership) {
        return { ok: false, error: "notHost" };
      }
      // Locked like startRace and joinRoom, so a race can't start, or a
      // runner take a seat, while the settings change.
      const [room] = await tx
        .select({ id: rooms.id, code: rooms.code, hostId: rooms.hostId, state: rooms.state })
        .from(rooms)
        .where(eq(rooms.id, membership.roomId))
        .for("update");
      if (!room || room.hostId !== hostId || room.state === "closed") {
        return { ok: false, error: "notHost" };
      }
      if (!JOINABLE_STATES.includes(room.state)) {
        return { ok: false, error: "notBetweenRaces" };
      }
      const [{ value: participants } = { value: 0 }] = await tx
        .select({ value: count() })
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.role, "participant")));
      if (capacity < participants) {
        return { ok: false, error: "belowRunners" };
      }
      await tx
        .update(rooms)
        .set({ visibility, capacity, config })
        .where(eq(rooms.id, room.id));
      return { ok: true, code: room.code };
    },
  );
  if (!result.ok || !result.code) {
    return result;
  }
  notifyRoomChanged(result.code);
  return { ok: true };
}

export type RoomMemberView = {
  userId: string;
  displayName: string;
  role: HostRole;
  isHost: boolean;
  /** Shown with a badge, so a guest can't pass for an account of the same name. */
  isGuest: boolean;
};

export type RoomView = {
  code: string;
  visibility: Visibility;
  capacity: number;
  state: RoomState;
  config: RaceConfig;
  hostId: string;
  members: RoomMemberView[];
};

export async function getRoom(code: string): Promise<RoomView | null> {
  const db = getDb();
  const [room] = await db
    .select({
      id: rooms.id,
      code: rooms.code,
      visibility: rooms.visibility,
      capacity: rooms.capacity,
      state: rooms.state,
      config: rooms.config,
      hostId: rooms.hostId,
    })
    .from(rooms)
    .where(and(eq(rooms.code, code), ne(rooms.state, "closed")));
  if (!room) {
    return null;
  }

  const members = await db
    .select({
      userId: roomMembers.userId,
      // The name chosen for this room, not the account's display name.
      displayName: roomMembers.name,
      isGuest: users.isGuest,
      role: roomMembers.role,
    })
    .from(roomMembers)
    .innerJoin(users, eq(users.id, roomMembers.userId))
    .where(eq(roomMembers.roomId, room.id))
    .orderBy(asc(roomMembers.joinedAt));

  return {
    code: room.code,
    visibility: room.visibility,
    capacity: room.capacity,
    state: room.state,
    // Parsed rather than trusted, in case the stored shape is from an older version.
    config: raceConfigSchema.parse(room.config),
    hostId: room.hostId,
    members: members.map((member) => ({
      ...member,
      isHost: member.userId === room.hostId,
    })),
  };
}

export type PublicRoomSummary = {
  code: string;
  hostName: string;
  participants: number;
  capacity: number;
  state: RoomState;
  language: RaceConfig["language"];
  complexity: RaceConfig["complexity"];
  textType: RaceConfig["textType"];
};

export async function listPublicRooms(
  filters: RoomFilters = {},
  limit = 50,
): Promise<PublicRoomSummary[]> {
  const participants = sql<number>`count(${roomMembers.id}) filter (where ${roomMembers.role} = 'participant')`.mapWith(Number);
  const rows = await getDb()
    .select({
      code: rooms.code,
      hostName: sql<string>`(select ${roomMembers.name} from ${roomMembers} where ${roomMembers.roomId} = ${rooms.id} and ${roomMembers.userId} = ${rooms.hostId})`,
      participants,
      capacity: rooms.capacity,
      state: rooms.state,
      config: rooms.config,
    })
    .from(rooms)
    .leftJoin(roomMembers, eq(roomMembers.roomId, rooms.id))
    .where(
      and(
        eq(rooms.visibility, "public"),
        ne(rooms.state, "closed"),
        // Validated values, sent as bound parameters.
        filters.lang ? sql`${rooms.config}->>'language' = ${filters.lang}` : undefined,
        filters.complexity
          ? sql`${rooms.config}->>'complexity' = ${filters.complexity}`
          : undefined,
      ),
    )
    .groupBy(rooms.id)
    .orderBy(desc(rooms.createdAt))
    .limit(limit);

  return rows.flatMap(({ config, ...row }) => {
    const parsed = raceConfigSchema.safeParse(config);
    if (!parsed.success) {
      return [];
    }
    const { language, complexity, textType } = parsed.data;
    return [{ ...row, language, complexity, textType }];
  });
}
