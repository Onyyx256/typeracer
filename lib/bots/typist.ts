import { keyFor, KEYBOARD_ROWS } from "@/lib/race/keyboard";
import {
  BACKSPACE,
  correctPrefixLength,
  isComplete,
  type ErrorMode,
  type TypingState,
} from "@/lib/race/typing";
import { createRng, randomInt, type Rng } from "@/lib/texts/rng";
import { BOT_PROFILES, type BotLevel, type BotProfile } from "./levels";

/** The next key a bot presses, `delayMs` after its previous one. */
export type BotKey = { key: string; delayMs: number };

type Step = { kind: "type" | "wrong" | "back"; delayMs: number };

/** Speed multipliers: above 1 is faster. */
const MOOD_MIN = 0.75;
const MOOD_MAX = 1.3;
const BURST_CHANCE = 0.06;
const BURST_SPEED = 1.3;
const LONG_WORD = 8;
const LONG_WORD_SPEED = 0.8;
/** Capitals, digits, punctuation and accents need a reach or a shift. */
const SPECIAL_CHAR_SLOWDOWN = 1.6;

/** In base key times, so pauses scale with the level's speed. */
const START_DELAY = [4, 8] as const;
const HESITATION = [4, 12] as const;
const REACTION = [3, 6] as const;
const BACKSPACE_TIME = 0.8;

/** Free mode: how often an error is fixed right away instead of left behind. */
const FREE_FIX_CHANCE = 0.5;

/**
 * Average time per character, in base key times, of everything above:
 * typing at a varying speed, hesitations, and errors with their
 * correction. Measured over the corpus (lib/bots/typist.test.ts checks
 * the result lands in each level's range), so the base key time can be
 * solved from the WPM a bot aims for.
 */
const CHAR_COST = 1.12;
const HESITATION_COST = 1.4;
/** Strict mode always deletes and retypes; free mode often leaves the error. */
const ERROR_COST: Record<ErrorMode, number> = { strict: 6.5, free: 5.4 };

/** Aims inside the range, so a hard text or a slow day rarely falls out of it. */
const TARGET_SPREAD = 0.8;

export function baseKeyMs(wpm: number, profile: BotProfile, mode: ErrorMode): number {
  const msPerChar = 60_000 / (wpm * 5);
  const cost =
    CHAR_COST + profile.hesitation * HESITATION_COST + profile.errorRate * ERROR_COST[mode];
  return msPerChar / cost;
}

function isSpecial(char: string): boolean {
  return !/^[a-z ]$/.test(char);
}

function between(rng: Rng, [min, max]: readonly [number, number]): number {
  return min + rng() * (max - min);
}

/** A key next to the right one, as a real slip would hit. */
export function wrongKeyFor(expected: string, rng: Rng): string {
  const key = keyFor(expected);
  const rows: readonly (readonly string[])[] = KEYBOARD_ROWS;
  const row = rows.find((candidates) => key !== null && candidates.includes(key)) ?? rows[2] ?? [];
  const at = key === null ? -1 : row.indexOf(key);
  const neighbours = (at < 0 ? [...row] : [row[at - 1], row[at + 1]]).filter(
    (candidate): candidate is string => candidate !== undefined && candidate !== key,
  );
  const slip = neighbours[Math.floor(rng() * neighbours.length)] ?? "x";
  const wrong = /[A-Z]/.test(expected) ? slip.toUpperCase() : slip;
  return wrong === expected ? "x" : wrong;
}

/**
 * A bot's typing, decided one key at a time from the runner's current text
 * and typing state, so a bonus that changes the text mid-race is followed
 * like a human would. Everything random comes from the seed: the same
 * seed, level and keys give the same race.
 */
export class BotTypist {
  readonly level: BotLevel;
  /** The net WPM this bot aims for in this race. */
  readonly targetWpm: number;
  private readonly profile: BotProfile;
  private readonly rng: Rng;
  private readonly keyMs: number;
  private mood = 1;
  private burstWords = 0;
  private wordSpeed = 1;
  private pending: Step[] = [];
  private started = false;

