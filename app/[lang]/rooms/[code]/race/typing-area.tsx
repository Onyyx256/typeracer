"use client";

import { useCallback, useEffect, useRef } from "react";
import { TypingBox, useTyping } from "@/app/components/race/typing-box";
import { MAX_KEYS_PER_BATCH, type PlayerState } from "@/lib/race/engine";
import { applyKeys, isComplete, type ErrorMode, type TypingState } from "@/lib/race/typing";
import { EVENTS, type RaceResyncPayload } from "@/lib/realtime/events";
import { getSocket } from "@/lib/realtime/client";
import type { Locale } from "@/lib/i18n/config";
import type { RaceDictionary } from "@/lib/i18n/dictionaries/fr";

/** Keys go to the server in batches, at most this often (PERF-02: under 10 messages/s). */
const SEND_EVERY_MS = 150;
/** Sent batches kept to replay after a refused one (race:resync). */
const SENT_LOG = 50;

type Batch = { seq: number; keys: string[] };

function fromServer(you: PlayerState): TypingState {
  return { ...you, missed: {} };
}

/**
 * The room's typing area: the keys go to the server, which replays them
 * through the same reducer; its numbers are the real ones and correct
 * this browser's if they ever differ (COURSE-06).
 */
export function TypingArea({
  code,
  text,
  errorMode,
  startsAt,
  endsAt,
  initial,
  syncId,
  dict,
  locale,
}: {
  code: string;
  text: string;
  errorMode: ErrorMode;
  startsAt: number;
  endsAt: number | null;
  initial: PlayerState;
  syncId: number;
  dict: RaceDictionary;
  locale: Locale;
}) {
  const typing = useTyping({ text, errorMode, startsAt, endsAt, initial: fromServer(initial) });
  const { set, press, state } = typing;
  const pending = useRef<string[]>([]);
  const sent = useRef<Batch[]>([]);
  const seq = useRef(0);

  const flush = useCallback(() => {
    const socket = getSocket();
    // Kept while offline: after reconnecting, race:sync gives the server's
    // state and these are replayed on top of it.
    while (socket.connected && pending.current.length > 0) {
      const keys = pending.current.splice(0, MAX_KEYS_PER_BATCH);
      const batch = { seq: seq.current++, keys };
      sent.current = [...sent.current, batch].slice(-SENT_LOG);
      socket.emit(EVENTS.raceKeys, batch);
    }
  }, []);

  /** Applies keys locally and queues the ones that changed something. */
  const onKeys = useCallback(
    (keys: string[]) => {
      const accepted = press(keys);
      if (accepted.length === 0) {
        return;
      }
      pending.current.push(...accepted);
      if (isComplete(text, errorMode, state.current)) {
        // Right away, so the finish time is the server's as closely as possible.
        flush();
      }
    },
    [press, state, text, errorMode, flush],
  );

  // A new race:sync answer (first load, reconnection): the server's state,
  // plus what was typed but not sent yet.
  useEffect(() => {
    sent.current = [];
    set(applyKeys(text, errorMode, fromServer(initial), pending.current));
  }, [syncId, initial, text, errorMode, set]);

  useEffect(() => {
    const timer = setInterval(flush, SEND_EVERY_MS);
    const socket = getSocket();
    const onResync = (payload: RaceResyncPayload) => {
      if (payload.code !== code) {
        return;
      }
      const after = sent.current.filter((batch) => batch.seq > payload.seq);
      sent.current = after;
      const replay = [...after.flatMap((batch) => batch.keys), ...pending.current];
      set(applyKeys(text, errorMode, fromServer(payload.you), replay));
    };
    socket.on(EVENTS.raceResync, onResync);
    return () => {
      clearInterval(timer);
      socket.off(EVENTS.raceResync, onResync);
      flush();
    };
  }, [code, text, errorMode, flush, set]);

  return (
    <TypingBox
      text={text}
      errorMode={errorMode}
      startsAt={startsAt}
      endsAt={endsAt}
      typing={typing}
      onKeys={onKeys}
      dict={dict}
      locale={locale}
    />
  );
}
