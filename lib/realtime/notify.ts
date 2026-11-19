import "server-only";
import { EVENTS, LOBBY_CHANNEL, roomChannel, userChannel, type RoomClosed, type RoomClosedReason } from "./events";
import { getIo, realtimeState } from "./state";

const PRUNE_ABOVE = 1_000;
/** Far longer than a page takes to subscribe after rendering. */
const KEEP_CHANGES_MS = 5 * 60_000;

function markChanged(channel: string, now: number): void {
  const { changedAt } = realtimeState();
  if (changedAt.size >= PRUNE_ABOVE) {
    for (const [key, at] of changedAt) {
      if (now - at > KEEP_CHANGES_MS) {
        changedAt.delete(key);
      }
    }
  }
  changedAt.set(channel, now);
}

/**
 * When a page renders, on the same clock as the change times, so the page
 * can tell after subscribing whether it missed a change.
 */
export function changeClock(): number {
  return Date.now();
}

/** Null if it hasn't changed recently. */
export function lastChange(channel: string): number | null {
  return realtimeState().changedAt.get(channel) ?? null;
}

export function notifyRoomChanged(code: string): void {
  const now = changeClock();
  markChanged(roomChannel(code), now);
  markChanged(LOBBY_CHANNEL, now);
  const io = getIo();
  if (!io) {
    return;
  }
  io.to(roomChannel(code)).emit(EVENTS.roomChanged, { code });
  io.to(LOBBY_CHANNEL).emit(EVENTS.lobbyChanged);
}

/**
 * Takes a kicked member's tabs off the room's channel, so a code-only or
 * private room stops reaching them, and tells those tabs to re-render.
 */
export function notifyKicked(userId: string, code: string): void {
  const io = getIo();
  if (!io) {
    return;
  }
  io.in(userChannel(userId)).socketsLeave(roomChannel(code));
  io.to(userChannel(userId)).emit(EVENTS.roomChanged, { code });
}

/** Takes the released members' tabs off the room's channel and tells them. */
export function notifyRoomClosed(
  userIds: string[],
  code: string,
  reason: RoomClosedReason = "hostLeft",
): void {
  const io = getIo();
  if (!io) {
    return;
  }
  for (const userId of userIds) {
    io.in(userChannel(userId)).socketsLeave(roomChannel(code));
    io.to(userChannel(userId)).emit(EVENTS.roomClosed, { code, reason } satisfies RoomClosed);
  }
}
