import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { roomMembers, rooms, users } from "@/db/schema";
import {
  EVENTS,
  roomChannel,
  type RaceResyncPayload,
  type RaceStatePayload,
  type RaceTrackPayload,
} from "@/lib/realtime/events";
import { notifyRoomChanged } from "@/lib/realtime/notify";
import { getIo } from "@/lib/realtime/state";
import { raceConfigSchema, type RaceConfig, type RoomState } from "@/lib/rooms/settings";
import { generateText } from "@/lib/texts/generate";
import { COUNTDOWN_MS, Race, type RaceParticipant } from "./engine";
import { saveRace } from "./results";

/**
 * Runs the races (COURSE-01): the server makes every transition, with
 * real timers around the pure engine. Races live in memory only; the
 * database gets the room's state and, at the end, the results (PERF-02).
 */

/** 5 track updates a second, smoothed in the browser (COURSE-05). */
export const TRACK_INTERVAL_MS = 200;

/** The host starts from the waiting room only; the results go back to it first (COURSE-01). */
const STARTABLE_STATES: readonly RoomState[] = ["waiting"];

/** COURSE-02: at least 2 runners. Bots will count; spectators never do. */
export const MIN_RUNNERS = 2;

type Runtime = {
  code: string;
  roomId: string;
  race: Race;
  config: RaceConfig;
  textId: string | null;
  /** When the countdown started. */
  startedAt: Date;
  startTimer: ReturnType<typeof setTimeout>;
  loop: ReturnType<typeof setInterval>;
  finishing: boolean;
};

type RaceStore = {
  byCode: Map<string, Runtime>;
  /** Which race each runner is in. */
  byUser: Map<string, string>;
};

// On globalThis like the rest of the real-time state (see lib/realtime/state.ts).
const STORE_KEY = Symbol.for("nelumbotype.races");

function store(): RaceStore {
  const globals = globalThis as Record<symbol, unknown>;
  globals[STORE_KEY] ??= { byCode: new Map(), byUser: new Map() } satisfies RaceStore;
  return globals[STORE_KEY] as RaceStore;
}

function logFailure(action: string, error: unknown): void {
  const cause = error instanceof Error ? (error.cause ?? error) : error;
  console.error(`${action} failed:`, cause instanceof Error ? cause.message : "unknown error");
}

export type StartRaceError =
  /** The user isn't the host of an open room (SEC-01). */
  | "notHost"
  /** Fewer than MIN_RUNNERS runners (COURSE-02). */
  | "notEnoughRunners"
  /** A race is already counting down or running. */
  | "notStartable";

export type StartRaceResult = { ok: true } | { ok: false; error: StartRaceError };

/**
 * The host starts a race: EN_ATTENTE → DÉCOMPTE. The text
 * is generated now, so nobody sees it before the countdown (COURSE-03).
 */
