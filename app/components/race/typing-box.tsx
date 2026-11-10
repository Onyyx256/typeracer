"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { glareRange } from "@/lib/race/bonuses";
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
  finishedAt: number | null;
  /** The latest state, for event handlers between renders. */
  state: RefObject<TypingState>;
  set: (next: TypingState) => void;
  /** Applies keys while typing is open; returns those that changed something. */
  press: (keys: readonly string[]) => string[];
};

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

  // A catch-up bonus can change the text: whether it's complete is checked again.
  useEffect(() => {
    set(state.current);
  }, [set]);

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

/** Paste and drop are refused. The text box shows three lines and follows the caret. */
export function TypingBox({
  text,
  errorMode,
  startsAt,
  endsAt,
  typing: { typing, finishedAt, state },
  onKeys,
  glare = false,
  removed = "",
  dict,
  locale,
  action,
}: {
  text: string;
  errorMode: ErrorMode;
  startsAt: number;
  endsAt: number | null;
  typing: Typing;
  onKeys: (keys: string[]) => void;
  glare?: boolean;
  removed?: string;
  dict: RaceDictionary;
  locale: Locale;
  action?: ReactNode;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const lines = useRef<HTMLParagraphElement>(null);
  const now = useNow(250, finishedAt === null);
  const open = now >= startsAt && (endsAt === null || now < endsAt);
  const done = isComplete(text, errorMode, typing);
  const started = useStarted(startsAt, now);

  // Native listeners: beforeinput says what the key does, including
  // accented letters from dead keys, and lets paste be refused.
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
  }, [caret, started]);

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

      <div
        onClick={() => field.current?.focus({ preventScroll: true })}
        className="relative cursor-text border border-line bg-surface py-6 pr-3 pl-6 rounded-leaf focus-within:border-accent-text"
      >
        {/* At most three lines high (leading-9 = 2.25rem each); a little side room keeps the caret visible. */}
        <div
          ref={box}
          className="-ml-1 max-h-[6.75rem] overflow-y-auto pr-3 pl-1 [scrollbar-width:thin]"
        >
          {/* The text stays hidden until the countdown ends, so nobody reads ahead. */}
          {started ? (
            <p
              ref={lines}
              aria-label={dict.textLabel}
              className="relative font-mono text-xl leading-9 break-words whitespace-pre-wrap select-none"
            >
              <TextChars text={text} input={typing.input} glare={glare} />
              {/* After the characters, so the caret's index into them stays right. */}
              {removed && (
                <span>
                  <span className="sr-only">{dict.removedWords}</span>{" "}
                  <span className="text-muted/70 line-through decoration-accent-text decoration-2">{removed}</span>
                </span>
              )}
            </p>
          ) : (
            <div aria-hidden className="h-[6.75rem]" />
          )}
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

/**
 * Whether the race has started: `now` is only updated every 250 ms, so a
 * timer also flips it right at `startsAt`.
 */
function useStarted(startsAt: number, now: number): boolean {
  const [reached, setReached] = useState<number | null>(null);
  useEffect(() => {
    const wait = startsAt - Date.now();
    if (wait <= 0) {
      return;
    }
    const timer = setTimeout(() => setReached(startsAt), wait);
    return () => clearTimeout(timer);
  }, [startsAt]);
  return now >= startsAt || reached === startsAt;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-2xl font-semibold text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

/** Only re-rendered when the input changes. */
const TextChars = memo(function TextChars({
  text,
  input,
  glare,
}: {
  text: string;
  input: string;
  glare: boolean;
}) {
  // The caret's character stays visible; the glare starts after it.
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
