import * as z from "zod";
import { roomCodeSchema } from "@/lib/rooms/code";

/**
 * Socket.IO events, shared by the server and the browser. The server only
 * tells pages that something changed; pages then re-render on the server
 * (router.refresh), which re-applies every permission check.
 */
export const EVENTS = {
  /** Client → server: follow one room's changes. */
  watchRoom: "room:watch",
  unwatchRoom: "room:unwatch",
  /** Client → server: follow the public room list. */
  watchLobby: "lobby:watch",
  unwatchLobby: "lobby:unwatch",
  /** Server → client: the room's members, host, state or settings changed. */
  roomChanged: "room:changed",
  /** Server → client: a public room was created, changed or closed. */
  lobbyChanged: "lobby:changed",
} as const;

/** TECH-07: every message a client sends is validated. */
export const watchRoomSchema = z.object({ code: roomCodeSchema });

export type RoomChanged = { code: string };

/** Socket.IO channel names. */
export const roomChannel = (code: string) => `room:${code}`;
/** Every socket of one signed-in user (or guest with a session). */
export const userChannel = (userId: string) => `user:${userId}`;
export const LOBBY_CHANNEL = "lobby";
