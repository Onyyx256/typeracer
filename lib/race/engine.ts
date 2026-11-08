import type { ErrorMode, TypingState } from "./typing";
import {
  applyKeys,
  correctChars,
  initialTyping,
  isComplete,
  typingProgress,
} from "./typing";
import { rank } from "./ranking";
import { accuracy, netWpm, rawWpm } from "./stats";
import type { ResultStatus, WpmPoint } from "./types";

/**
 * One race, as the server sees it (COURSE-06). Pure: every method takes
 * the current time, so tests drive the clock. lib/race/manager.ts runs it
 * with real timers and sends its snapshots to the room.
 */

/** The synchronized 3-2-1 (COURSE-03). */
export const COUNTDOWN_MS = 3_000;

/** How often each runner's WPM is sampled for the chart (RES-03). */
export const SAMPLE_MS = 1_000;

/**
 * Speed check: keys refill at this rate, up to a small burst, and a batch
 * needing more than what's left is refused. 25 keys/s is 300 WPM held
 * for good, above the best human typists; the burst covers messages that
 * arrive bunched up after a network hiccup.
 */
export const MAX_KEYS_PER_SECOND = 25;
export const BURST_KEYS = 40;
/** What's allowed right at the start, before anything has refilled. */
export const START_KEYS = 8;

/** Per message; the browser sends about every 150 ms. */
export const MAX_KEYS_PER_BATCH = 60;

export type RaceParticipant = {
  userId: string;
  name: string;
  isGuest: boolean;
};

export type RunnerStatus = "racing" | "finished" | "abandoned";

type Runner = RaceParticipant & {
  /** Per runner, since catch-up bonuses will change one player's text (BONUS-04). */
  text: string;
  typing: TypingState;
  status: RunnerStatus;
  /** When they finished or abandoned. */
  endedAt: number | null;
  series: WpmPoint[];
  tokens: number;
  tokensAt: number;
};

export type KeysResult =
  | { ok: true; finished: boolean }
  | { ok: false; reason: "notRacing" | "tooFast" | "tooMany" };

/** One line of the live track (COURSE-05). */
export type TrackEntry = RaceParticipant & {
  progress: number;
  wpm: number;
  status: RunnerStatus;
};

/** A runner's own typing, sent back to their browser to resync it. */
export type PlayerState = { input: string; keystrokes: number; correctKeystrokes: number };

export type ParticipantResult = RaceParticipant & {
  rank: number;
  status: ResultStatus;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  errors: number;
  progress: number;
  durationMs: number;
  wpmSeries: WpmPoint[];
  missedKeys: Record<string, number>;
};

export class Race {
  readonly text: string;
  readonly mode: ErrorMode;
  /** When the countdown ends and typing opens. */
  readonly startsAt: number;
  /** When the time limit ends the race, or null without a limit (CONF-01). */
  readonly deadline: number | null;
  private readonly runners = new Map<string, Runner>();

  constructor(options: {
    text: string;
    errorMode: ErrorMode;
    /** In seconds, 0 for none. */
    timeLimit: number;
    participants: readonly RaceParticipant[];
    /** When the countdown starts. */
    now: number;
  }) {
    this.text = options.text;
    this.mode = options.errorMode;
    this.startsAt = options.now + COUNTDOWN_MS;
    this.deadline = options.timeLimit > 0 ? this.startsAt + options.timeLimit * 1000 : null;
    for (const participant of options.participants) {
      this.runners.set(participant.userId, {
        ...participant,
        text: options.text,
        typing: initialTyping(),
        status: "racing",
        endedAt: null,
        series: [],
        tokens: START_KEYS,
        tokensAt: this.startsAt,
      });
    }
  }

  isRunner(userId: string): boolean {
    return this.runners.has(userId);
  }

  isTypingOpen(now: number): boolean {
    return now >= this.startsAt && (this.deadline === null || now < this.deadline);
  }

  /** COURSE-09: everyone finished or abandoned, or the time limit is reached. */
  isOver(now: number): boolean {
    if (this.deadline !== null && now >= this.deadline) {
      return true;
    }
    return [...this.runners.values()].every((runner) => runner.status !== "racing");
  }

