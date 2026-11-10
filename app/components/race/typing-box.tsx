"use client";

import { memo, useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { accuracy, netWpm } from "@/lib/race/stats";
import {
  applyKey,
  BACKSPACE,
  correctChars,
  isComplete,
  lockedLength,
  type ErrorMode,
  type TypingState,
} from "@/lib/race/typing";
import type { Locale } from "@/lib/i18n/config";
import type { RaceDictionary } from "@/lib/i18n/dictionaries/fr";
import { formatNumber, formatPercent } from "@/lib/i18n/format";
import { useNow } from "./use-now";

type TypingOptions = {
  text: string;
  errorMode: ErrorMode;
  startsAt: number;
  endsAt: number | null;
  initial: TypingState;
};

export type Typing = {
  typing: TypingState;
  /** When the text was completed, for the WPM shown; null while typing. */
  finishedAt: number | null;
  /** The latest state, for event handlers between renders. */
  state: RefObject<TypingState>;
  /** Replaces the state, for a resync with the server. */
  set: (next: TypingState) => void;
  /** Applies keys while typing is open; returns those that changed something. */
  press: (keys: readonly string[]) => string[];
};

/**
 * What the player typed, from the same reducer the server replays keys
 * through (lib/race/typing.ts), so the feedback is immediate (COURSE-04).
 * Where the keys go next is the caller's business.
 */
export function useTyping({ text, errorMode, startsAt, endsAt, initial }: TypingOptions): Typing {
  const [typing, setTyping] = useState<TypingState>(initial);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const state = useRef(typing);

  // The finish time goes with the state: a refused batch can take a
  // finished text back to unfinished, and the clock must run again.
  const set = useCallback(
    (next: TypingState) => {
      state.current = next;
      setTyping(next);
      const complete = isComplete(text, errorMode, next);
      setFinishedAt((previous) => (complete ? (previous ?? Date.now()) : null));
    },
    [text, errorMode],
  );

  const press = useCallback(
    (keys: readonly string[]) => {
      const time = Date.now();
      if (time < startsAt || (endsAt !== null && time >= endsAt)) {
        return [];
      }
      const accepted: string[] = [];
      let current = state.current;
      for (const key of keys) {
        const next = applyKey(text, errorMode, current, key);
        if (next !== current) {
          accepted.push(key);
          current = next;
        }
      }
      if (accepted.length > 0) {
        set(current);
      }
      return accepted;
    },
    [text, errorMode, startsAt, endsAt, set],
  );

  return { typing, finishedAt, state, set, press };
}

/**
 * COURSE-04: the typing area. Shows the text with right, wrong and the
 * cursor, the live WPM and accuracy, and turns key presses into `onKeys`
 * calls; paste and drop are refused.
 */
export function TypingBox({
  text,
  errorMode,
  startsAt,
  endsAt,
  typing: { typing, finishedAt, state },
  onKeys,
  dict,
  locale,
}: {
  text: string;
  errorMode: ErrorMode;
  startsAt: number;
  endsAt: number | null;
  typing: Typing;
  onKeys: (keys: string[]) => void;
  dict: RaceDictionary;
  locale: Locale;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const now = useNow(250, finishedAt === null);
  const open = now >= startsAt && (endsAt === null || now < endsAt);
  const done = isComplete(text, errorMode, typing);

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
          onKeys(keysOf(event.data));
          return;
        case "deleteContentBackward":
          event.preventDefault();
          onKeys([BACKSPACE]);
          return;
        case "deleteWordBackward":
        case "deleteSoftLineBackward":
        case "deleteHardLineBackward": {
          event.preventDefault();
          const { input } = state.current;
          const start = (input.endsWith(" ") ? input.slice(0, -1) : input).lastIndexOf(" ") + 1;
          const stop = Math.max(start, lockedLength(text, errorMode, input));
          onKeys(Array<string>(Math.max(0, input.length - stop)).fill(BACKSPACE));
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
      onKeys(keysOf(event.data));
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
  }, [onKeys, state, text, errorMode]);

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
          <TextChars text={text} input={typing.input} />
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
