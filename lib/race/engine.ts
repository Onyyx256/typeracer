import type { BotLevel } from "@/lib/bots/levels";
import { BotTypist, type BotKey } from "@/lib/bots/typist";
import { createRng, type Rng } from "@/lib/texts/rng";
import {
  appendWords,
  CHECKPOINTS,
  GLARE_MS,
  joinRemoved,
  planBonuses,
  removableWords,
  removeLastWords,
  type BonusKind,
  type Standing,
} from "./bonuses";
import type { ErrorMode, TypingState } from "./typing";
import {
  applyKey,
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
 * Pure: every method takes the current time, so tests drive the clock.
 * lib/race/manager.ts runs it with real timers.
 */

export const COUNTDOWN_MS = 3_000;

export const SAMPLE_MS = 1_000;

/**
 * Speed check: keys refill at this rate, up to a small burst, and a batch
 * needing more than what's left is refused. 25 keys/s is 300 WPM held
 * for good, above the best human typists; the burst covers messages that
 * arrive bunched up after a network hiccup.
 */
export const MAX_KEYS_PER_SECOND = 25;
export const BURST_KEYS = 40;
export const START_KEYS = 8;

/**
 * How late a batch may arrive and still be judged on when it was typed.
 * A network stall holds messages and delivers them together; within this
 * window they are forgiven, older ones count as typed this long ago.
 */
export const MAX_LAG_MS = 10_000;

/** Per message; the browser sends about every 150 ms. */
export const MAX_KEYS_PER_BATCH = 60;

export const EFFECT_SHOW_MS = 3_000;

export type BotSetup = { level: BotLevel; seed: number };

export type RaceParticipant = {
  userId: string;
  name: string;
  isGuest: boolean;
  /** Set for a bot: the engine types for it. */
  bot?: BotSetup;
};

/** What the track and the results show of a runner. */
export type RunnerIdentity = {
  userId: string;
  name: string;
  isGuest: boolean;
  botLevel: BotLevel | null;
};

export type RunnerStatus = "racing" | "finished" | "abandoned";

type BotRun = { typist: BotTypist; next: BotKey | null; at: number };

type Runner = RunnerIdentity & {
  bot: BotRun | null;
  /** Bonuses make it shorter or longer. */
  text: string;
  /** Words rain took off the end, in text order, shown crossed out. */
  removed: string;
  typing: TypingState;
  status: RunnerStatus;
  endedAt: number | null;
  series: WpmPoint[];
  tokens: number;
  tokensAt: number;
  bonuses: BonusKind[];
  effect: { kind: BonusKind; until: number } | null;
  /** Next word of the reserve that a night adds to this runner. */
  reserveAt: number;
};

export type BonusOptions = { seed: number; reserve: string };

export type BonusEvent = {
  kind: BonusKind;
  targets: string[];
  texts: { userId: string; text: string; removed: string }[];
};

export type KeysResult =
  | { ok: true; finished: boolean }
  | { ok: false; reason: "notRacing" | "tooFast" | "tooMany" };

export type TrackEntry = RunnerIdentity & {
  progress: number;
  wpm: number;
  status: RunnerStatus;
  effect: BonusKind | null;
  /**
   * A browser whose text length differs missed a race:text and asks for the
   * race again.
   */
  textLength: number;
};

export type PlayerState = {
  text: string;
  removed: string;
  input: string;
  keystrokes: number;
  correctKeystrokes: number;
};

export type ParticipantResult = RunnerIdentity & {
  rank: number;
  status: ResultStatus;
  wpm: number;
  rawWpm: number;
  accuracy: number | null;
  errors: number;
  progress: number;
  durationMs: number;
  wpmSeries: WpmPoint[];
  missedKeys: Record<string, number>;
  bonuses: BonusKind[];
};

export class Race {
  readonly text: string;
  readonly mode: ErrorMode;
  readonly startsAt: number;
  readonly deadline: number | null;
  private readonly runners = new Map<string, Runner>();
  private readonly bonus: { rng: Rng; reserve: string[]; baseWords: number } | null;
  private fired = 0;

  constructor(options: {
    text: string;
    errorMode: ErrorMode;
    /** In seconds, 0 for none. */
    timeLimit: number;
    participants: readonly RaceParticipant[];
    now: number;
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
    for (const { bot, ...participant } of options.participants) {
      const typing = initialTyping();
      this.runners.set(participant.userId, {
        ...participant,
        botLevel: bot?.level ?? null,
        bot: bot ? this.startBot(bot, typing) : null,
        text: options.text,
        typing,
        status: "racing",
        endedAt: null,
        series: [],
        tokens: START_KEYS,
        tokensAt: this.startsAt,
        removed: "",
        bonuses: [],
        effect: null,
        reserveAt: 0,
      });
    }
  }

  private startBot(setup: BotSetup, typing: TypingState): BotRun {
    const typist = new BotTypist({ ...setup, errorMode: this.mode });
    const next = typist.next(this.text, this.mode, typing);
    return { typist, next, at: this.startsAt + (next?.delayMs ?? 0) };
  }

  isRunner(userId: string): boolean {
    return this.runners.has(userId);
  }

  isTypingOpen(now: number): boolean {
    return now >= this.startsAt && (this.deadline === null || now < this.deadline);
  }

  /**
   * Bots don't keep a race going once no human is left in it: those still
   * typing are ranked by their progress, like at the time limit.
   */
  isOver(now: number): boolean {
    if (this.deadline !== null && now >= this.deadline) {
      return true;
    }
    const runners = [...this.runners.values()];
    const humans = runners.filter((runner) => runner.bot === null);
    return (humans.length > 0 ? humans : runners).every((runner) => runner.status !== "racing");
  }

  /**
   * Replays a batch of keys; refused whole if it's too fast to be typed by
   * hand. The speed is judged on `typedAt`, when the browser says the batch
   * was sent, so messages held up by the network and delivered together
   * aren't taken for fast typing. That time is never trusted beyond the
   * server's clock: no later than now, no earlier than MAX_LAG_MS ago, and
   * never before the previous batch, so it can't be used to refill twice.
   */
  applyKeys(
    userId: string,
    keys: readonly string[],
    now: number,
    typedAt: number = now,
  ): KeysResult {
    const runner = this.runners.get(userId);
    if (!runner || runner.bot || runner.status !== "racing" || !this.isTypingOpen(now)) {
      return { ok: false, reason: "notRacing" };
    }
    if (keys.length > MAX_KEYS_PER_BATCH) {
      return { ok: false, reason: "tooMany" };
    }
    const at = Math.max(runner.tokensAt, Math.min(now, Math.max(now - MAX_LAG_MS, typedAt)));
    const refill = ((at - runner.tokensAt) / 1000) * MAX_KEYS_PER_SECOND;
    const tokens = Math.min(BURST_KEYS, runner.tokens + refill);
    if (keys.length > tokens) {
      return { ok: false, reason: "tooFast" };
    }
    runner.tokens = tokens - keys.length;
    runner.tokensAt = at;

    runner.typing = applyKeys(runner.text, this.mode, runner.typing, keys);
    if (isComplete(runner.text, this.mode, runner.typing)) {
      this.end(runner, "finished", now);
      return { ok: true, finished: true };
    }
    return { ok: true, finished: false };
  }

  /** False if they weren't racing. */
  abandon(userId: string, now: number): boolean {
    const runner = this.runners.get(userId);
    if (!runner || runner.status !== "racing") {
      return false;
    }
    this.end(runner, "abandoned", Math.max(now, this.startsAt));
    return true;
  }

  /**
   * Call it often: types for the bots up to now, samples WPM about once a
   * second and fires the checkpoints.
   */
  tick(now: number): BonusEvent[] {
    if (now < this.startsAt) {
      return [];
    }
    this.advanceBots(now);
    for (const runner of this.runners.values()) {
      if (runner.status !== "racing") {
        continue;
      }
      const elapsed = this.elapsed(runner, now);
      const last = runner.series.at(-1)?.t ?? 0;
      if (elapsed - last >= SAMPLE_MS) {
        runner.series.push(this.sample(runner, now));
      }
    }
    return this.isTypingOpen(now) ? this.fireCheckpoints(now) : [];
  }

  /** Each key lands at the time the bot typed it, even if the tick comes later. */
  private advanceBots(now: number): void {
    const until = this.deadline === null ? now : Math.min(now, this.deadline);
    for (const runner of this.runners.values()) {
      const { bot } = runner;
      while (bot && bot.next && runner.status === "racing" && bot.at <= until) {
        runner.typing = applyKey(runner.text, this.mode, runner.typing, bot.next.key);
        if (isComplete(runner.text, this.mode, runner.typing)) {
          this.end(runner, "finished", bot.at);
          bot.next = null;
          break;
        }
        const glare = runner.effect?.kind === "glare" && bot.at < runner.effect.until;
        bot.next = bot.typist.next(runner.text, this.mode, runner.typing, glare);
        bot.at += bot.next?.delayMs ?? 0;
      }
    }
  }

  private fireCheckpoints(now: number): BonusEvent[] {
    const events: BonusEvent[] = [];
    while (this.bonus && this.fired < CHECKPOINTS.length) {
      const standings = this.standings();
      const leader = Math.max(0, ...standings.map((standing) => standing.progress));
      if (leader < (CHECKPOINTS[this.fired] ?? 1)) {
        break;
      }
      this.fired++;
      for (const plan of planBonuses(standings, this.bonus.baseWords, this.bonus.rng)) {
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
        const cut = removeLastWords(runner.text, target.words);
        runner.text = cut.text;
        runner.removed = joinRemoved(cut.removed, runner.removed);
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
        event.texts.push({ userId: runner.userId, text: runner.text, removed: runner.removed });
      }
    }
    return event;
  }

  track(now: number): TrackEntry[] {
    return [...this.runners.values()].map((runner) => ({
      userId: runner.userId,
      name: runner.name,
      isGuest: runner.isGuest,
      botLevel: runner.botLevel,
      progress: typingProgress(runner.text, this.mode, runner.typing),
      wpm: Math.round(this.wpm(runner, now)),
      status: runner.status,
      effect: runner.effect && now < runner.effect.until ? runner.effect.kind : null,
      textLength: runner.text.length,
    }));
  }

  playerState(userId: string): PlayerState | null {
    const runner = this.runners.get(userId);
    if (!runner) {
      return null;
    }
    const { input, keystrokes, correctKeystrokes } = runner.typing;
    return { text: runner.text, removed: runner.removed, input, keystrokes, correctKeystrokes };
  }

  results(now: number): ParticipantResult[] {
    const end = this.deadline === null ? now : Math.min(now, this.deadline);
    const entries = [...this.runners.values()].map((runner) => {
      const status: ResultStatus = runner.status === "racing" ? "timeUp" : runner.status;
      const durationMs = Math.max(0, (runner.endedAt ?? end) - this.startsAt);
      const { keystrokes, correctKeystrokes, missed } = runner.typing;
      const wpm = netWpm(correctChars(runner.text, this.mode, runner.typing), durationMs);
      const series = [...runner.series];
      if (series.at(-1)?.t !== durationMs && durationMs > 0) {
        series.push({ t: durationMs, wpm, errors: keystrokes - correctKeystrokes });
      }
      return {
        userId: runner.userId,
        name: runner.name,
        isGuest: runner.isGuest,
        botLevel: runner.botLevel,
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
    runner.series.push(this.sample(runner, now));
    runner.status = status;
    runner.endedAt = now;
  }

  private sample(runner: Runner, now: number): WpmPoint {
    const { keystrokes, correctKeystrokes } = runner.typing;
    return { t: this.elapsed(runner, now), wpm: this.wpm(runner, now), errors: keystrokes - correctKeystrokes };
  }

  private elapsed(runner: Runner, now: number): number {
    const until = runner.endedAt ?? (this.deadline === null ? now : Math.min(now, this.deadline));
    return Math.max(0, until - this.startsAt);
  }

  private wpm(runner: Runner, now: number): number {
    return netWpm(correctChars(runner.text, this.mode, runner.typing), this.elapsed(runner, now));
  }
}