  /** Replays a batch of keys; refused whole if it's too fast to be typed by hand. */
  applyKeys(userId: string, keys: readonly string[], now: number): KeysResult {
    const runner = this.runners.get(userId);
    if (!runner || runner.status !== "racing" || !this.isTypingOpen(now)) {
      return { ok: false, reason: "notRacing" };
    }
    if (keys.length > MAX_KEYS_PER_BATCH) {
      return { ok: false, reason: "tooMany" };
    }
    const refill = ((now - runner.tokensAt) / 1000) * MAX_KEYS_PER_SECOND;
    const tokens = Math.min(BURST_KEYS, runner.tokens + Math.max(0, refill));
    if (keys.length > tokens) {
      return { ok: false, reason: "tooFast" };
    }
    runner.tokens = tokens - keys.length;
    runner.tokensAt = now;

    runner.typing = applyKeys(runner.text, this.mode, runner.typing, keys);
    if (isComplete(runner.text, this.mode, runner.typing)) {
      this.end(runner, "finished", now);
      return { ok: true, finished: true };
    }
    return { ok: true, finished: false };
  }

  /** COURSE-07, or leaving the room mid-race. False if they weren't racing. */
  abandon(userId: string, now: number): boolean {
    const runner = this.runners.get(userId);
    if (!runner || runner.status !== "racing") {
      return false;
    }
    this.end(runner, "abandoned", Math.max(now, this.startsAt));
    return true;
  }

  /** Samples each runner's WPM about once a second; call it often. */
  tick(now: number): void {
    if (now < this.startsAt) {
      return;
    }
    for (const runner of this.runners.values()) {
      if (runner.status !== "racing") {
        continue;
      }
      const elapsed = this.elapsed(runner, now);
      const last = runner.series.at(-1)?.t ?? 0;
      if (elapsed - last >= SAMPLE_MS) {
        runner.series.push({ t: elapsed, wpm: this.wpm(runner, now) });
      }
    }
  }

  track(now: number): TrackEntry[] {
    return [...this.runners.values()].map((runner) => ({
      userId: runner.userId,
      name: runner.name,
      isGuest: runner.isGuest,
      progress: typingProgress(runner.text, this.mode, runner.typing),
      wpm: Math.round(this.wpm(runner, now)),
      status: runner.status,
    }));
  }

  playerState(userId: string): PlayerState | null {
    const runner = this.runners.get(userId);
    if (!runner) {
      return null;
    }
    const { input, keystrokes, correctKeystrokes } = runner.typing;
    return { input, keystrokes, correctKeystrokes };
  }

  /** The final table, once the race is over (COURSE-10, RES-02). */
  results(now: number): ParticipantResult[] {
    const end = this.deadline === null ? now : Math.min(now, this.deadline);
    const entries = [...this.runners.values()].map((runner) => {
      const status: ResultStatus = runner.status === "racing" ? "timeUp" : runner.status;
      const durationMs = Math.max(0, (runner.endedAt ?? end) - this.startsAt);
      const { keystrokes, correctKeystrokes, missed } = runner.typing;
      const wpm = netWpm(correctChars(runner.text, this.mode, runner.typing), durationMs);
      const series = [...runner.series];
      if (series.at(-1)?.t !== durationMs && durationMs > 0) {
        series.push({ t: durationMs, wpm });
      }
      return {
        userId: runner.userId,
        name: runner.name,
        isGuest: runner.isGuest,
        status,
        wpm,
        rawWpm: rawWpm(keystrokes, durationMs),
        accuracy: accuracy(correctKeystrokes, keystrokes),
        errors: keystrokes - correctKeystrokes,
        progress: typingProgress(runner.text, this.mode, runner.typing),
        durationMs,
        wpmSeries: series,
        missedKeys: { ...missed },
      };
    });
    return rank(entries);
  }

  private end(runner: Runner, status: RunnerStatus, now: number): void {
    runner.series.push({ t: this.elapsed(runner, now), wpm: this.wpm(runner, now) });
    runner.status = status;
    runner.endedAt = now;
  }

  private elapsed(runner: Runner, now: number): number {
    const until = runner.endedAt ?? (this.deadline === null ? now : Math.min(now, this.deadline));
    return Math.max(0, until - this.startsAt);
  }

  private wpm(runner: Runner, now: number): number {
    return netWpm(correctChars(runner.text, this.mode, runner.typing), this.elapsed(runner, now));
  }
}
