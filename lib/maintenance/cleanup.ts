import "server-only";
import { and, eq, lt, notExists, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { roomMembers, rooms, users } from "@/db/schema";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session-cookie";

const DAY_MS = 24 * 60 * 60 * 1000;
export const GUEST_LIFETIME_MS = SESSION_MAX_AGE_SECONDS * 1000;
export const CLOSED_ROOM_LIFETIME_MS = 7 * DAY_MS;

export type CleanupCounts = { guests: number; rooms: number };

/**
 * Race history is kept: deleting a guest only clears the link from their
 * results, and deleting a room only clears races.room_id.
 */
export async function deleteExpiredData(now = new Date()): Promise<CleanupCounts> {
  const db = getDb();
  const deletedRooms = await db
    .delete(rooms)
    .where(
      and(
        eq(rooms.state, "closed"),
        lt(rooms.closedAt, new Date(now.getTime() - CLOSED_ROOM_LIFETIME_MS)),
      ),
    )
    .returning({ id: rooms.id });
  // A guest still in a room would take that room down with them (host_id cascades).
  const deletedGuests = await db
    .delete(users)
    .where(
      and(
        eq(users.isGuest, true),
        lt(users.createdAt, new Date(now.getTime() - GUEST_LIFETIME_MS)),
        notExists(
          db.select({ one: sql`1` }).from(roomMembers).where(eq(roomMembers.userId, users.id)),
        ),
      ),
    )
    .returning({ id: users.id });
  return { guests: deletedGuests.length, rooms: deletedRooms.length };
}
