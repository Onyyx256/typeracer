"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { glareRange } from "@/lib/race/bonuses";
import { MAX_KEYS_PER_BATCH, type PlayerState } from "@/lib/race/engine";
import { accuracy, netWpm } from "@/lib/race/stats";
import {
  applyKey,
  applyKeys,
  BACKSPACE,
  correctChars,
  isComplete,
  lockedLength,
  type ErrorMode,
  type TypingState,
} from "@/lib/race/typing";
import { EVENTS, type RaceResyncPayload, type RaceTextPayload } from "@/lib/realtime/events";
import { getSocket } from "@/lib/realtime/client";
import type { Locale } from "@/lib/i18n/config";
import type { RaceDictionary } from "@/lib/i18n/dictionaries/fr";
import { formatNumber, formatPercent } from "@/lib/i18n/format";
import { useNow } from "./use-race";

/** Keys go to the server in batches, at most this often (PERF-02: under 10 messages/s). */
const SEND_EVERY_MS = 150;
/** Sent batches kept to replay after a refused one (race:resync). */
const SENT_LOG = 50;

type Batch = { seq: number; keys: string[] };

function fromServer(you: PlayerState): TypingState {
  return {
    input: you.input,
    keystrokes: you.keystrokes,
    correctKeystrokes: you.correctKeystrokes,
    missed: {},
  };
}

/**
 * COURSE-04: the typing area. Feedback is immediate, from the same reducer
 * the server replays the keys through (lib/race/typing.ts); the server's
 * numbers are the real ones and correct this one if they ever differ.
 * The text is the runner's own: catch-up bonuses change its end (BONUS-04).
 */
