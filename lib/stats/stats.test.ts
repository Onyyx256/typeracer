import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { raceResults, races, texts } from "@/db/schema";
import type { ResultStatus } from "@/lib/race/types";
import { createTestAccount, deleteTestUsers } from "@/test/db";
import { HISTORY_PAGE_SIZE } from "./series";
import { getHistory, getMissedKeys, getPlaces, getStatsSummary, getWpmProgress } from "./stats";

const raceIds: string[] = [];
const textIds: string[] = [];

afterAll(async () => {
  const db = getDb();
  if (raceIds.length > 0) {
    await db.delete(races).where(inArray(races.id, raceIds));
  }
  if (textIds.length > 0) {
    await db.delete(texts).where(inArray(texts.id, textIds));
  }
  await deleteTestUsers();
});

type RaceOptions = {
  wpm?: number;
  rank?: number;
  runners?: number;
  status?: ResultStatus;
  accuracy?: number;
  missedKeys?: Record<string, number>;
  textId?: string;
};

let minutes = 0;

/**
 * A race that ends a minute after the one added before. The player gets
 * `rank`; guests fill the other places up to `runners`.
 */
async function addRace(userId: string, options: RaceOptions = {}): Promise<string> {
  const { wpm = 60, rank = 1, status = "finished", missedKeys = {}, textId } = options;
  const runners = Math.max(options.runners ?? rank, rank);
  const accuracy = status === "abandoned" ? null : (options.accuracy ?? 95);
  const db = getDb();
  const endedAt = new Date(Date.UTC(2026, 0, 1) + ++minutes * 60_000);
  const [race] = await db
    .insert(races)
    .values({ content: "test", config: {} as never, textId, startedAt: endedAt, endedAt })
    .returning({ id: races.id });
  raceIds.push(race.id);

  const base = { raceId: race.id, rawWpm: wpm, errors: 0, durationMs: 1000, wpmSeries: [] };
  await db.insert(raceResults).values([
    {
      ...base,
      userId,
      name: "t",
      isGuest: false,
      rank,
      status,
      wpm,
      accuracy,
      progress: status === "finished" ? 1 : 0.5,
      missedKeys,
    },
    ...Array.from({ length: runners }, (_, index) => index + 1)
      .filter((place) => place !== rank)
      .map((place) => ({
        ...base,
        name: `guest ${place}`,
        isGuest: true,
        rank: place,
        status: "finished" as const,
        wpm: 50,
        accuracy: 90,
        progress: 1,
        missedKeys: { z: 7 },
      })),
  ]);
  return race.id;
}

describe("getStatsSummary", () => {
  test("is empty for a player who never raced", async () => {
    const account = await createTestAccount();
    expect(await getStatsSummary(account.id)).toEqual({
      races: 0,
      wins: 0,
      bestWpm: null,
      averageWpm: null,
      averageAccuracy: null,
    });
  });

  test("leaves given-up races out of the averages and the best WPM", async () => {
    const account = await createTestAccount();
    await addRace(account.id, { wpm: 60, accuracy: 90 });
    await addRace(account.id, { wpm: 80, accuracy: 100, rank: 2 });
    await addRace(account.id, { wpm: 120, status: "abandoned", rank: 3 });

    const summary = await getStatsSummary(account.id);
    expect(summary.races).toBe(3);
    expect(summary.bestWpm).toBe(80);
    expect(summary.averageWpm).toBe(70);
    expect(summary.averageAccuracy).toBe(95);
  });

  test("counts only first places that weren't given up as wins", async () => {
    const account = await createTestAccount();
    await addRace(account.id, { rank: 1 });
    await addRace(account.id, { rank: 2 });
    // Ranked first only because everyone gave up.
    await addRace(account.id, { rank: 1, status: "abandoned" });
    expect((await getStatsSummary(account.id)).wins).toBe(1);
  });

  test("takes a time-up's WPM into the average but not the best", async () => {
    const account = await createTestAccount();
    await addRace(account.id, { wpm: 40 });
    await addRace(account.id, { wpm: 100, status: "timeUp" });
    const summary = await getStatsSummary(account.id);
    expect(summary.bestWpm).toBe(40);
    expect(summary.averageWpm).toBe(70);
  });
});

