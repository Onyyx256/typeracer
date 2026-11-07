import "server-only";
import { EVENTS, LOBBY_CHANNEL, roomChannel } from "./events";
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
