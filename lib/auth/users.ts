import "server-only";
import { db } from "@/db";
import { users } from "@/db/schema";

/** Returns null when the username is already taken, whatever its case. */
export async function createUser(
  username: string,
  passwordHash: string,
): Promise<{ id: string } | null> {
  // Let the unique index decide rather than checking first, so two
  // simultaneous signups cannot both get the same name.
  const [created] = await db
    .insert(users)
    .values({ username, displayName: username, passwordHash })
    .onConflictDoNothing()
    .returning({ id: users.id });
  return created ?? null;
}
