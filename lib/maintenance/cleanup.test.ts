import { afterAll, describe, expect, test } from "bun:test";
import { randomInt } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { raceResults, races, roomMembers, rooms, users } from "@/db/schema";
import { createTestAccount, createTestGuest, deleteTestUsers } from "@/test/db";
import { CLOSED_ROOM_LIFETIME_MS, GUEST_LIFETIME_MS, deleteExpiredData } from "./cleanup";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const raceIds: string[] = [];

afterAll(async () => {
  if (raceIds.length > 0) {
    await getDb().delete(races).where(inArray(races.id, raceIds));
  }
  await deleteTestUsers();
});

function ago(ms: number): Date {
  return new Date(Date.now() - ms);
}

async function backdateUser(id: string, createdAt: Date) {
  await getDb().update(users).set({ createdAt }).where(eq(users.id, id));
}

async function addRoom(hostId: string, closedAt: Date | null) {
  const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  const [room] = await getDb()
    .insert(rooms)
    .values({
      code,
      hostId,
      visibility: "public",
      capacity: 2,
      state: closedAt ? "closed" : "waiting",
      config: {} as never,
      closedAt,
    })
    .returning({ id: rooms.id });
  return room.id;
}

async function exists(table: typeof users | typeof rooms, id: string) {
  const rows = await getDb().select({ id: table.id }).from(table).where(eq(table.id, id));
  return rows.length === 1;
}

describe("deleteExpiredData", () => {
  test("deletes guests whose session has expired and keeps the others", async () => {
    const expired = await createTestGuest();
    const fresh = await createTestGuest();
    const oldAccount = await createTestAccount();
    await backdateUser(expired.id, ago(GUEST_LIFETIME_MS + 60_000));
    await backdateUser(oldAccount.id, ago(GUEST_LIFETIME_MS * 3));

    await deleteExpiredData();

    expect(await exists(users, expired.id)).toBe(false);
    expect(await exists(users, fresh.id)).toBe(true);
    expect(await exists(users, oldAccount.id)).toBe(true);
  });

  test("keeps an expired guest who is still in a room", async () => {
    const guest = await createTestGuest();
    await backdateUser(guest.id, ago(GUEST_LIFETIME_MS + 60_000));
    const roomId = await addRoom(guest.id, null);
    await getDb()
      .insert(roomMembers)
      .values({ roomId, userId: guest.id, role: "participant", name: "guest" });

    await deleteExpiredData();

    expect(await exists(users, guest.id)).toBe(true);
    expect(await exists(rooms, roomId)).toBe(true);
  });

  test("keeps the race results of a deleted guest", async () => {
    const guest = await createTestGuest();
    await backdateUser(guest.id, ago(GUEST_LIFETIME_MS + 60_000));
    const now = new Date();
    const [race] = await getDb()
      .insert(races)
      .values({ content: "test", config: {} as never, startedAt: now, endedAt: now })
      .returning({ id: races.id });
    raceIds.push(race.id);
    await getDb().insert(raceResults).values({
      raceId: race.id,
      guestId: guest.id,
      name: "guest",
      isGuest: true,
      rank: 1,
      status: "finished",
      wpm: 50,
      rawWpm: 50,
      accuracy: 100,
      errors: 0,
      progress: 1,
      durationMs: 1000,
      wpmSeries: [],
      missedKeys: {},
    });

    await deleteExpiredData();

    const results = await getDb().select().from(raceResults).where(eq(raceResults.raceId, race.id));
    expect(results).toHaveLength(1);
    expect(results[0].guestId).toBeNull();
  });

  test("deletes rooms closed long ago and keeps recent and open ones", async () => {
    const host = await createTestAccount();
    const old = await addRoom(host.id, ago(CLOSED_ROOM_LIFETIME_MS + 60_000));
    const recent = await addRoom(host.id, ago(60_000));
    const open = await addRoom(host.id, null);

    await deleteExpiredData();

    expect(await exists(rooms, old)).toBe(false);
    expect(await exists(rooms, recent)).toBe(true);
    expect(await exists(rooms, open)).toBe(true);
  });
});
