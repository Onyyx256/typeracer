import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { roomMembers, rooms } from "@/db/schema";
import { socketOpened } from "@/lib/realtime/presence";
import { createTestAccount, createTestGuest, deleteTestUsers, uniqueName } from "@/test/db";
import { installFakeIo, resetRealtime } from "@/test/realtime";
import { ROOM_CODE_PATTERN } from "./code";
import {
  createRoom,
  findCurrentRoom,
  getRoom,
  isBanned,
  joinRoom,
  kickMember,
  leaveRoom,
} from "./rooms";
import {
  defaultRoomSettings,
  type HostRole,
  type RoomSettings,
  type RoomState,
} from "./settings";

// Runs against the typeracer_test database (see test/setup.ts).

afterEach(resetRealtime);
afterAll(deleteTestUsers);

const settings: RoomSettings = { ...defaultRoomSettings("en"), capacity: 2 };

/** A signed-in user hosting a new room; returns its code. */
async function hostRoom(
  changes: Partial<RoomSettings> = {},
): Promise<{ hostId: string; hostName: string; code: string }> {
  const host = await createTestAccount();
  const hostName = uniqueName("h");
  const result = await createRoom(host.id, { ...settings, ...changes }, false, hostName);
  if (!result.ok) {
    throw new Error(`createRoom failed: ${result.error}`);
  }
  return { hostId: host.id, hostName, code: result.code };
}

/** A new guest joining the room; returns their id and the result. */
async function guestJoins(code: string, role: HostRole = "participant", name = uniqueName("g")) {
  const guest = await createTestGuest(name);
  const result = await joinRoom(guest.id, code, role, false, name);
  return { userId: guest.id, name, result };
}

/** A new signed-in user joining the room; returns their id and the result. */
async function accountJoins(code: string, role: HostRole = "participant", name = uniqueName("a")) {
  const account = await createTestAccount();
  const result = await joinRoom(account.id, code, role, false, name);
  return { userId: account.id, name, result };
}

async function setState(code: string, state: RoomState): Promise<void> {
  await getDb().update(rooms).set({ state }).where(eq(rooms.code, code));
}

async function membersOf(code: string) {
  return (await getRoom(code))?.members ?? [];
}

describe("createRoom (SALLE-01)", () => {
  test("the creator becomes host and first member, under the chosen name", async () => {
    const { hostId, hostName, code } = await hostRoom();
    expect(code).toMatch(ROOM_CODE_PATTERN);

    const room = await getRoom(code);
    expect(room?.state).toBe("waiting");
    expect(room?.hostId).toBe(hostId);
    expect(room?.members).toEqual([
      { userId: hostId, displayName: hostName, role: "participant", isHost: true, isGuest: false },
    ]);
  });

  test("the host can watch as a spectator", async () => {
    const { code } = await hostRoom({ hostRole: "spectator" });
    expect((await membersOf(code))[0].role).toBe("spectator");
  });

  test("the race settings are stored without the column fields", async () => {
    const { code } = await hostRoom({ length: 80, complexity: "hard" });
    const room = await getRoom(code);
    expect(room?.config.length).toBe(80);
    expect(room?.config.complexity).toBe("hard");
    expect(room?.config).not.toHaveProperty("capacity");
  });
});

describe("joinRoom", () => {
  test("joins a public room as a runner, after the host", async () => {
    const { hostId, code } = await hostRoom();
    const { userId, name, result } = await guestJoins(code);
    expect(result).toEqual({ ok: true, code });

    const members = await membersOf(code);
    expect(members.map((member) => member.userId)).toEqual([hostId, userId]);
    expect(members[1]).toMatchObject({ displayName: name, isHost: false, isGuest: true });
  });

  test("joining the same room twice changes nothing", async () => {
    const { code } = await hostRoom();
    const { userId, name } = await guestJoins(code);
    expect(await joinRoom(userId, code, "participant", false, name)).toEqual({ ok: true, code });
    expect(await membersOf(code)).toHaveLength(2);
  });

  test("an unknown code is not found", async () => {
    const { result } = await guestJoins("ZZZZZZ");
    expect(result).toEqual({ ok: false, error: "notFound" });
  });

  test("a closed room is not found", async () => {
    const { code } = await hostRoom();
    await setState(code, "closed");
    expect((await guestJoins(code)).result).toEqual({ ok: false, error: "notFound" });
  });

  test("code-only and private rooms answer not found for now", async () => {
    for (const visibility of ["code", "private"] as const) {
      const { code } = await hostRoom({ visibility });
      expect((await guestJoins(code)).result).toEqual({ ok: false, error: "notFound" });
    }
  });
});