  constructor(options: { level: BotLevel; seed: number; errorMode: ErrorMode }) {
    this.level = options.level;
    this.profile = BOT_PROFILES[options.level];
    this.rng = createRng(options.seed);
    const { minWpm, maxWpm } = this.profile;
    const margin = (1 - TARGET_SPREAD) / 2;
    this.targetWpm = minWpm + (maxWpm - minWpm) * (margin + this.rng() * TARGET_SPREAD);
    this.keyMs = baseKeyMs(this.targetWpm, this.profile, options.errorMode);
  }

  /** Null once the text is done. Glare is the engine's to apply, since it ends mid-key. */
  next(text: string, mode: ErrorMode, typing: TypingState): BotKey | null {
    if (isComplete(text, mode, typing)) {
      return null;
    }
    const step = this.pending.shift() ?? this.plan(text, mode, typing);
    const { delayMs } = step;
    const expected = text[typing.input.length] ?? "";
    if (step.kind === "back") {
      return { key: BACKSPACE, delayMs };
    }
    if (step.kind === "wrong") {
      return { key: wrongKeyFor(expected, this.rng), delayMs };
    }
    // The text ended under a queued key (rain took words off): fix what's left instead.
    if (expected === "") {
      this.pending = [];
      return { key: BACKSPACE, delayMs };
    }
    return { key: expected, delayMs };
  }

  private plan(text: string, mode: ErrorMode, typing: TypingState): Step {
    const position = typing.input.length;
    let lead = 0;
    if (!this.started) {
      this.started = true;
      lead += this.keyMs * between(this.rng, START_DELAY);
    }
    // Only reached if a queued correction was cut short; strict mode needs it gone.
    if (mode === "strict" && correctPrefixLength(text, typing.input) < position) {
      return { kind: "back", delayMs: lead + this.reaction() };
    }
    if (position === 0 || text[position - 1] === " ") {
      lead += this.startWord(text, position);
    }
    const delayMs = lead + this.charMs(text[position] ?? "");
    if (this.rng() >= this.profile.errorRate) {
      return { kind: "type", delayMs };
    }

    if (mode === "strict") {
      this.pending.push({ kind: "back", delayMs: this.keyMs * BACKSPACE_TIME + this.reaction() });
    } else if (this.rng() < FREE_FIX_CHANCE) {
      this.pending.push({ kind: "back", delayMs: this.reaction() });
    } else {
      this.pending.push({ kind: "type", delayMs: this.reaction() });
    }
    return { kind: "wrong", delayMs };
  }

  /** Speed drifts word by word, with bursts and hesitations. Returns a pause, if any. */
  private startWord(text: string, position: number): number {
    const end = text.indexOf(" ", position);
    const word = text.slice(position, end < 0 ? undefined : end);

    this.mood = 1 + (this.mood - 1) * 0.8 + (this.rng() - 0.5) * 0.3;
    this.mood = Math.min(MOOD_MAX, Math.max(MOOD_MIN, this.mood));
    if (this.burstWords > 0) {
      this.burstWords--;
    } else if (this.rng() < BURST_CHANCE) {
      this.burstWords = randomInt(this.rng, 2, 5);
    }

    let speed = this.mood * (this.burstWords > 0 ? BURST_SPEED : 1);
    if (word.length >= LONG_WORD) {
      speed *= LONG_WORD_SPEED;
    }
    this.wordSpeed = speed;

    const hesitates = this.rng() < this.profile.hesitation;
    return hesitates ? this.keyMs * between(this.rng, HESITATION) : 0;
  }

  private charMs(char: string): number {
    const jitter = 0.75 + this.rng() * 0.5;
    const reach = isSpecial(char) ? SPECIAL_CHAR_SLOWDOWN : 1;
    return (this.keyMs * reach * jitter) / this.wordSpeed;
  }

  private reaction(): number {
    return this.keyMs * between(this.rng, REACTION);
  }
}
