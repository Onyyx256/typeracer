import "server-only";
import { EVENTS, LOBBY_CHANNEL, roomChannel, userChannel, type RoomClosed, type RoomClosedReason } from "./events";
import { getIo } from "./state";

/** Tells everyone watching the room, and the room list, that it changed (CONF-12, JOIN-02). */
export function notifyRoomChanged(code: string): void {
  const io = getIo();
  if (!io) {
    return;
  }
  io.to(roomChannel(code)).emit(EVENTS.roomChanged, { code });
  io.to(LOBBY_CHANNEL).emit(EVENTS.lobbyChanged);
}

/**
 * SALLE-07: takes a kicked member's tabs off the room's channel, so a
 * code-only or private room stops reaching them, and tells those tabs to
 * re-render (the page then shows that they were removed).
 */
export function notifyKicked(userId: string, code: string): void {
  const io = getIo();
  if (!io) {
    return;
  }
  io.in(userChannel(userId)).socketsLeave(roomChannel(code));
  io.to(userChannel(userId)).emit(EVENTS.roomChanged, { code });
}

/**
 * The room closed under its remaining members: nobody signed in could take
 * over as host (SALLE-08), or the host deleted it. Takes their tabs off the
 * room's channel and tells them, so the page says the room was deleted.
 */
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
