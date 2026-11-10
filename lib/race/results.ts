import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { raceResults, races, rooms, texts } from "@/db/schema";
import { raceConfigSchema, type RaceConfig } from "@/lib/rooms/settings";
import type { BonusKind } from "./bonuses";
import type { ParticipantResult } from "./engine";
import type { ResultStatus, WpmPoint } from "./types";

/** Written once, in the same transaction that moves the room to the results. */
export async function saveRace(race: {
  roomId: string;
  textId: string | null;
  content: string;
  config: RaceConfig;
  startedAt: Date;
  endedAt: Date;
  results: ParticipantResult[];
}): Promise<void> {
  await getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(races)
      .values({
        roomId: race.roomId,
        textId: race.textId,
        content: race.content,
        config: race.config,
        startedAt: race.startedAt,
        endedAt: race.endedAt,
      })
      .returning({ id: races.id });
    if (race.results.length > 0) {
      await tx.insert(raceResults).values(
        race.results.map((result) => ({
          raceId: row.id,
          // Guests keep no history.
          userId: result.isGuest ? null : result.userId,
          name: result.name,
          isGuest: result.isGuest,
          rank: result.rank,
          status: result.status,
          wpm: result.wpm,
          rawWpm: result.rawWpm,
          accuracy: result.accuracy,
          errors: result.errors,
          progress: result.progress,
          durationMs: Math.round(result.durationMs),
          wpmSeries: result.wpmSeries,
          missedKeys: result.missedKeys,
          bonuses: result.bonuses,
        })),
      );
    }
    // A room that closed meanwhile stays closed.
    await tx
      .update(rooms)
      .set({ state: "results" })
      .where(and(eq(rooms.id, race.roomId), inArray(rooms.state, ["countdown", "racing"])));
  });
}

export type ResultRow = {
  userId: string | null;
  name: string;
  isGuest: boolean;
  rank: number;
  status: ResultStatus;
  wpm: number;
  rawWpm: number;
  accuracy: number | null;
  errors: number;
  progress: number;
  durationMs: number;
  wpmSeries: WpmPoint[];
  missedKeys: Record<string, number>;
  bonuses: BonusKind[];
};

export type RaceResultsView = {
  raceId: string;
  content: string;
  config: RaceConfig;
  startedAt: Date;
  endedAt: Date;
  source: { title: string; author: string } | null;
  results: ResultRow[];
};

export async function getLatestRaceResults(code: string): Promise<RaceResultsView | null> {
  const [race] = await getDb()
    .select({ id: races.id })
    .from(races)
    .innerJoin(rooms, eq(rooms.id, races.roomId))
    .where(eq(rooms.code, code))
    .orderBy(desc(races.endedAt))
    .limit(1);
  return race ? loadRaceResults(race.id) : null;
}

/** Only for someone who ran in it, so a private room's results stay private. */
export async function getRaceResultsFor(
  raceId: string,
  userId: string,
): Promise<RaceResultsView | null> {
  const [entry] = await getDb()
    .select({ id: raceResults.id })
    .from(raceResults)
    .where(and(eq(raceResults.raceId, raceId), eq(raceResults.userId, userId)))
    .limit(1);
  return entry ? loadRaceResults(raceId) : null;
}

async function loadRaceResults(raceId: string): Promise<RaceResultsView | null> {
  const db = getDb();
  const [race] = await db
    .select({
      id: races.id,
      content: races.content,
      config: races.config,
      startedAt: races.startedAt,
      endedAt: races.endedAt,
      sourceTitle: texts.sourceTitle,
      sourceAuthor: texts.sourceAuthor,
    })
    .from(races)
    .leftJoin(texts, eq(texts.id, races.textId))
    .where(eq(races.id, raceId))
    .limit(1);
  if (!race) {
    return null;
  }
  const results = await db
    .select({
      userId: raceResults.userId,
      name: raceResults.name,
      isGuest: raceResults.isGuest,
      rank: raceResults.rank,
      status: raceResults.status,
      wpm: raceResults.wpm,
      rawWpm: raceResults.rawWpm,
      accuracy: raceResults.accuracy,
      errors: raceResults.errors,
      progress: raceResults.progress,
      durationMs: raceResults.durationMs,
      wpmSeries: raceResults.wpmSeries,
      missedKeys: raceResults.missedKeys,
      bonuses: raceResults.bonuses,
    })
    .from(raceResults)
    .where(eq(raceResults.raceId, race.id))
    .orderBy(asc(raceResults.rank));

  return {
    raceId: race.id,
    content: race.content,
    config: raceConfigSchema.parse(race.config),
    startedAt: race.startedAt,
    endedAt: race.endedAt,
    source:
      race.sourceTitle && race.sourceAuthor
        ? { title: race.sourceTitle, author: race.sourceAuthor }
        : null,
    results,
  };
}
