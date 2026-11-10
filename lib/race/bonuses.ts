import { pick, type Rng } from "@/lib/texts/rng";

/**
 * Catch-up bonuses as pure rules. Each checkpoint helps the trailing
 * runners and slows the leaders:
 * - rain: the trailing runners' text gets shorter;
 * - night: the leaders' text gets longer;
 * - glare: the leaders' next words are hidden for a moment.
 */
export const BONUS_KINDS = ["rain", "night", "glare"] as const;

export type BonusKind = (typeof BONUS_KINDS)[number];

export const HINDRANCES = ["night", "glare"] as const satisfies readonly BonusKind[];

/** The leader's progress that fires a bonus, each once per race. */
export const CHECKPOINTS = [0.25, 0.5, 0.75] as const;

export const MAX_BONUSES_PER_RUNNER = 3;

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

export type Standing = {
  userId: string;
  progress: number;
  racing: boolean;
  received: number;
  removable: number;
};

export type BonusTarget = { userId: string; words: number };

/** `words` is 0 for glare. */
export type BonusPlan = { kind: BonusKind; targets: BonusTarget[] };

export function shareOfWords(share: number, baseWords: number): number {
  return Math.max(1, Math.round(share * baseWords));
}

/** The leader never trails, so a lone runner gets nothing. */
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

/** A trailing runner is never a leader: a runner gets a bonus or a hindrance, never both. */
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

export function planBonuses(
  standings: readonly Standing[],
  baseWords: number,
  rng: Rng,
): BonusPlan[] {
  const plans: BonusPlan[] = [];

  const rainWords = shareOfWords(RAIN_SHARE, baseWords);
  const rain = trailingRunners(standings)
    .filter((standing) => underCap(standing) && standing.removable > 0)
    .map((standing) => ({
      userId: standing.userId,
      words: Math.min(rainWords, standing.removable),
    }));
  if (rain.length > 0) {
    plans.push({ kind: "rain", targets: rain });
  }

  // Places count among all leaders, so a capped 1st doesn't move 2nd up to 7%.
  const leading = leadingRunners(standings);
  const hindered = leading.filter(underCap);
  if (hindered.length > 0) {
    const kind = pick(rng, HINDRANCES);
    plans.push({
      kind,
      targets: hindered.map((standing) => ({
        userId: standing.userId,
        words:
          kind === "night"
            ? shareOfWords(NIGHT_SHARES[leading.indexOf(standing)] ?? 0, baseWords)
            : 0,
      })),
    });
  }
  return plans;
}

function cursorWord(text: string, inputLength: number): number {
  return text.slice(0, inputLength).split(" ").length - 1;
}

export function removableWords(text: string, inputLength: number): number {
  const words = text.split(" ").length;
  const keep = cursorWord(text, inputLength) + 1 + RAIN_MARGIN_WORDS;
  return Math.max(0, words - keep);
}

/** Always leaves at least one word. */
export function removeLastWords(
  text: string,
  count: number,
): { text: string; removed: string } {
  const words = text.split(" ");
  const keep = Math.max(1, words.length - count);
  return { text: words.slice(0, keep).join(" "), removed: words.slice(keep).join(" ") };
}

/** Words cut by a new rain go before those cut earlier, as in the text. */
export function joinRemoved(cut: string, before: string): string {
  return [cut, before].filter((part) => part.length > 0).join(" ");
}

export function appendWords(text: string, words: readonly string[]): string {
  return words.length === 0 ? text : `${text} ${words.join(" ")}`;
}

/** [start, end) character indexes. */
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