export async function startRace(hostId: string): Promise<StartRaceResult> {
  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id, code: rooms.code, hostId: rooms.hostId, state: rooms.state, config: rooms.config })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .where(eq(roomMembers.userId, hostId));
  if (!room || room.hostId !== hostId || room.state === "closed") {
    return { ok: false, error: "notHost" };
  }
  if (!STARTABLE_STATES.includes(room.state) || store().byCode.has(room.code)) {
    return { ok: false, error: "notStartable" };
  }
  const config = raceConfigSchema.parse(room.config);
  const text = await generateText(config);

  const checked = await db.transaction(
    async (tx): Promise<StartRaceError | RaceParticipant[]> => {
      // Locked, and checked again: a double click or two tabs start one race only.
      const [locked] = await tx
        .select({ hostId: rooms.hostId, state: rooms.state })
        .from(rooms)
        .where(eq(rooms.id, room.id))
        .for("update");
      if (!locked || locked.hostId !== hostId) {
        return "notHost";
      }
      if (!STARTABLE_STATES.includes(locked.state)) {
        return "notStartable";
      }
      const runners = await tx
        .select({ userId: roomMembers.userId, name: roomMembers.name, isGuest: users.isGuest })
        .from(roomMembers)
        .innerJoin(users, eq(users.id, roomMembers.userId))
        .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.role, "participant")))
        .orderBy(asc(roomMembers.joinedAt));
      // Every runner is human until bots exist, so "at least one human" holds.
      if (runners.length < MIN_RUNNERS) {
        return "notEnoughRunners";
      }
      await tx.update(rooms).set({ state: "countdown" }).where(eq(rooms.id, room.id));
      return runners;
    },
  );
  if (typeof checked === "string") {
    return { ok: false, error: checked };
  }

  const now = Date.now();
  const race = new Race({
    text: text.content,
    errorMode: config.errorMode,
    timeLimit: config.timeLimit,
    participants: checked,
    now,
  });
  const runtime: Runtime = {
    code: room.code,
    roomId: room.id,
    race,
    config,
    textId: text.source?.textId ?? null,
    startedAt: new Date(now),
    // DÉCOMPTE → EN_COURSE when the 3-2-1 is over.
    startTimer: setTimeout(() => void markRacing(runtime), COUNTDOWN_MS),
    loop: setInterval(() => step(runtime), TRACK_INTERVAL_MS),
    finishing: false,
  };
  runtime.startTimer.unref?.();
  runtime.loop.unref?.();
  store().byCode.set(room.code, runtime);
  for (const runner of checked) {
    store().byUser.set(runner.userId, room.code);
  }
  // Pages re-render into the race and ask for it (race:sync).
  notifyRoomChanged(room.code);
  return { ok: true };
}

export type BackToLobbyError =
  /** The user isn't the host of an open room (SEC-01). */
  | "notHost"
  /** The room isn't showing results. */
  | "notOnResults";

export type BackToLobbyResult = { ok: true } | { ok: false; error: BackToLobbyError };

/**
 * COURSE-11: on the results, the host's "New game" brings the room back to
 * the waiting room (RÉSULTATS → EN_ATTENTE), where the next race starts.
 */
export async function backToLobby(hostId: string): Promise<BackToLobbyResult> {
  const db = getDb();
  const [room] = await db
    .select({ id: rooms.id, code: rooms.code, hostId: rooms.hostId, state: rooms.state })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .where(eq(roomMembers.userId, hostId));
  if (!room || room.hostId !== hostId || room.state === "closed") {
    return { ok: false, error: "notHost" };
  }
  // Only from the results, checked in the update itself so two clicks change it once.
  const moved = await db
    .update(rooms)
    .set({ state: "waiting" })
    .where(and(eq(rooms.id, room.id), eq(rooms.hostId, hostId), eq(rooms.state, "results")))
    .returning({ id: rooms.id });
  if (moved.length === 0) {
    return { ok: false, error: "notOnResults" };
  }
  notifyRoomChanged(room.code);
  return { ok: true };
}

async function markRacing(runtime: Runtime): Promise<void> {
  try {
    await getDb()
      .update(rooms)
      .set({ state: "racing" })
      .where(and(eq(rooms.id, runtime.roomId), eq(rooms.state, "countdown")));
    notifyRoomChanged(runtime.code);
  } catch (error) {
    logFailure("race start", error);
  }
}

function emitTrack(runtime: Runtime, now: number): void {
  getIo()
    ?.to(roomChannel(runtime.code))
    .emit(EVENTS.raceTrack, {
      code: runtime.code,
      track: runtime.race.track(now),
    } satisfies RaceTrackPayload);
}

function step(runtime: Runtime): void {
  const now = Date.now();
  runtime.race.tick(now);
  emitTrack(runtime, now);
  if (runtime.race.isOver(now)) {
    void finish(runtime);
  }
}

