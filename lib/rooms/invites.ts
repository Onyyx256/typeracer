import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, count, eq, ne } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { roomInvites, roomMembers, rooms, users } from "@/db/schema";

const TOKEN_BYTES = 32;
export const MAX_INVITES_PER_ROOM = 50;

/** Same rule as the room_invites_token_format check in the database. */
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export function generateInviteToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export type CreateInviteError = "notHost" | "notPrivate" | "tooMany";

export type CreateInviteResult =
  | { ok: true; token: string }
  | { ok: false; error: CreateInviteError };

/** Only the host of an open private room makes links (SEC-01). */
export async function createInvite(hostId: string): Promise<CreateInviteResult> {
  return getDb().transaction(async (tx): Promise<CreateInviteResult> => {
    const [membership] = await tx
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .where(eq(roomMembers.userId, hostId));
    if (!membership) {
      return { ok: false, error: "notHost" };
    }
    // Locked like the other host actions, so the role can't move away meanwhile.
    const [room] = await tx
      .select({ id: rooms.id, hostId: rooms.hostId, state: rooms.state, visibility: rooms.visibility })
      .from(rooms)
      .where(eq(rooms.id, membership.roomId))
      .for("update");
    if (!room || room.hostId !== hostId || room.state === "closed") {
      return { ok: false, error: "notHost" };
    }
    if (room.visibility !== "private") {
      return { ok: false, error: "notPrivate" };
    }
    const [{ value: existing } = { value: 0 }] = await tx
      .select({ value: count() })
      .from(roomInvites)
      .where(eq(roomInvites.roomId, room.id));
    if (existing >= MAX_INVITES_PER_ROOM) {
      return { ok: false, error: "tooMany" };
    }
    const token = generateInviteToken();
    await tx.insert(roomInvites).values({ roomId: room.id, token });
    return { ok: true, token };
  });
}

export type InviteStatus = "pending" | "accepted" | "revoked";

export type InviteView = {
  token: string;
  status: InviteStatus;
  /** Who accepted it: their name in the room, or their display name once they left. */
  name: string | null;
  createdAt: Date;
};

/** Empty for anyone but the host. */
export async function listInvites(hostId: string, code: string): Promise<InviteView[]> {
  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.code, code), eq(rooms.hostId, hostId), ne(rooms.state, "closed")));
  if (!room) {
    return [];
  }
  const rows = await db
    .select({
      token: roomInvites.token,
      usedAt: roomInvites.usedAt,
      revokedAt: roomInvites.revokedAt,
      memberName: roomMembers.name,
      displayName: users.displayName,
      createdAt: roomInvites.createdAt,
    })
    .from(roomInvites)
    .leftJoin(users, eq(users.id, roomInvites.usedBy))
    .leftJoin(
      roomMembers,
      and(eq(roomMembers.userId, roomInvites.usedBy), eq(roomMembers.roomId, room.id)),
    )
    .where(eq(roomInvites.roomId, room.id))
    .orderBy(asc(roomInvites.createdAt), asc(roomInvites.id));

  return rows.map((row) => ({
    token: row.token,
    status: row.revokedAt ? "revoked" : row.usedAt ? "accepted" : "pending",
    name: row.memberName ?? row.displayName,
    createdAt: row.createdAt,
  }));
}

export type InviteLookup =
  | { ok: true; code: string }
  | { ok: false; error: "inviteInvalid" | "inviteUsed" };

/**
 * What opening the link would do, without using it up. joinRoom checks again
 * under a lock; this only lets the page and the action answer early.
 */
export async function lookUpInvite(
  token: string,
  userId: string | null,
  ip: string,
): Promise<InviteLookup> {
  const [row] = await getDb()
    .select({
      code: rooms.code,
      state: rooms.state,
      usedBy: roomInvites.usedBy,
      usedIp: roomInvites.usedIp,
      usedAt: roomInvites.usedAt,
      revokedAt: roomInvites.revokedAt,
    })
    .from(roomInvites)
    .innerJoin(rooms, eq(rooms.id, roomInvites.roomId))
    .where(eq(roomInvites.token, token));
  if (!row || row.revokedAt || row.state === "closed") {
    return { ok: false, error: "inviteInvalid" };
  }
  if (row.usedAt && (row.usedBy === null || row.usedBy !== userId || row.usedIp !== ip)) {
    return { ok: false, error: "inviteUsed" };
  }
  return { ok: true, code: row.code };
}
