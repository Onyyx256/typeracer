import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";

/** Returns null when the username is already taken, whatever its case. */
export async function createUser(
  username: string,
  passwordHash: string,
): Promise<{ id: string } | null> {
  // Let the unique index decide rather than checking first, so two
  // simultaneous signups cannot both get the same name.
  const [created] = await getDb()
    .insert(users)
    .values({ username, displayName: username, passwordHash })
    .onConflictDoNothing()
    .returning({ id: users.id });
  return created ?? null;
}

/** AUTH-02: a guest is a user row with only a nickname. */
export async function createGuest(nickname: string): Promise<{ id: string }> {
  const [created] = await getDb()
    .insert(users)
    .values({ displayName: nickname, isGuest: true })
    .returning({ id: users.id });
  return created;
}

/**
 * True when an account other than `exceptUserId` uses this name as its
 * username, whatever its case.
 */
export async function isAccountUsername(
  name: string,
  exceptUserId: string | null,
): Promise<boolean> {
  const [found] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.username})`, name.toLowerCase()))
    .limit(1);
  return found !== undefined && found.id !== exceptUserId;
}

/** A guest's default name for the next rooms: the last one they got into a room with. */
export async function setGuestNickname(id: string, nickname: string): Promise<void> {
  await getDb()
    .update(users)
    .set({ displayName: nickname })
    .where(and(eq(users.id, id), eq(users.isGuest, true)));
}

export async function findCredentials(
  username: string,
): Promise<{ id: string; passwordHash: string | null } | null> {
  const [found] = await getDb()
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(sql`lower(${users.username})`, username.toLowerCase()))
    .limit(1);
  return found ?? null;
}

/** What the interface may show of a user; never the password hash. */
export async function findProfile(
  id: string,
): Promise<{ id: string; displayName: string; isGuest: boolean } | null> {
  const [found] = await getDb()
    .select({ id: users.id, displayName: users.displayName, isGuest: users.isGuest })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return found ?? null;
}
