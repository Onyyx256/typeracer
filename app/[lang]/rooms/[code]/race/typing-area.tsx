"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { TypingBox, useTyping } from "@/app/components/race/typing-box";
import type { PlayerState } from "@/lib/race/engine";
import { keysAllowed, spendAllowance, startAllowance } from "@/lib/race/pacing";
import { applyKeys, isComplete, type ErrorMode, type TypingState } from "@/lib/race/typing";
import { EVENTS, type RaceResyncPayload, type RaceTextPayload } from "@/lib/realtime/events";
import { getSocket } from "@/lib/realtime/client";
import type { Locale } from "@/lib/i18n/config";
import type { RaceDictionary } from "@/lib/i18n/dictionaries/fr";

/** Under 10 messages a second. */
const SEND_EVERY_MS = 150;
/** Sent batches kept to replay after a refused one (race:resync). */
const SENT_LOG = 50;
/**
 * How long the server's text length may differ from this browser's before
 * the text is asked for again; race:text normally lands before the track.
 */
const TEXT_MISMATCH_MS = 500;

type Batch = { seq: number; keys: string[]; at: number };

function fromServer(you: PlayerState): TypingState {
  return {
    input: you.input,
    keystrokes: you.keystrokes,
    correctKeystrokes: you.correctKeystrokes,
    missed: {},
  };
}

/**
 * The server replays the keys through the same reducer; its numbers are
 * the real ones and correct this browser's if they ever differ.
 */
export function TypingArea({
  code,
  errorMode,
  startsAt,
  endsAt,
  initial,
  syncId,
  glare,
  serverTextLength,
  dict,
  locale,
  action,
}: {
  code: string;
  errorMode: ErrorMode;
  startsAt: number;
  endsAt: number | null;
  initial: PlayerState;
  syncId: number;
  glare: boolean;
  serverTextLength: number | undefined;
  dict: RaceDictionary;
  locale: Locale;
  action?: ReactNode;
}) {
  const [text, setText] = useState(initial.text);
  const [removed, setRemoved] = useState(initial.removed);
  const typing = useTyping({ text, errorMode, startsAt, endsAt, initial: fromServer(initial) });
  const { set, press, state } = typing;
  const pending = useRef<string[]>([]);
  const sent = useRef<Batch[]>([]);
  const seq = useRef(0);
  const allowance = useRef(startAllowance(startsAt));

  const flush = useCallback(() => {
    const socket = getSocket();
    // Kept while offline: after reconnecting, race:sync gives the server's
    // state and these are replayed on top of it. Only what the server's
    // speed check allows goes now; the rest waits for the next send.
    while (socket.connected && pending.current.length > 0) {
      const now = Date.now();
      const count = Math.min(pending.current.length, keysAllowed(allowance.current, now));
      if (count <= 0) {
        return;
      }
      allowance.current = spendAllowance(allowance.current, now, count);
      const keys = pending.current.splice(0, count);
      // The send time lets the server tell a network stall from fast typing.
      const batch = { seq: seq.current++, keys, at: Math.max(0, Math.round(now - startsAt)) };
      sent.current = [...sent.current, batch].slice(-SENT_LOG);
      socket.emit(EVENTS.raceKeys, batch);
    }
  }, [startsAt]);

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
  // The text comes with it; a bonus may have changed it meanwhile.
  const synced = useRef(-1);
  useEffect(() => {
    if (synced.current === syncId) {
      return;
    }
    synced.current = syncId;
    sent.current = [];
    setText(initial.text);
    setRemoved(initial.removed);
    set(applyKeys(initial.text, errorMode, fromServer(initial), pending.current));
  }, [syncId, initial, errorMode, set]);

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
      setText(payload.you.text);
      setRemoved(payload.you.removed);
      set(applyKeys(payload.you.text, errorMode, fromServer(payload.you), replay));
    };
    // A bonus changed the end of the text; what's typed stays valid.
    const onText = (payload: RaceTextPayload) => {
      if (payload.code === code) {
        setText(payload.text);
        setRemoved(payload.removed);
      }
    };
    socket.on(EVENTS.raceResync, onResync);
    socket.on(EVENTS.raceText, onText);
    return () => {
      clearInterval(timer);
      socket.off(EVENTS.raceResync, onResync);
      socket.off(EVENTS.raceText, onText);
      flush();
    };
  }, [code, errorMode, flush, set]);

  // A missed race:text leaves this browser with an outdated text: it could
  // reach its end while the server waits for more. When the server's length
  // keeps differing, the text is asked for again.
  useEffect(() => {
    if (serverTextLength === undefined || serverTextLength === text.length) {
      return;
    }
    // Asked again while it lasts, in case an answer is lost too.
    const timer = setInterval(() => getSocket().emit(EVENTS.raceTextSync, { code }), TEXT_MISMATCH_MS);
    return () => clearInterval(timer);
  }, [serverTextLength, text.length, code]);

  return (
    <TypingBox
      text={text}
      errorMode={errorMode}
      startsAt={startsAt}
      endsAt={endsAt}
      typing={typing}
      onKeys={onKeys}
      glare={glare}
      removed={removed}
      dict={dict}
      locale={locale}
      action={action}
    />
  );
}
