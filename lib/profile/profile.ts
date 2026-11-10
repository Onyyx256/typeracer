import "server-only";
import { and, count, eq, inArray, max, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { raceResults, userAvatars, users } from "@/db/schema";
import { readCosmetics, type Cosmetics, type PlayerProgress } from "./cosmetics";
import { avatarPath, type PlayerLooks } from "./look";

export async function getPlayerProgress(userId: string): Promise<PlayerProgress> {
  const [row] = await getDb()
    .select({
      races: count(),
      // Someone who gave up can be ranked first only if everyone did; that's no win.
      wins: count(sql`case when ${raceResults.rank} = 1 and ${raceResults.status} <> 'abandoned' then 1 end`),
      bestWpm: max(sql<number>`case when ${raceResults.status} = 'finished' then ${raceResults.wpm} end`),
    })
    .from(raceResults)
    .where(eq(raceResults.userId, userId));
  return {
    races: row?.races ?? 0,
    wins: row?.wins ?? 0,
    bestWpm: Number(row?.bestWpm ?? 0),
  };
}

export async function getLooks(userIds: readonly string[]): Promise<PlayerLooks> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) {
    return {};
  }
  const rows = await getDb()
    .select({
      id: users.id,
      stemColor: users.stemColor,
      petalColor: users.petalColor,
      avatarAt: userAvatars.updatedAt,
    })
    .from(users)
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .where(and(inArray(users.id, ids), eq(users.isGuest, false)));
  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        avatarUrl: row.avatarAt ? avatarPath(row.id, row.avatarAt) : null,
        cosmetics: readCosmetics(row.stemColor, row.petalColor),
      },
    ]),
  );
}

export async function getAvatarImage(userId: string): Promise<Buffer | null> {
  const [row] = await getDb()
    .select({ image: userAvatars.image })
    .from(userAvatars)
    .where(eq(userAvatars.userId, userId))
    .limit(1);
  return row?.image ?? null;
}

export async function saveAvatar(userId: string, image: Buffer): Promise<void> {
  const now = new Date();
  await getDb()
    .insert(userAvatars)
    .values({ userId, image, updatedAt: now })
    .onConflictDoUpdate({ target: userAvatars.userId, set: { image, updatedAt: now } });
}

export async function removeAvatar(userId: string): Promise<void> {
  await getDb().delete(userAvatars).where(eq(userAvatars.userId, userId));
}

/** Accounts only; a guest's nickname is set when joining a room. */
export async function setDisplayName(userId: string, displayName: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ displayName })
    .where(and(eq(users.id, userId), ne(users.isGuest, true)));
}

export async function setCosmetics(userId: string, { stem, petal }: Cosmetics): Promise<void> {
  await getDb()
    .update(users)
    .set({ stemColor: stem, petalColor: petal })
    .where(and(eq(users.id, userId), eq(users.isGuest, false)));
}