describe("capacity (SALLE-05)", () => {
  test("a full room refuses runners", async () => {
    const { code } = await hostRoom({ capacity: 2 });
    expect((await guestJoins(code)).result.ok).toBe(true);
    expect((await guestJoins(code)).result).toEqual({ ok: false, error: "full" });
  });

  test("a full room still lets spectators in", async () => {
    const { code } = await hostRoom({ capacity: 2 });
    await guestJoins(code);
    expect((await guestJoins(code, "spectator")).result).toEqual({ ok: true, code });
    expect((await guestJoins(code, "spectator")).result).toEqual({ ok: true, code });
    expect(await membersOf(code)).toHaveLength(4);
  });

  test("a spectator host doesn't take a seat", async () => {
    const { code } = await hostRoom({ capacity: 2, hostRole: "spectator" });
    expect((await guestJoins(code)).result.ok).toBe(true);
    expect((await guestJoins(code)).result.ok).toBe(true);
    expect((await guestJoins(code)).result).toEqual({ ok: false, error: "full" });
  });
});

describe("joining between races only (SALLE-09)", () => {
  test("no joining during the countdown or the race, even as a spectator", async () => {
    const { code } = await hostRoom();
    for (const state of ["countdown", "racing"] as const) {
      await setState(code, state);
      expect((await guestJoins(code)).result).toEqual({ ok: false, error: "notJoinable" });
      expect((await guestJoins(code, "spectator")).result).toEqual({
        ok: false,
        error: "notJoinable",
      });
    }
  });

  test("joining is open again on the results screen", async () => {
    const { code } = await hostRoom();
    await setState(code, "results");
    expect((await guestJoins(code)).result).toEqual({ ok: true, code });
  });

  test("a member already in the room is not turned away during the race", async () => {
    const { code } = await hostRoom();
    const { userId, name } = await guestJoins(code);
    await setState(code, "racing");
    expect(await joinRoom(userId, code, "participant", false, name)).toEqual({ ok: true, code });
  });
});

describe("names within a room", () => {
  test("a name already used in the room is refused, whatever its case", async () => {
    const { code, hostName } = await hostRoom({ capacity: 5 });
    for (const name of [hostName, hostName.toUpperCase()]) {
      expect((await guestJoins(code, "participant", name)).result).toEqual({
        ok: false,
        error: "nameTaken",
      });
    }
    expect(await membersOf(code)).toHaveLength(1);
  });

  test("the same name is fine in another room", async () => {
    const first = await hostRoom();
    const second = await hostRoom();
    const name = uniqueName("n");
    expect((await guestJoins(first.code, "participant", name)).result.ok).toBe(true);
    expect((await guestJoins(second.code, "participant", name)).result.ok).toBe(true);
  });

  test("a name frees up when its owner leaves", async () => {
    const { code } = await hostRoom({ capacity: 5 });
    const { userId, name } = await guestJoins(code);
    await leaveRoom(userId);
    expect((await guestJoins(code, "participant", name)).result.ok).toBe(true);
  });
});

