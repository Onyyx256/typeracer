import { afterAll, describe, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { raceResults, races } from "@/db/schema";
import type { ResultStatus } from "@/lib/race/types";
import { createTestAccount, createTestGuest, deleteTestUsers } from "@/test/db";
import {
  getAvatarImage,
  getLooks,
  getPlayerProgress,
  removeAvatar,
  saveAvatar,
  setCosmetics,
} from "./profile";


const raceIds: string[] = [];

afterAll(async () => {
  if (raceIds.length > 0) {
    await getDb().delete(races).where(inArray(races.id, raceIds));
  }
  await deleteTestUsers();
});

async function addResult(userId: string, rank: number, status: ResultStatus, wpm: number) {
  const db = getDb();
  const now = new Date();
  const [race] = await db
    .insert(races)
    .values({ content: "test", config: {} as never, startedAt: now, endedAt: now })
    .returning({ id: races.id });
  raceIds.push(race.id);
  await db.insert(raceResults).values({
    raceId: race.id,
    userId,
    name: "t",
    isGuest: false,
    rank,
    status,
    wpm,
    rawWpm: wpm,
    accuracy: status === "abandoned" ? null : 95,
    errors: 0,
    progress: status === "finished" ? 1 : 0.5,
    durationMs: 1000,
    wpmSeries: [],
    missedKeys: {},
  });
}

describe("getPlayerProgress", () => {
  test("is all zero for someone who never raced", async () => {
    const account = await createTestAccount();
    expect(await getPlayerProgress(account.id)).toEqual({ races: 0, wins: 0, bestWpm: 0 });
  });

  test("counts races and wins, and takes the best finished WPM", async () => {
    const account = await createTestAccount();
    await addResult(account.id, 1, "finished", 52.5);
    await addResult(account.id, 2, "finished", 61);
    await addResult(account.id, 1, "timeUp", 90);
    // First only because everyone gave up: not a win, and its WPM doesn't count.
    await addResult(account.id, 1, "abandoned", 120);
    expect(await getPlayerProgress(account.id)).toEqual({ races: 4, wins: 2, bestWpm: 61 });
  });
});

describe("getLooks", () => {
  test("gives colours and a versioned photo URL to accounts only", async () => {
    const account = await createTestAccount();
    const guest = await createTestGuest();
    await setCosmetics(account.id, { stem: "sky", petal: "poppy" });
    await saveAvatar(account.id, Buffer.from("webp"));

    const looks = await getLooks([account.id, guest.id, account.id]);
    expect(Object.keys(looks)).toEqual([account.id]);
    expect(looks[account.id]?.cosmetics).toEqual({ stem: "sky", petal: "poppy" });
    expect(looks[account.id]?.avatarUrl).toMatch(
      new RegExp(`^/api/avatars/${account.id}\\?v=\\d+$`),
    );
  });

  test("has no photo URL once the photo is removed", async () => {
    const account = await createTestAccount();
    await saveAvatar(account.id, Buffer.from("one"));
    await saveAvatar(account.id, Buffer.from("two"));
    expect((await getAvatarImage(account.id))?.toString()).toBe("two");

    await removeAvatar(account.id);
    expect(await getAvatarImage(account.id)).toBeNull();
    expect((await getLooks([account.id]))[account.id]?.avatarUrl).toBeNull();
  });

  test("never touches a guest's colours", async () => {
    const guest = await createTestGuest();
    await setCosmetics(guest.id, { stem: "gold", petal: "snow" });
    expect(await getLooks([guest.id])).toEqual({});
  });
});