describe("getWpmProgress", () => {
  test("lists races oldest first, without the given-up ones", async () => {
    const account = await createTestAccount();
    const first = await addRace(account.id, { wpm: 40 });
    await addRace(account.id, { wpm: 99, status: "abandoned" });
    const second = await addRace(account.id, { wpm: 55, status: "timeUp" });

    const progress = await getWpmProgress(account.id);
    expect(progress.map((entry) => [entry.raceId, entry.wpm, entry.status])).toEqual([
      [first, 40, "finished"],
      [second, 55, "timeUp"],
    ]);
  });
});

describe("getMissedKeys", () => {
  test("adds up the player's misses across races, most missed first", async () => {
    const account = await createTestAccount();
    await addRace(account.id, { missedKeys: { e: 2, t: 1 }, runners: 2 });
    await addRace(account.id, { missedKeys: { e: 3, a: 1, t: 4 } });

    const { keys, total } = await getMissedKeys(account.id);
    // "e" and "t" tie, so they come alphabetically; the guest's "z" isn't theirs.
    expect(keys).toEqual([
      { key: "e", misses: 5 },
      { key: "t", misses: 5 },
      { key: "a", misses: 1 },
    ]);
    expect(total).toBe(11);
  });

  test("keeps the total over every key when the list is cut", async () => {
    const account = await createTestAccount();
    await addRace(account.id, { missedKeys: { a: 3, b: 2, c: 1 } });
    const { keys, total } = await getMissedKeys(account.id, 2);
    expect(keys.map((entry) => entry.key)).toEqual(["a", "b"]);
    expect(total).toBe(6);
  });

  test("is empty for a player who never missed a key", async () => {
    const account = await createTestAccount();
    await addRace(account.id);
    expect(await getMissedKeys(account.id)).toEqual({ keys: [], total: 0 });
  });
});

describe("getPlaces", () => {
  test("counts podium places, the rest, and the races given up", async () => {
    const account = await createTestAccount();
    await addRace(account.id, { rank: 1 });
    await addRace(account.id, { rank: 1, runners: 3 });
    await addRace(account.id, { rank: 2 });
    await addRace(account.id, { rank: 3 });
    await addRace(account.id, { rank: 5 });
    await addRace(account.id, { rank: 1, status: "abandoned" });

    expect(await getPlaces(account.id)).toEqual({
      first: 2,
      second: 1,
      third: 1,
      other: 1,
      abandoned: 1,
    });
  });

  test("is all zeros for a player who never raced", async () => {
    const account = await createTestAccount();
    expect(await getPlaces(account.id)).toEqual({ first: 0, second: 0, third: 0, other: 0, abandoned: 0 });
  });
});

describe("getHistory", () => {
  test("lists races newest first, with the place, runners and passage title", async () => {
    const account = await createTestAccount();
    const [text] = await getDb()
      .insert(texts)
      .values({
        language: "en",
        content: "test",
        wordCount: 1,
        complexity: "easy",
        hasDigits: false,
        sourceTitle: "A Test Book",
        sourceAuthor: "Nobody",
        sourceRef: `test:${randomUUID()}`,
      })
      .returning({ id: texts.id });
    textIds.push(text.id);

    const older = await addRace(account.id, { rank: 2, runners: 4, textId: text.id });
    const newer = await addRace(account.id, { rank: 1, status: "abandoned" });

    const history = await getHistory(account.id, 1);
    expect(history.map((entry) => entry.raceId)).toEqual([newer, older]);
    expect(history[0]).toMatchObject({ rank: 1, runners: 1, status: "abandoned", accuracy: null, sourceTitle: null });
    expect(history[1]).toMatchObject({ rank: 2, runners: 4, status: "finished", sourceTitle: "A Test Book" });
  });

  test("splits the races into pages", async () => {
    const account = await createTestAccount();
    const ids: string[] = [];
    for (let index = 0; index < HISTORY_PAGE_SIZE + 2; index++) {
      ids.push(await addRace(account.id));
    }
    const newestFirst = ids.reverse();

    const first = await getHistory(account.id, 1);
    const second = await getHistory(account.id, 2);
    expect(first.map((entry) => entry.raceId)).toEqual(newestFirst.slice(0, HISTORY_PAGE_SIZE));
    expect(second.map((entry) => entry.raceId)).toEqual(newestFirst.slice(HISTORY_PAGE_SIZE));
    expect(await getHistory(account.id, 3)).toEqual([]);
  });

  test("never lists another player's races", async () => {
    const account = await createTestAccount();
    const other = await createTestAccount();
    await addRace(other.id);
    expect(await getHistory(account.id, 1)).toEqual([]);
  });
});
