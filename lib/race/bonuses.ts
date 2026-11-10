import { pick, type Rng } from "@/lib/texts/rng";

/**
 * Catch-up bonuses (BONUS-01, BONUS-02), as pure rules: the engine gives
 * the standings and a seeded random generator, and gets back who receives
 * what. The flower theme gives the three effects:
 * - rain: rain and sun, the trailing runners' text gets shorter;
 * - night: the leaders' text gets longer;
 * - glare: a blinding sun hides the leaders' next words for a moment.
 */
export const BONUS_KINDS = ["rain", "night", "glare"] as const;

export type BonusKind = (typeof BONUS_KINDS)[number];

/** The leader's progress that fires a bonus, each once per race. */
export const CHECKPOINTS = [0.25, 0.5, 0.75] as const;

/** Effects one runner can receive in a race. */
export const MAX_BONUSES_PER_RUNNER = 3;

/** Further behind the leader than this, a runner counts as trailing. */
export const TRAILING_GAP = 0.25;

/** Rain: share of the original text's words taken off the end. */
export const RAIN_SHARE = 0.1;

/** Night: share of the original text's words added, for 1st, 2nd and 3rd. */
export const NIGHT_SHARES = [0.07, 0.05, 0.03] as const;

/** Glare: how long and how many words ahead of the cursor it hides. */
export const GLARE_MS = 5_000;
export const GLARE_WORDS = 3;

/** Words kept after the one being typed, so a rain never cuts what the browser may already have typed. */
export const RAIN_MARGIN_WORDS = 2;

/** One runner's place in the race, as the rules need it. */
export type Standing = {
  userId: string;
  progress: number;
  /** Still typing: neither finished nor abandoned. */
  racing: boolean;
  /** Effects received so far in this race. */
  received: number;
  /** Words a rain could take off their text now (see removableWords). */
  removable: number;
};

export type BonusTarget = { userId: string; words: number };

/** One checkpoint's effect. `words` is 0 for glare. */
export type BonusPlan = { kind: BonusKind; targets: BonusTarget[] };

/** A share of the original text, at least one word. */
export function shareOfWords(share: number, baseWords: number): number {
  return Math.max(1, Math.round(share * baseWords));
}

/**
 * Racing runners who are last, or more than TRAILING_GAP behind the
 * leader. The leader never trails, so a lone runner gets nothing.
 */
export function trailingRunners(standings: readonly Standing[]): Standing[] {
  const leader = Math.max(0, ...standings.map((standing) => standing.progress));
  const leaderId = standings.find((standing) => standing.progress === leader)?.userId;
  const racing = standings.filter((standing) => standing.racing && standing.userId !== leaderId);
  if (racing.length === 0) {
    return [];
  }
  const last = Math.min(...racing.map((standing) => standing.progress));
  return racing.filter(
    (standing) => standing.progress === last || leader - standing.progress > TRAILING_GAP,
  );
}

/**
 * The first places still racing, best first, up to the number of night
 * shares. A trailing runner is never in it: a runner gets a bonus or a
 * hindrance, never both.
 */
export function leadingRunners(standings: readonly Standing[]): Standing[] {
  const trailing = new Set(trailingRunners(standings).map((standing) => standing.userId));
  return standings
    .filter((standing) => standing.racing && !trailing.has(standing.userId))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, NIGHT_SHARES.length);
}

function underCap(standing: Standing): boolean {
  return standing.received < MAX_BONUSES_PER_RUNNER;
}

/**
 * What a checkpoint does: one effect picked at random among those that
 * have someone to apply to, or null when none has. `baseWords` is the
 * original text's word count, the same for everyone.
 */
export function planBonus(
  standings: readonly Standing[],
  baseWords: number,
  rng: Rng,
): BonusPlan | null {
  const rainWords = shareOfWords(RAIN_SHARE, baseWords);
  const rain = trailingRunners(standings)
    .filter((standing) => underCap(standing) && standing.removable > 0)
    .map((standing) => ({
      userId: standing.userId,
      words: Math.min(rainWords, standing.removable),
    }));

  const leading = leadingRunners(standings);
  const night = leading.flatMap((standing, place) =>
    underCap(standing)
      ? [{ userId: standing.userId, words: shareOfWords(NIGHT_SHARES[place] ?? 0, baseWords) }]
      : [],
  );
  const glare = leading
    .filter(underCap)
    .map((standing) => ({ userId: standing.userId, words: 0 }));

  const options: BonusPlan[] = [
    { kind: "rain" as const, targets: rain },
    { kind: "night" as const, targets: night },
    { kind: "glare" as const, targets: glare },
  ].filter((option) => option.targets.length > 0);
  return options.length > 0 ? pick(rng, options) : null;
}

/** Index of the word the cursor is in (or about to start). */
function cursorWord(text: string, inputLength: number): number {
  return text.slice(0, inputLength).split(" ").length - 1;
}

/**
 * How many words a rain can take off the end: everything after the word
 * being typed and RAIN_MARGIN_WORDS more.
 */
export function removableWords(text: string, inputLength: number): number {
  const words = text.split(" ").length;
  const keep = cursorWord(text, inputLength) + 1 + RAIN_MARGIN_WORDS;
  return Math.max(0, words - keep);
}

/** The text without its last `count` words (never fewer than one word left). */
export function removeLastWords(text: string, count: number): string {
  const words = text.split(" ");
  return words.slice(0, Math.max(1, words.length - count)).join(" ");
}

/** The text with these words added at the end. */
export function appendWords(text: string, words: readonly string[]): string {
  return words.length === 0 ? text : `${text} ${words.join(" ")}`;
}

/**
 * Where glare covers: from the cursor to the end of the GLARE_WORDS-th
 * word after it, as [start, end) character indexes.
 */
export function glareRange(text: string, inputLength: number): [number, number] {
  let end = inputLength;
  let words = 0;
  while (end < text.length && words < GLARE_WORDS) {
    end++;
    if (text[end] === " " || end === text.length) {
      words++;
    }
  }
  return [inputLength, end];
}