/** EN_COURSE → RÉSULTATS: saves everyone's result, then the pages show them. */
async function finish(runtime: Runtime): Promise<void> {
  if (runtime.finishing) {
    return;
  }
  runtime.finishing = true;
  clearTimeout(runtime.startTimer);
  clearInterval(runtime.loop);
  const now = Date.now();
  emitTrack(runtime, now);
  try {
    await saveRace({
      roomId: runtime.roomId,
      textId: runtime.textId,
      content: runtime.race.text,
      config: runtime.config,
      startedAt: runtime.startedAt,
      endedAt: new Date(now),
      results: runtime.race.results(now),
    });
  } catch (error) {
    logFailure("save race", error);
    // Never leave the room stuck in a race that no longer exists.
    await resetRoomState(runtime.roomId).catch((reset: unknown) => logFailure("reset room", reset));
  }
  forget(runtime);
  notifyRoomChanged(runtime.code);
}

function forget(runtime: Runtime): void {
  const races = store();
  if (races.byCode.get(runtime.code) === runtime) {
    races.byCode.delete(runtime.code);
  }
  for (const [userId, code] of races.byUser) {
    if (code === runtime.code) {
      races.byUser.delete(userId);
    }
  }
}

async function resetRoomState(roomId: string): Promise<void> {
  await getDb()
    .update(rooms)
    .set({ state: "waiting" })
    .where(and(eq(rooms.id, roomId), inArray(rooms.state, ["countdown", "racing"])));
}

function runtimeOf(userId: string): Runtime | null {
  const code = store().byUser.get(userId);
  return code ? (store().byCode.get(code) ?? null) : null;
}

/**
 * A batch of a runner's keys (COURSE-06). Returns what to send back to
 * that browser when the batch was refused, so it shows the server's state.
 */
export function handleKeys(
  userId: string,
  seq: number,
  keys: readonly string[],
): RaceResyncPayload | null {
  const runtime = runtimeOf(userId);
  if (!runtime || runtime.finishing) {
    return null;
  }
  const now = Date.now();
  const result = runtime.race.applyKeys(userId, keys, now);
  if (!result.ok) {
    const you = runtime.race.playerState(userId);
    return you ? { code: runtime.code, seq, you } : null;
  }
  if (result.finished && runtime.race.isOver(now)) {
    void finish(runtime);
  }
  return null;
}

/**
 * COURSE-07: the runner gives up. Also called when they leave the room or
 * are kicked mid-race, and after 30 s away (COURSE-08).
 */
export function abandonRace(userId: string): void {
  const runtime = runtimeOf(userId);
  if (!runtime || runtime.finishing) {
    return;
  }
  const now = Date.now();
  if (runtime.race.abandon(userId, now)) {
    emitTrack(runtime, now);
    if (runtime.race.isOver(now)) {
      void finish(runtime);
    }
  }
}

/**
 * The room closed mid-race: whoever is still racing abandons, and it ends
 * now. Resolves once the results are saved.
 */
export async function closeRace(code: string): Promise<void> {
  const runtime = store().byCode.get(code);
  if (!runtime || runtime.finishing) {
    return;
  }
  const now = Date.now();
  for (const entry of runtime.race.track(now)) {
    runtime.race.abandon(entry.userId, now);
  }
  await finish(runtime);
}

/**
 * The race as one viewer sees it, for race:sync; the caller checks they
 * may watch the room. A runner coming back gets their own typing back.
 */
export function raceStateFor(code: string, userId: string | null): RaceStatePayload | null {
  const runtime = store().byCode.get(code);
  if (!runtime || runtime.finishing) {
    return null;
  }
  const { race } = runtime;
  const now = Date.now();
  return {
    code,
    text: race.text,
    errorMode: race.mode,
    startsInMs: race.startsAt - now,
    endsInMs: race.deadline === null ? null : race.deadline - now,
    track: race.track(now),
    you: userId && race.isRunner(userId) ? race.playerState(userId) : null,
  };
}

/**
 * After a restart no race is in memory any more: rooms left mid-race go
 * back to the waiting room (ADR 1 accepts losing them).
 */
export async function resetInterruptedRaces(): Promise<void> {
  const running = new Set(Array.from(store().byCode.values(), (runtime) => runtime.roomId));
  const stuck = await getDb()
    .select({ id: rooms.id })
    .from(rooms)
    .where(inArray(rooms.state, ["countdown", "racing"]));
  for (const room of stuck) {
    if (!running.has(room.id)) {
      await resetRoomState(room.id);
    }
  }
}
