import "server-only";
import { and, asc, avg, count, desc, eq, max, ne, sql } from "drizzle-orm";
import * as z from "zod";
import { getDb } from "@/db";
import { raceResults, races, texts } from "@/db/schema";
import type { ResultStatus } from "@/lib/race/types";
import { HISTORY_PAGE_SIZE } from "./series";

export type StatsSummary = {
  races: number;
  wins: number;
  /** Finished races only: a time-up WPM is over part of the text. */
  bestWpm: number | null;
  /** Abandoned races are left out of both averages. */
  averageWpm: number | null;
  averageAccuracy: number | null;
};

export async function getStatsSummary(userId: string): Promise<StatsSummary> {
  const [row] = await getDb()
    .select({
      races: count(),
      // Someone who gave up can be ranked first only if everyone did; that's no win.
      wins: count(sql`case when ${raceResults.rank} = 1 and ${raceResults.status} <> 'abandoned' then 1 end`),
      bestWpm: max(sql<number>`case when ${raceResults.status} = 'finished' then ${raceResults.wpm} end`),
      averageWpm: avg(sql`case when ${raceResults.status} <> 'abandoned' then ${raceResults.wpm} end`),
      averageAccuracy: avg(raceResults.accuracy),
    })
    .from(raceResults)
    .where(eq(raceResults.userId, userId));
  const toNumber = (value: string | number | null | undefined) =>
    value === null || value === undefined ? null : Number(value);
  return {
    races: row?.races ?? 0,
    wins: row?.wins ?? 0,
    bestWpm: toNumber(row?.bestWpm),
    averageWpm: toNumber(row?.averageWpm),
    averageAccuracy: toNumber(row?.averageAccuracy),
  };
}

export type WpmEntry = {
  raceId: string;
  endedAt: Date;
  wpm: number;
  accuracy: number | null;
  status: ResultStatus;
};

export const WPM_CHART_LIMIT = 100;

/** Oldest first, abandoned races left out. */
export async function getWpmProgress(userId: string): Promise<WpmEntry[]> {
  const rows = await getDb()
    .select({
      raceId: races.id,
      endedAt: races.endedAt,
      wpm: raceResults.wpm,
      accuracy: raceResults.accuracy,
      status: raceResults.status,
    })
    .from(raceResults)
    .innerJoin(races, eq(races.id, raceResults.raceId))
    .where(and(eq(raceResults.userId, userId), ne(raceResults.status, "abandoned")))
    .orderBy(desc(races.endedAt))
    .limit(WPM_CHART_LIMIT);
  return rows.reverse();
}

export type MissedKey = { key: string; misses: number };

const missedKeyRowSchema = z.object({ key: z.string(), misses: z.coerce.number() });

export async function getMissedKeys(
  userId: string,
  limit = 10,
): Promise<{ keys: MissedKey[]; total: number }> {
  const result = await getDb().execute(sql`
    select m.key, sum(m.value::int) as misses
    from ${raceResults}, jsonb_each_text(${raceResults.missedKeys}) as m(key, value)
    where ${raceResults.userId} = ${userId}
    group by m.key
    order by misses desc, m.key
  `);
  const rows = z.array(missedKeyRowSchema).parse(result.rows);
  return {
    keys: rows.slice(0, limit),
    total: rows.reduce((sum, row) => sum + row.misses, 0),
  };
}

export const PLACES = ["first", "second", "third", "other", "abandoned"] as const;

export type Place = (typeof PLACES)[number];

export async function getPlaces(userId: string): Promise<Record<Place, number>> {
  const place = sql<string>`case
    when ${raceResults.status} = 'abandoned' then 'abandoned'
    when ${raceResults.rank} = 1 then 'first'
    when ${raceResults.rank} = 2 then 'second'
    when ${raceResults.rank} = 3 then 'third'
    else 'other' end`;
  const rows = await getDb()
    .select({ place, races: count() })
    .from(raceResults)
    .where(eq(raceResults.userId, userId))
    .groupBy(place);
  const counts = Object.fromEntries(PLACES.map((key) => [key, 0])) as Record<Place, number>;
  for (const row of rows) {
    const key = PLACES.find((entry) => entry === row.place);
    if (key) {
      counts[key] = row.races;
    }
  }
  return counts;
}

export type HistoryEntry = {
  raceId: string;
  endedAt: Date;
  rank: number;
  runners: number;
  status: ResultStatus;
  wpm: number;
  accuracy: number | null;
  sourceTitle: string | null;
};

/** Newest first. */
export async function getHistory(userId: string, page: number): Promise<HistoryEntry[]> {
  return getDb()
    .select({
      raceId: races.id,
      endedAt: races.endedAt,
      rank: raceResults.rank,
      runners: sql<number>`(select count(*)::int from ${raceResults} as others where others.race_id = ${races.id})`,
      status: raceResults.status,
      wpm: raceResults.wpm,
      accuracy: raceResults.accuracy,
      sourceTitle: texts.sourceTitle,
    })
    .from(raceResults)
    .innerJoin(races, eq(races.id, raceResults.raceId))
    .leftJoin(texts, eq(texts.id, races.textId))
    .where(eq(raceResults.userId, userId))
    .orderBy(desc(races.endedAt), asc(races.id))
    .limit(HISTORY_PAGE_SIZE)
    .offset((page - 1) * HISTORY_PAGE_SIZE);
}
