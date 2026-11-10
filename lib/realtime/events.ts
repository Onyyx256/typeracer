import * as z from "zod";
import { MAX_KEYS_PER_BATCH, type PlayerState, type TrackEntry } from "@/lib/race/engine";
import type { ErrorMode } from "@/lib/race/typing";
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
  /** Server → client, to each member released when their room closes (SALLE-08). */
  roomClosed: "room:closed",
  /** Server → client: a public room was created, changed or closed. */
  lobbyChanged: "lobby:changed",

  /** Client → server: send me this room's race (text, track, my own typing). */
  raceSync: "race:sync",
  /** Client → server: a batch of the runner's keys, about every 150 ms (PERF-02). */
  raceKeys: "race:keys",
  /** Client → server: the runner gives up (COURSE-07). */
  raceAbandon: "race:abandon",
  /** Server → client: answer to race:sync. */
  raceState: "race:state",
  /** Server → client: everyone's progress, 5 times a second (COURSE-05). */
  raceTrack: "race:track",
  /** Server → client: keys were refused, here is what the server has (COURSE-06). */
  raceResync: "race:resync",
  /** Server → client, to one runner: a catch-up bonus changed their text (BONUS-04). */
  raceText: "race:text",
} as const;

/** TECH-07: every message a client sends is validated. */
export const watchRoomSchema = z.object({ code: roomCodeSchema });

export const raceSyncSchema = z.object({ code: roomCodeSchema });

/** One character or "\b" (backspace) per key; the engine also limits the pace. */
export const raceKeysSchema = z.object({
  /** Numbers the batches, so a refused one can be replayed around (race:resync). */
  seq: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
  keys: z.array(z.string().length(1)).min(1).max(MAX_KEYS_PER_BATCH),
  /**
   * When the batch was sent, in ms since typing opened, on the browser's
   * clock. Optional for pages loaded before it existed; the engine never
   * trusts it beyond its own clock.
   */
  at: z.int().min(0).max(24 * 60 * 60 * 1000).optional(),
});

/** What a page needs to show the race, sent when it asks (race:sync). */
export type RaceStatePayload = {
  code: string;
  /** The original text; a runner's own, changed by bonuses, is in `you`. */
  text: string;
  errorMode: ErrorMode;
  /** Relative times, so the browser's clock doesn't need to match the server's. */
  startsInMs: number;
  /** Until the time limit, or null without one. */
  endsInMs: number | null;
  track: TrackEntry[];
  /** The viewer's own typing, or null if they aren't racing (spectators). */
  you: PlayerState | null;
};

export type RaceTrackPayload = { code: string; track: TrackEntry[] };
/**
 * The server's state right after refusing batch `seq`: the browser takes
 * it and replays the batches it sent after that one, which the server
 * handled on top of this state.
 */
export type RaceResyncPayload = { code: string; seq: number; you: PlayerState };

/** Only words past the runner's cursor change, so their typing stays valid. */
export type RaceTextPayload = { code: string; text: string };

export type RoomChanged = { code: string };
export type RoomClosed = { code: string };

/** Socket.IO channel names. */
export const roomChannel = (code: string) => `room:${code}`;
/** Every socket of one signed-in user (or guest with a session). */
export const userChannel = (userId: string) => `user:${userId}`;
export const LOBBY_CHANNEL = "lobby";