describe("one room per person (SALLE-06)", () => {
  test("joining another room is refused, with the current room's code", async () => {
    const first = await hostRoom();
    const second = await hostRoom();
    const { userId, name } = await guestJoins(first.code);
    expect(await joinRoom(userId, second.code, "participant", false, name)).toEqual({
      ok: false,
      error: "alreadyInRoom",
      currentCode: first.code,
    });
    expect((await findCurrentRoom(userId))?.code).toBe(first.code);
  });

  test("creating a room while in one is refused", async () => {
    const first = await hostRoom();
    expect(await createRoom(first.hostId, settings, false, uniqueName("h"))).toEqual({
      ok: false,
      error: "alreadyInRoom",
      currentCode: first.code,
    });
  });

  test("leave and join moves the user to the new room", async () => {
    const first = await hostRoom({ capacity: 5 });
    const second = await hostRoom();
    const { userId, name } = await guestJoins(first.code);
    expect(await joinRoom(userId, second.code, "participant", true, name)).toEqual({
      ok: true,
      code: second.code,
    });
    expect((await findCurrentRoom(userId))?.code).toBe(second.code);
    expect((await membersOf(first.code)).some((member) => member.userId === userId)).toBe(false);
  });

  test("leave and create moves the host to the new room", async () => {
    const first = await hostRoom();
    const result = await createRoom(first.hostId, settings, true, uniqueName("h"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((await findCurrentRoom(first.hostId))?.code).toBe(result.code);
    }
    // They were alone, so the old room closed.
    expect(await getRoom(first.code)).toBeNull();
  });

  test("the database refuses a second membership whatever the code does", async () => {
    const first = await hostRoom();
    const second = await hostRoom();
    const [room] = await getDb()
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.code, second.code));
    const insert = getDb()
      .insert(roomMembers)
      .values({ roomId: room.id, userId: first.hostId, role: "participant", name: "dup" });
    // Drizzle queries are thenables, not promises, so `rejects` needs a real one.
    await expect(Promise.resolve(insert)).rejects.toThrow();
  });
});

describe("leaveRoom (SALLE-08)", () => {
  test("the signed-in member who has been there longest becomes host", async () => {
    const { hostId, code } = await hostRoom({ capacity: 5 });
    const second = await accountJoins(code);
    const third = await accountJoins(code);
    await leaveRoom(hostId);

    const room = await getRoom(code);
    expect(room?.hostId).toBe(second.userId);
    expect(room?.members.map((member) => [member.userId, member.isHost])).toEqual([
      [second.userId, true],
      [third.userId, false],
    ]);
    expect(await findCurrentRoom(hostId)).toBeNull();
  });

  test("a guest never becomes host, even after being there longest", async () => {
    const { hostId, code } = await hostRoom({ capacity: 5 });
    const guest = await guestJoins(code);
    const account = await accountJoins(code);
    await leaveRoom(hostId);

    const room = await getRoom(code);
    expect(room?.hostId).toBe(account.userId);
    expect(room?.members.find((member) => member.userId === guest.userId)?.isHost).toBe(false);
  });

  test("with only guests left, the room closes and tells them", async () => {
    const emitted = installFakeIo();
    const { hostId, code } = await hostRoom({ capacity: 5 });
    const first = await guestJoins(code);
    const second = await guestJoins(code);
    socketOpened(first.userId);
    socketOpened(second.userId);
    await leaveRoom(hostId);

    expect(await getRoom(code)).toBeNull();
    expect(await findCurrentRoom(first.userId)).toBeNull();
    expect(await findCurrentRoom(second.userId)).toBeNull();
    const closed = emitted.filter((entry) => entry.event === "room:closed");
    expect(closed.map((entry) => entry.target).sort()).toEqual(
      [`user:${first.userId}`, `user:${second.userId}`].sort(),
    );
    expect(closed.every((entry) => (entry.payload as { code: string }).code === code)).toBe(true);
  });

  test("a member other than the host leaving keeps the host", async () => {
    const { hostId, code } = await hostRoom({ capacity: 5 });
    const second = await guestJoins(code);
    await leaveRoom(second.userId);
    expect((await getRoom(code))?.hostId).toBe(hostId);
    expect(await membersOf(code)).toHaveLength(1);
  });

  test("the room closes when the last member leaves", async () => {
    const { hostId, code } = await hostRoom();
    await leaveRoom(hostId);
    expect(await getRoom(code)).toBeNull();

    const [row] = await getDb()
      .select({ state: rooms.state, closedAt: rooms.closedAt })
      .from(rooms)
      .where(eq(rooms.code, code));
    expect(row.state).toBe("closed");
    expect(row.closedAt).toBeInstanceOf(Date);
  });

  test("the role skips members who are disconnected", async () => {
    installFakeIo();
    const { hostId, code } = await hostRoom({ capacity: 5 });
    const gone = await accountJoins(code);
    const here = await accountJoins(code);
    socketOpened(here.userId);
    await leaveRoom(hostId);
    const room = await getRoom(code);
    expect(room?.hostId).toBe(here.userId);
    // Still a member: only the grace period's end takes them out.
    expect(room?.members.some((member) => member.userId === gone.userId)).toBe(true);
  });

  test("with nobody connected left, the room closes and releases everyone", async () => {
    installFakeIo();
    const { hostId, code } = await hostRoom({ capacity: 5 });
    const gone = await accountJoins(code);
    await leaveRoom(hostId);
    expect(await getRoom(code)).toBeNull();
    // Free to join or create another room (SALLE-06).
    expect(await findCurrentRoom(gone.userId)).toBeNull();
  });

  test("an open room doesn't notify anyone that it closed", async () => {
    const emitted = installFakeIo();
    const { hostId, code } = await hostRoom({ capacity: 5 });
    const account = await accountJoins(code);
    socketOpened(account.userId);
    await leaveRoom(hostId);
    expect(emitted.some((entry) => entry.event === "room:closed")).toBe(false);
  });

  test("leaving when in no room does nothing", async () => {
    const guest = await createTestGuest();
    await expect(leaveRoom(guest.id)).resolves.toBeUndefined();
  });
});

