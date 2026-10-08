import "server-only";
import { eq, sql } from "drizzle-orm";
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
): Promise<{ id: string; displayName: string } | null> {
  const [found] = await getDb()
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return found ?? null;
}
