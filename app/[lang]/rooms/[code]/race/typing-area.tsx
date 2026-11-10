"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { EVENTS, type RaceResyncPayload } from "@/lib/realtime/events";
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
  return { ...you, missed: {} };
}

/**
 * COURSE-04: the typing area. Feedback is immediate, from the same reducer
 * the server replays the keys through (lib/race/typing.ts); the server's
 * numbers are the real ones and correct this one if they ever differ.
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
  action,
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
  /** Shown at the end of the stats row (the give up button). */
  action?: React.ReactNode;
}) {
  const [typing, setTyping] = useState<TypingState>(() => fromServer(initial));
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const state = useRef(typing);
  const pending = useRef<string[]>([]);
  const sent = useRef<Batch[]>([]);
  const seq = useRef(0);
  const field = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const lines = useRef<HTMLParagraphElement>(null);

  const now = useNow(250, finishedAt === null);
  const open = now >= startsAt && (endsAt === null || now < endsAt);
  const done = isComplete(text, errorMode, typing);

  // The finish time goes with the state: a refused batch can take a
  // finished text back to unfinished, and the clock must run again.
  const update = useCallback(
    (next: TypingState) => {
      state.current = next;
      setTyping(next);
      const complete = isComplete(text, errorMode, next);
      setFinishedAt((previous) => (complete ? (previous ?? Date.now()) : null));
    },
    [text, errorMode],
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
    [text, errorMode, startsAt, endsAt, update, flush],
  );

  // A new race:sync answer (first load, reconnection): the server's state,
  // plus what was typed but not sent yet.
  useEffect(() => {
    sent.current = [];
    update(applyKeys(text, errorMode, fromServer(initial), pending.current));
  }, [syncId, initial, text, errorMode, update]);

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
      update(applyKeys(text, errorMode, fromServer(payload.you), replay));
    };
    socket.on(EVENTS.raceResync, onResync);
    return () => {
      clearInterval(timer);
      socket.off(EVENTS.raceResync, onResync);
      flush();
    };
  }, [code, text, errorMode, flush, update]);

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
          const stop = Math.max(start, lockedLength(text, errorMode, input));
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
  }, [press, text, errorMode]);

  // The text box scrolls by itself so the caret's line, the one before it
  // and the one after it are always in sight; the player may still scroll
  // ahead with the wheel, and the next key brings the caret back.
  const caret = typing.input.length;
  useLayoutEffect(() => {
    const scroller = box.current;
    const element = lines.current;
    if (!scroller || !element) {
      return;
    }
    const follow = (smooth: boolean) => {
      const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
      const chars = element.children;
      const at = chars[Math.min(caret, chars.length - 1)];
      if (!(at instanceof HTMLElement) || !lineHeight) {
        return;
      }
      const line = Math.round(at.offsetTop / lineHeight);
      const top = Math.max(0, line - 1) * lineHeight;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scroller.scrollTo({ top, behavior: smooth && !still ? "smooth" : "instant" });
    };
    follow(true);
    // The lines wrap differently when the window is resized.
    const observer = new ResizeObserver(() => follow(false));
    observer.observe(element);
    return () => observer.disconnect();
  }, [caret]);

  // Ready to type as soon as the countdown starts.
  useEffect(() => {
    field.current?.focus({ preventScroll: true });
  }, []);

  const until = finishedAt ?? (endsAt === null ? now : Math.min(now, endsAt));
  const elapsed = Math.max(0, until - startsAt);
  const wpm = netWpm(correctChars(text, errorMode, typing), elapsed);
  const acc = accuracy(typing.correctKeystrokes, typing.keystrokes);
  const left = endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
      <dl className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-sm">
        <Stat label={dict.wpm} value={formatNumber(locale, wpm)} />
        <Stat label={dict.accuracy} value={formatPercent(locale, acc / 100)} />
        {left !== null && (
          <Stat label={dict.timeLeft} value={`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`} />
        )}
      </dl>
      {action}
      </div>

      {/* Clicking anywhere in the box focuses the hidden field. */}
      <div
        onClick={() => field.current?.focus({ preventScroll: true })}
        className="relative cursor-text border border-line bg-surface py-6 pr-3 pl-6 rounded-leaf focus-within:border-accent-text"
      >
        {/* At most three lines high (leading-9 = 2.25rem each); a little side room keeps the caret visible. */}
        <div
          ref={box}
          className="-ml-1 max-h-[6.75rem] overflow-y-auto pr-3 pl-1 [scrollbar-width:thin]"
        >
          <p
            ref={lines}
            aria-label={dict.textLabel}
            className="relative font-mono text-xl leading-9 break-words whitespace-pre-wrap select-none"
          >
            <TextChars text={text} input={typing.input} />
          </p>
        </div>
        {/* Invisible over the text; clicks go through it so the wheel scrolls the text. */}
        <textarea
          ref={field}
          aria-label={dict.typeLabel}
          disabled={done || (!open && now >= startsAt)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="pointer-events-none absolute inset-0 size-full resize-none bg-transparent text-transparent caret-transparent opacity-0"
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
const TextChars = memo(function TextChars({ text, input }: { text: string; input: string }) {
  // By UTF-16 unit, like the reducer's indexes.
  return text.split("").map((char, index) => {
    let className = "text-muted";
    if (index < input.length) {
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