export function TypingArea({
  code,
  errorMode,
  startsAt,
  endsAt,
  initial,
  syncId,
  glare,
  dict,
  locale,
}: {
  code: string;
  errorMode: ErrorMode;
  startsAt: number;
  endsAt: number | null;
  initial: PlayerState;
  syncId: number;
  /** A blinding sun hides the next words (BONUS-03). */
  glare: boolean;
  dict: RaceDictionary;
  locale: Locale;
}) {
  const [text, setText] = useState(initial.text);
  const [typing, setTyping] = useState<TypingState>(() => fromServer(initial));
  // Read by the handlers, so a new text applies to the very next key.
  const textRef = useRef(initial.text);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const state = useRef(typing);
  const pending = useRef<string[]>([]);
  const sent = useRef<Batch[]>([]);
  const seq = useRef(0);
  const field = useRef<HTMLTextAreaElement>(null);

  const now = useNow(250, finishedAt === null);
  const open = now >= startsAt && (endsAt === null || now < endsAt);
  const done = isComplete(text, errorMode, typing);

  // The finish time goes with the state: a refused batch can take a
  // finished text back to unfinished, and the clock must run again.
  const update = useCallback(
    (next: TypingState, nextText: string = textRef.current) => {
      textRef.current = nextText;
      setText(nextText);
      state.current = next;
      setTyping(next);
      const complete = isComplete(nextText, errorMode, next);
      setFinishedAt((previous) => (complete ? (previous ?? Date.now()) : null));
    },
    [errorMode],
  );

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
  const press = useCallback(
    (keys: readonly string[]) => {
      const time = Date.now();
      if (time < startsAt || (endsAt !== null && time >= endsAt)) {
        return;
      }
      const text = textRef.current;
      let current = state.current;
      for (const key of keys) {
        const next = applyKey(text, errorMode, current, key);
        if (next !== current) {
          pending.current.push(key);
          current = next;
        }
      }
      if (current === state.current) {
        return;
      }
      update(current);
      if (isComplete(text, errorMode, current)) {
        // Right away, so the finish time is the server's as closely as possible.
        flush();
      }
    },
    [errorMode, startsAt, endsAt, update, flush],
  );

  // A new race:sync answer (first load, reconnection): the server's state,
  // plus what was typed but not sent yet.
  useEffect(() => {
    sent.current = [];
    update(applyKeys(initial.text, errorMode, fromServer(initial), pending.current), initial.text);
  }, [syncId, initial, errorMode, update]);

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
      const { text } = payload.you;
      update(applyKeys(text, errorMode, fromServer(payload.you), replay), text);
    };
    // A bonus changed the end of the text; what's typed stays valid.
    const onText = (payload: RaceTextPayload) => {
      if (payload.code === code) {
        update(state.current, payload.text);
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
  }, [code, errorMode, flush, update]);

  // Native listeners: beforeinput says what the key does, including
  // accented letters from dead keys, and lets paste be refused (COURSE-04).
  useEffect(() => {
    const element = field.current;
    if (!element) {
      return;
    }
    const keysOf = (data: string | null) =>
      [...(data ?? "").normalize("NFC")].filter((key) => key.length === 1);
    const onBeforeInput = (event: InputEvent) => {
      switch (event.inputType) {
        case "insertText":
        case "insertReplacementText":
          event.preventDefault();
          press(keysOf(event.data));
          return;
        case "deleteContentBackward":
          event.preventDefault();
          press([BACKSPACE]);
          return;
        case "deleteWordBackward":
        case "deleteSoftLineBackward":
        case "deleteHardLineBackward": {
          event.preventDefault();
          const { input } = state.current;
          const start = (input.endsWith(" ") ? input.slice(0, -1) : input).lastIndexOf(" ") + 1;
          const stop = Math.max(start, lockedLength(textRef.current, errorMode, input));
          press(Array(Math.max(0, input.length - stop)).fill(BACKSPACE));
          return;
        }
        case "insertCompositionText":
          // Can't be cancelled; the result arrives with compositionend.
          return;
        default:
          // Paste, drop, line breaks, forward deletes...
          event.preventDefault();
      }
    };
    const onCompositionEnd = (event: CompositionEvent) => {
      press(keysOf(event.data));
      element.value = "";
    };
    const clear = () => {
      element.value = "";
    };
    const refuse = (event: Event) => event.preventDefault();
    element.addEventListener("beforeinput", onBeforeInput);
    element.addEventListener("compositionend", onCompositionEnd);
    element.addEventListener("input", clear);
    element.addEventListener("paste", refuse);
    element.addEventListener("drop", refuse);
    return () => {
      element.removeEventListener("beforeinput", onBeforeInput);
      element.removeEventListener("compositionend", onCompositionEnd);
      element.removeEventListener("input", clear);
      element.removeEventListener("paste", refuse);
      element.removeEventListener("drop", refuse);
    };
  }, [press, errorMode]);

  // Ready to type as soon as the countdown starts.
  useEffect(() => {
    field.current?.focus();
  }, []);

  const until = finishedAt ?? (endsAt === null ? now : Math.min(now, endsAt));
  const elapsed = Math.max(0, until - startsAt);
  const wpm = netWpm(correctChars(text, errorMode, typing), elapsed);
  const acc = accuracy(typing.correctKeystrokes, typing.keystrokes);
  const left = endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000));

  return (
    <div className="grid gap-4">
      <dl className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-sm">
        <Stat label={dict.wpm} value={formatNumber(locale, wpm)} />
        <Stat label={dict.accuracy} value={formatPercent(locale, acc / 100)} />
        {left !== null && (
          <Stat label={dict.timeLeft} value={`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`} />
        )}
      </dl>

      <div className="relative border border-line bg-surface p-6 rounded-leaf focus-within:border-accent-text">
        <p
          aria-label={dict.textLabel}
          className="font-mono text-xl leading-relaxed break-words whitespace-pre-wrap select-none"
        >
          <TextChars text={text} input={typing.input} glare={glare} />
        </p>
        {/* Invisible over the text: clicking the text focuses it. */}
        <textarea
          ref={field}
          aria-label={dict.typeLabel}
          disabled={done || (!open && now >= startsAt)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="absolute inset-0 size-full cursor-text resize-none bg-transparent text-transparent caret-transparent opacity-0"
        />
      </div>
      {!done && <p className="font-mono text-xs text-muted">&gt; {dict.focusHint}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-2xl font-semibold text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

/** Right, wrong, the cursor, and what's left. Only re-rendered when the input changes. */
const TextChars = memo(function TextChars({
  text,
  input,
  glare,
}: {
  text: string;
  input: string;
  glare: boolean;
}) {
  const [glareStart, glareEnd] = glare ? glareRange(text, input.length) : [0, 0];
  // By UTF-16 unit, like the reducer's indexes.
  return text.split("").map((char, index) => {
    let className = "text-muted";
    if (index > glareStart && index < glareEnd) {
      className = "glare";
    } else if (index < input.length) {
      className = input[index] === char ? "text-primary-text" : "bg-danger/20 text-danger underline";
    } else if (index === input.length) {
      // The caret, drawn as a shadow so the text doesn't move.
      className = "text-foreground shadow-[-2px_0_0_0_var(--accent-text)]";
    }
    return (
      <span key={index} className={className}>
        {char}
      </span>
    );
  });
});
