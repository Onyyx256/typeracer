import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";

/**
 * Users made by a test file. Deleting them cascades to their rooms and
 * memberships, so `deleteTestUsers` leaves the database as it was, and other
 * rows (someone testing the app by hand on the same database) are untouched.
 */
const created: string[] = [];

export function uniqueName(prefix = "t"): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export async function createTestAccount(
  username = uniqueName(),
): Promise<{ id: string; username: string }> {
  const [row] = await getDb()
    .insert(users)
    .values({ username, displayName: username, passwordHash: "not-a-real-hash" })
    .returning({ id: users.id });
  created.push(row.id);
  return { id: row.id, username };
}

export async function createTestGuest(nickname = uniqueName("g")): Promise<{ id: string }> {
  const [row] = await getDb()
    .insert(users)
    .values({ displayName: nickname, isGuest: true })
    .returning({ id: users.id });
  created.push(row.id);
  return { id: row.id };
}

export async function deleteTestUsers(): Promise<void> {
  if (created.length > 0) {
    await getDb().delete(users).where(inArray(users.id, created.splice(0)));
  }
}