describe("kickMember (SALLE-07)", () => {
  test("the host removes a runner, who can't join again", async () => {
    const { hostId, code } = await hostRoom({ capacity: 5 });
    const runner = await guestJoins(code);
    expect(await kickMember(hostId, runner.userId)).toEqual({ ok: true });

    expect((await membersOf(code)).map((member) => member.userId)).toEqual([hostId]);
    expect(await findCurrentRoom(runner.userId)).toBeNull();
    expect(await isBanned(runner.userId, code)).toBe(true);
    // Neither as a runner nor as a spectator, under any name.
    expect(await joinRoom(runner.userId, code, "participant", false, runner.name)).toEqual({
      ok: false,
      error: "banned",
    });
    expect(await joinRoom(runner.userId, code, "spectator", false, uniqueName("g"))).toEqual({
      ok: false,
      error: "banned",
    });
  });

  test("the host removes a spectator", async () => {
    const { hostId, code } = await hostRoom();
    const spectator = await guestJoins(code, "spectator");
    expect(await kickMember(hostId, spectator.userId)).toEqual({ ok: true });
    expect(await membersOf(code)).toHaveLength(1);
  });

  test("works during a race too", async () => {
    const { hostId, code } = await hostRoom();
    const runner = await guestJoins(code);
    await setState(code, "racing");
    expect(await kickMember(hostId, runner.userId)).toEqual({ ok: true });
  });

  test("the ban only covers that room", async () => {
    const { hostId, code } = await hostRoom();
    const runner = await guestJoins(code);
    await kickMember(hostId, runner.userId);
    const other = await hostRoom();
    const result = await joinRoom(runner.userId, other.code, "participant", false, runner.name);
    expect(result).toEqual({ ok: true, code: other.code });
  });

  test("a member who isn't the host can't kick anyone (SEC-01)", async () => {
    const { hostId, code } = await hostRoom({ capacity: 5 });
    const first = await guestJoins(code);
    const second = await guestJoins(code);
    expect(await kickMember(first.userId, second.userId)).toEqual({
      ok: false,
      error: "notHost",
    });
    expect(await kickMember(first.userId, hostId)).toEqual({ ok: false, error: "notHost" });
    expect(await membersOf(code)).toHaveLength(3);
  });

  test("the host can't kick someone from another room, or themself", async () => {
    const { hostId, code } = await hostRoom();
    const other = await hostRoom();
    const elsewhere = await guestJoins(other.code);
    expect(await kickMember(hostId, elsewhere.userId)).toEqual({
      ok: false,
      error: "notMember",
    });
    expect(await kickMember(hostId, hostId)).toEqual({ ok: false, error: "notMember" });
    expect(await membersOf(code)).toHaveLength(1);
    expect(await membersOf(other.code)).toHaveLength(2);
  });

  test("a former host loses the right to kick", async () => {
    const { hostId, code } = await hostRoom({ capacity: 5 });
    const next = await accountJoins(code);
    const runner = await guestJoins(code);
    await leaveRoom(hostId);
    expect(await kickMember(hostId, runner.userId)).toEqual({ ok: false, error: "notHost" });
    expect(await kickMember(next.userId, runner.userId)).toEqual({ ok: true });
  });
});
