import "server-only";
import { EVENTS, LOBBY_CHANNEL, roomChannel, userChannel, type RoomClosed } from "./events";
import { getIo } from "./state";

export function notifyRoomChanged(code: string): void {
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
export function notifyRoomClosed(userIds: string[], code: string): void {
  const io = getIo();
  if (!io) {
    return;
  }
  for (const userId of userIds) {
    io.in(userChannel(userId)).socketsLeave(roomChannel(code));
    io.to(userChannel(userId)).emit(EVENTS.roomClosed, { code } satisfies RoomClosed);
  }
}
