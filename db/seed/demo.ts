/**
 * Demo accounts with two months of races, so the stats and history pages
 * have something to show. Running it again replaces their races.
 */
import { hash } from "@node-rs/argon2";
import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { raceResults, races, texts, users, type NewRaceResult } from "@/db/schema";
import { rank } from "@/lib/race/ranking";
import type { ResultStatus, WpmPoint } from "@/lib/race/types";
import { raceConfigSchema, type RaceConfig } from "@/lib/rooms/settings";

export const DEMO_PASSWORD = "nelumbo-demo";

type Racer = {
  username: string;
  /** WPM on the first race and on the last: they get better with practice. */
  startWpm: number;
  endWpm: number;
  accuracy: number;
  /** Characters they trip on more than others. */
  weakKeys: string;
};

const RACERS: Racer[] = [
  { username: "demo_lotus", startWpm: 48, endWpm: 72, accuracy: 95, weakKeys: "éèàqzxy" },
  { username: "demo_iris", startWpm: 66, endWpm: 74, accuracy: 97, weakKeys: ",.;'bp" },
  { username: "demo_fern", startWpm: 34, endWpm: 47, accuracy: 92, weakKeys: "aeiouvw" },
];

const RACE_COUNT = 48;
const DAYS = 60;
const DAY_MS = 86_400_000;

/** Same races on every run (mulberry32). */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

async function demoAccounts(): Promise<Map<string, string>> {
  const db = getDb();
  const passwordHash = await hash(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  await db
    .insert(users)
    .values(RACERS.map((racer) => ({ username: racer.username, displayName: racer.username, passwordHash })))
    .onConflictDoNothing();
  const rows = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(sql`lower(${users.username})`, RACERS.map((racer) => racer.username)));
  return new Map(rows.map((row) => [row.username?.toLowerCase() ?? "", row.id]));
}

function wpmSeries(wpm: number, durationMs: number, next: () => number): WpmPoint[] {
  const points: WpmPoint[] = [];
  for (let t = 1000; t <= durationMs; t += 1000) {
    const warmUp = 1 - 0.45 * Math.exp(-t / 5000);
    points.push({ t, wpm: Math.max(0, wpm * warmUp * (0.92 + next() * 0.16)) });
  }
  return points;
}

function missedKeys(content: string, errors: number, weakKeys: string, next: () => number): Record<string, number> {
  const weak = [...content].filter((char) => weakKeys.includes(char.toLowerCase()));
  const missed: Record<string, number> = {};
  for (let error = 0; error < errors; error++) {
    const pool = weak.length > 0 && next() < 0.6 ? weak : [...content];
    const char = pool[Math.floor(next() * pool.length)];
    missed[char] = (missed[char] ?? 0) + 1;
  }
  return missed;
}

export async function seedDemoHistory(): Promise<void> {
  const db = getDb();
  const ids = await demoAccounts();
  const userIds = [...ids.values()];
  const old = await db
    .selectDistinct({ id: raceResults.raceId })
    .from(raceResults)
    .where(inArray(raceResults.userId, userIds));
  if (old.length > 0) {
    await db.delete(races).where(inArray(races.id, old.map((row) => row.id)));
  }

  const passages = await db
    .select({ id: texts.id, content: texts.content, language: texts.language, complexity: texts.complexity, wordCount: texts.wordCount })
    .from(texts)
    .where(sql`${texts.wordCount} between 25 and 70`)
    .orderBy(sql`md5(${texts.sourceRef})`)
    .limit(RACE_COUNT);
  if (passages.length === 0) {
    console.log("demo: no passages, seed the texts first");
    return;
  }

  const next = random(42);
  const now = Date.now();
  for (let index = 0; index < RACE_COUNT; index++) {
    const passage = passages[index % passages.length];
    const progressInTime = index / (RACE_COUNT - 1);
    const endedAt = new Date(now - (1 - progressInTime) * DAYS * DAY_MS - next() * 3 * 3_600_000);
    const timeLimit = next() < 0.25 ? 60 : 0;
    const config: RaceConfig = raceConfigSchema.parse({
      timeLimit,
      language: passage.language,
      textType: "coherent",
      length: Math.min(200, Math.max(10, Math.round(passage.wordCount / 5) * 5)),
      complexity: passage.complexity,
      punctuation: true,
      numbers: false,
      capitals: true,
      accents: passage.language === "fr",
      includeChars: "",
      excludeChars: "",
      errorMode: "strict",
      bonuses: false,
    });
    // Lotus is in every race; the others join most of them.
    const runners = RACERS.filter((racer, position) => position === 0 || next() < 0.75);
    if (runners.length < 2) {
      runners.push(RACERS[1]);
    }

    const entries = runners.map((racer) => {
      const skill = racer.startWpm + (racer.endWpm - racer.startWpm) * progressInTime;
      const wpm = Math.max(15, skill * (0.85 + next() * 0.3));
      const accuracy = Math.min(100, racer.accuracy + (next() - 0.5) * 6);
      const fullMs = (passage.content.length / 5 / wpm) * 60_000;
      let status: ResultStatus = "finished";
      let progress = 1;
      let durationMs = fullMs;
      if (next() < 0.06) {
        status = "abandoned";
        progress = 0.2 + next() * 0.6;
        durationMs = fullMs * progress;
      } else if (timeLimit > 0 && fullMs > timeLimit * 1000) {
        status = "timeUp";
        durationMs = timeLimit * 1000;
        progress = durationMs / fullMs;
      }
      const typed = Math.round(passage.content.length * progress);
      const errors = Math.round(typed * (1 - accuracy / 100));
      return {
        racer,
        status,
        progress,
        durationMs: Math.round(durationMs),
        wpm,
        rawWpm: wpm * (1 + (errors / Math.max(1, typed)) * 1.5),
        accuracy: status === "abandoned" ? null : accuracy,
        errors,
        wpmSeries: wpmSeries(wpm, durationMs, next),
        missedKeys: missedKeys(passage.content.slice(0, typed), errors, racer.weakKeys, next),
      };
    });

    const longest = Math.max(...entries.map((entry) => entry.durationMs));
    await db.transaction(async (tx) => {
      const [race] = await tx
        .insert(races)
        .values({
          textId: passage.id,
          content: passage.content,
          config,
          startedAt: new Date(endedAt.getTime() - longest),
          endedAt,
        })
        .returning({ id: races.id });
      const rows: NewRaceResult[] = rank(entries).map((entry) => ({
        raceId: race.id,
        userId: ids.get(entry.racer.username) ?? null,
        name: entry.racer.username,
        isGuest: false,
        rank: entry.rank,
        status: entry.status,
        wpm: entry.wpm,
        rawWpm: entry.rawWpm,
        accuracy: entry.accuracy,
        errors: entry.errors,
        progress: entry.progress,
        durationMs: entry.durationMs,
        wpmSeries: entry.wpmSeries,
        missedKeys: entry.missedKeys,
        bonuses: [],
      }));
      await tx.insert(raceResults).values(rows);
    });
  }
  console.log(`demo: ${RACERS.length} accounts (password "${DEMO_PASSWORD}"), ${RACE_COUNT} races`);
}
