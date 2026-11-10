"use client";

import { useEffect, useState } from "react";
import type { TrackEntry } from "@/lib/race/engine";
import {
  EVENTS,
  type RaceStatePayload,
  type RaceTrackPayload,
} from "@/lib/realtime/events";
import { getSocket } from "@/lib/realtime/client";

/** The race as this tab knows it; times are on this browser's clock. */
export type LiveRace = Omit<RaceStatePayload, "startsInMs" | "endsInMs" | "track"> & {
  startsAt: number;
  endsAt: number | null;
  /** Changes on every race:sync answer, so the typing area takes the server's state again. */
  syncId: number;
};

/** Asks again while the server has nothing yet (the page can render a moment before the race exists). */
const RETRY_MS = 1_000;

/**
 * Follows the room's race: asks for it (race:sync) on mount and after
 * every reconnection, which also gives a runner coming back their typing
 * (COURSE-08), and keeps the track from the 5-per-second updates.
 */
export function useRace(code: string): { race: LiveRace | null; track: TrackEntry[] } {
  const [race, setRace] = useState<LiveRace | null>(null);
  const [track, setTrack] = useState<TrackEntry[]>([]);

  useEffect(() => {
    const socket = getSocket();
    let received = false;
    let syncs = 0;

    const sync = () => socket.emit(EVENTS.raceSync, { code });
    const onState = (state: RaceStatePayload) => {
      if (state.code !== code) {
        return;
      }
      received = true;
      const now = Date.now();
      const { startsInMs, endsInMs, track: entries, ...rest } = state;
      setRace({
        ...rest,
        startsAt: now + startsInMs,
        endsAt: endsInMs === null ? null : now + endsInMs,
        syncId: ++syncs,
      });
      setTrack(entries);
    };
    const onTrack = (payload: RaceTrackPayload) => {
      if (payload.code === code) {
        setTrack(payload.track);
      }
    };
    const retry = setInterval(() => {
      if (!received) {
        sync();
      }
    }, RETRY_MS);

    sync();
    socket.on("connect", sync);
    socket.on(EVENTS.raceState, onState);
    socket.on(EVENTS.raceTrack, onTrack);
    return () => {
      clearInterval(retry);
      socket.off("connect", sync);
      socket.off(EVENTS.raceState, onState);
      socket.off(EVENTS.raceTrack, onTrack);
    };
  }, [code]);

  return { race, track };
}
