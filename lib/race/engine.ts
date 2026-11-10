import { createRng, type Rng } from "@/lib/texts/rng";
import {
  appendWords,
  CHECKPOINTS,
  GLARE_MS,
  planBonus,
  removableWords,
  removeLastWords,
  type BonusKind,
  type Standing,
} from "./bonuses";
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

/** How long the track shows a rain or a night after it falls (BONUS-03). */
export const EFFECT_SHOW_MS = 3_000;

export type RaceParticipant = {
  userId: string;
  name: string;
  isGuest: boolean;
};

export type RunnerStatus = "racing" | "finished" | "abandoned";

type Runner = RaceParticipant & {
  /** Per runner: catch-up bonuses make it shorter or longer (BONUS-04). */
  text: string;
  typing: TypingState;
  status: RunnerStatus;
  /** When they finished or abandoned. */
  endedAt: number | null;
  series: WpmPoint[];
  tokens: number;
  tokensAt: number;
  /** Effects received, in order (RES-02). */
  bonuses: BonusKind[];
  /** The latest one, shown until `until` (BONUS-03). */
  effect: { kind: BonusKind; until: number } | null;
  /** Next word of the reserve that a night adds to this runner. */
  reserveAt: number;
};

/** Catch-up bonuses on (CONF-09): a seed for the random picks and words that night adds. */
export type BonusOptions = { seed: number; reserve: string };

/** What a checkpoint did, for the manager to tell the runners whose text changed. */
export type BonusEvent = {
  kind: BonusKind;
  targets: string[];
  /** New texts, for rain and night. */
  texts: { userId: string; text: string }[];
};

export type KeysResult =
  | { ok: true; finished: boolean }
  | { ok: false; reason: "notRacing" | "tooFast" | "tooMany" };

/** One line of the live track (COURSE-05). */
export type TrackEntry = RaceParticipant & {
  progress: number;
  wpm: number;
  status: RunnerStatus;
  /** An effect that just fell on them, or glare while it lasts (BONUS-03). */
  effect: BonusKind | null;
};

/** A runner's own text and typing, sent back to their browser to resync it. */
export type PlayerState = {
  text: string;
  input: string;
  keystrokes: number;
  correctKeystrokes: number;
};

export type ParticipantResult = RaceParticipant & {
  rank: number;
  status: ResultStatus;
  wpm: number;
  rawWpm: number;
  /** Null for someone who gave up (COURSE-07). */
  accuracy: number | null;
  errors: number;
  progress: number;
  durationMs: number;
  wpmSeries: WpmPoint[];
  missedKeys: Record<string, number>;
  /** Effects received, in order (RES-02). */
  bonuses: BonusKind[];
};

export class Race {
  readonly text: string;
  readonly mode: ErrorMode;
  /** When the countdown ends and typing opens. */
  readonly startsAt: number;
  /** When the time limit ends the race, or null without a limit (CONF-01). */
  readonly deadline: number | null;
  private readonly runners = new Map<string, Runner>();
  /** Null when bonuses are off. */
  private readonly bonus: { rng: Rng; reserve: string[]; baseWords: number } | null;
  /** Checkpoints already passed by the leader. */
  private fired = 0;

  constructor(options: {
    text: string;
    errorMode: ErrorMode;
    /** In seconds, 0 for none. */
    timeLimit: number;
    participants: readonly RaceParticipant[];
    /** When the countdown starts. */
    now: number;
    /** Null or left out: no catch-up bonuses. */
    bonuses?: BonusOptions | null;
  }) {
    this.text = options.text;
    this.mode = options.errorMode;
    this.startsAt = options.now + COUNTDOWN_MS;
    this.deadline = options.timeLimit > 0 ? this.startsAt + options.timeLimit * 1000 : null;
    const reserve = options.bonuses?.reserve.split(" ").filter((word) => word.length > 0) ?? [];
    this.bonus =
      options.bonuses && reserve.length > 0
        ? { rng: createRng(options.bonuses.seed), reserve, baseWords: this.text.split(" ").length }
        : null;
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
        bonuses: [],
        effect: null,
        reserveAt: 0,
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

  /**
   * Samples each runner's WPM about once a second, and fires the catch-up
   * bonus of each checkpoint the leader passed; call it often.
   */
  tick(now: number): BonusEvent[] {
    if (now < this.startsAt) {
      return [];
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
    return this.isTypingOpen(now) ? this.fireCheckpoints(now) : [];
  }

  /** BONUS-01: once per checkpoint, when the leader's progress reaches it. */
  private fireCheckpoints(now: number): BonusEvent[] {
    const events: BonusEvent[] = [];
    while (this.bonus && this.fired < CHECKPOINTS.length) {
      const standings = this.standings();
      const leader = Math.max(0, ...standings.map((standing) => standing.progress));
      if (leader < (CHECKPOINTS[this.fired] ?? 1)) {
        break;
      }
      this.fired++;
      const plan = planBonus(standings, this.bonus.baseWords, this.bonus.rng);
      if (plan) {
        events.push(this.applyBonus(plan.kind, plan.targets, now));
      }
    }
    return events;
  }

  private standings(): Standing[] {
    return [...this.runners.values()].map((runner) => ({
      userId: runner.userId,
      progress: typingProgress(runner.text, this.mode, runner.typing),
      racing: runner.status === "racing",
      received: runner.bonuses.length,
      removable: removableWords(runner.text, runner.typing.input.length),
    }));
  }

  private applyBonus(
    kind: BonusKind,
    targets: readonly { userId: string; words: number }[],
    now: number,
  ): BonusEvent {
    const event: BonusEvent = { kind, targets: [], texts: [] };
    for (const target of targets) {
      const runner = this.runners.get(target.userId);
      if (!runner) {
        continue;
      }
      if (kind === "rain") {
        runner.text = removeLastWords(runner.text, target.words);
      } else if (kind === "night" && this.bonus) {
        const { reserve } = this.bonus;
        const words = Array.from(
          { length: target.words },
          (_, index) => reserve[(runner.reserveAt + index) % reserve.length] ?? "",
        );
        runner.reserveAt += target.words;
        runner.text = appendWords(runner.text, words);
      }
      runner.bonuses.push(kind);
      runner.effect = { kind, until: now + (kind === "glare" ? GLARE_MS : EFFECT_SHOW_MS) };
      event.targets.push(runner.userId);
      if (kind !== "glare") {
        event.texts.push({ userId: runner.userId, text: runner.text });
      }
    }
    return event;
  }

  track(now: number): TrackEntry[] {
    return [...this.runners.values()].map((runner) => ({
      userId: runner.userId,
      name: runner.name,
      isGuest: runner.isGuest,
      progress: typingProgress(runner.text, this.mode, runner.typing),
      wpm: Math.round(this.wpm(runner, now)),
      status: runner.status,
      effect: runner.effect && now < runner.effect.until ? runner.effect.kind : null,
    }));
  }

  playerState(userId: string): PlayerState | null {
    const runner = this.runners.get(userId);
    if (!runner) {
      return null;
    }
    const { input, keystrokes, correctKeystrokes } = runner.typing;
    return { text: runner.text, input, keystrokes, correctKeystrokes };
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
        accuracy: status === "abandoned" ? null : accuracy(correctKeystrokes, keystrokes),
        errors: keystrokes - correctKeystrokes,
        progress: typingProgress(runner.text, this.mode, runner.typing),
        durationMs,
        wpmSeries: series,
        missedKeys: { ...missed },
        bonuses: [...runner.bonuses],
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
