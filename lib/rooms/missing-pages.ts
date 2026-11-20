import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { roomMembers, rooms } from "@/db/schema";
import { roomCodeSchema } from "./code";
import { recordCodeMiss, tooManyCodeMisses } from "./code-attempts";
import { inviteTokenSchema, lookUpInvite } from "./invites";

/**
 * Whether a room page would only show "not found". Decided before the page
 * renders, since a streamed page has already sent a 200. Follows the page's
 * rules: a private room is "not found" to anyone outside it, and while an
 * address is over the code-miss limit the page answers instead, so the
 * status can't be used to keep guessing.
 */
export async function roomPageMissing(raw: string, userId: string | null, ip: string): Promise<boolean> {
  const code = roomCodeSchema.safeParse(raw);
  if (!code.success) {
    return true;
  }
  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id, visibility: rooms.visibility })
    .from(rooms)
    .where(and(eq(rooms.code, code.data), ne(rooms.state, "closed")));
  if (room?.visibility === "public") {
    return false;
  }
  if (room && userId) {
    const [member] = await db
      .select({ id: roomMembers.id })
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, userId)));
    if (member) {
      return false;
    }
  }
  if (tooManyCodeMisses(ip)) {
    return false;
  }
  if (!room || room.visibility === "private") {
    recordCodeMiss(ip);
    return true;
  }
  return false;
}

/** A link that was used by someone else still gets its own explanation. */
export async function invitePageMissing(token: string, userId: string | null, ip: string): Promise<boolean> {
  if (!inviteTokenSchema.safeParse(token).success) {
    return true;
  }
  const found = await lookUpInvite(token, userId, ip);
  return !found.ok && found.error === "inviteInvalid";
}
