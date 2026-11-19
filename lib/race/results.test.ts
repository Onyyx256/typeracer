import { afterAll, describe, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { raceResults, races } from "@/db/schema";
import type { ResultStatus } from "@/lib/race/types";
import { createTestAccount, deleteTestUsers } from "@/test/db";
import { getPersonalBest } from "./results";


const raceIds: string[] = [];

afterAll(async () => {
  if (raceIds.length > 0) {
    await getDb().delete(races).where(inArray(races.id, raceIds));
  }
  await deleteTestUsers();
});

let minutes = 0;

/** Each race ends a minute after the one before, in the order they are added. */
async function addRace(userId: string, wpm: number, status: ResultStatus = "finished"): Promise<string> {
  const db = getDb();
  const endedAt = new Date(Date.UTC(2026, 0, 1) + ++minutes * 60_000);
  const [race] = await db
    .insert(races)
    .values({ content: "test", config: {} as never, startedAt: endedAt, endedAt })
    .returning({ id: races.id });
  raceIds.push(race.id);
  await db.insert(raceResults).values({
    raceId: race.id,
    userId,
    name: "t",
    isGuest: false,
    rank: 1,
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
  return race.id;
}

describe("getPersonalBest", () => {
  test("is never set by a first race: there is no record to beat", async () => {
    const account = await createTestAccount();
    expect(await getPersonalBest(await addRace(account.id, 80), account.id)).toBeNull();
  });

  test("needs a WPM above every earlier finished race", async () => {
    const account = await createTestAccount();
    await addRace(account.id, 50);
    const tie = await addRace(account.id, 50);
    const better = await addRace(account.id, 55);
    const worse = await addRace(account.id, 52);
    expect(await getPersonalBest(tie, account.id)).toBeNull();
    expect(await getPersonalBest(better, account.id)).toEqual({ wpm: 55, previous: 50 });
    expect(await getPersonalBest(worse, account.id)).toBeNull();
  });

  test("still shows on an old race that beat the record back then", async () => {
    const account = await createTestAccount();
    await addRace(account.id, 40);
    const record = await addRace(account.id, 60);
    await addRace(account.id, 90);
    expect(await getPersonalBest(record, account.id)).toEqual({ wpm: 60, previous: 40 });
  });

  test("only counts finished races, like the best WPM in the stats", async () => {
    const account = await createTestAccount();
    await addRace(account.id, 40);
    await addRace(account.id, 120, "timeUp");
    await addRace(account.id, 130, "abandoned");
    expect(await getPersonalBest(await addRace(account.id, 45), account.id)).toEqual({ wpm: 45, previous: 40 });
    expect(await getPersonalBest(await addRace(account.id, 200, "timeUp"), account.id)).toBeNull();
  });

  test("is only the viewer's own", async () => {
    const account = await createTestAccount();
    const stranger = await createTestAccount();
    await addRace(account.id, 40);
    const record = await addRace(account.id, 60);
    expect(await getPersonalBest(record, stranger.id)).toBeNull();
  });
});
