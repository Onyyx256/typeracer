import type { Locale } from "@/lib/i18n/config";
import type { COMPLEXITIES } from "@/lib/rooms/settings";
import { lettersOf, splitWords } from "./text-utils";

export type Complexity = (typeof COMPLEXITIES)[number];

/**
 * CONF-05 for random text: which words each difficulty draws from. The rank
 * is the word's place in the language's frequency list (1 = most frequent).
 * Easy is short everyday words, hard is long and less common ones.
 */
export const WORD_TIERS: Record<
  Complexity,
  { minRank: number; maxRank: number; minLength: number; maxLength: number }
> = {
  easy: { minRank: 1, maxRank: 1000, minLength: 2, maxLength: 6 },
  medium: { minRank: 1, maxRank: 5000, minLength: 3, maxLength: 9 },
  hard: { minRank: 500, maxRank: 10000, minLength: 7, maxLength: 30 },
};

/** A word outside the language's most frequent ones counts as uncommon. */
export const COMMON_RANK = 2000;

/** How much the share of uncommon words weighs against the mean word length. */
export const UNCOMMON_WEIGHT = 5;

/**
 * CONF-05 for coherent text: a passage's score is
 *   mean letters per word + UNCOMMON_WEIGHT × share of uncommon words.
 * Below `easy` it is easy, above `hard` it is hard, medium in between.
 * The cut-offs split each language's corpus roughly in thirds (French words
 * are longer, so its cut-offs are higher).
 */
export const SCORE_CUTOFFS: Record<Locale, { easy: number; hard: number }> = {
  en: { easy: 5.4, hard: 5.9 },
  fr: { easy: 6.1, hard: 6.75 },
};

export type ComplexityMeasure = {
  meanLength: number;
  uncommonShare: number;
  score: number;
};

/** The parts of a word that frequency lists know: "l'homme" → ["homme"]. */
function pieces(word: string): string[] {
  return word
    .toLowerCase()
    .split(/['-]/)
    .map(lettersOf)
    .filter((piece) => piece.length > 2);
}

export function measureComplexity(
  text: string,
  commonWords: ReadonlySet<string>,
): ComplexityMeasure {
  const words = splitWords(text);
  const letters = words.reduce((sum, word) => sum + lettersOf(word).length, 0);
  const parts = words.flatMap(pieces);
  const uncommon = parts.filter((part) => !commonWords.has(part)).length;
  const meanLength = words.length > 0 ? letters / words.length : 0;
  const uncommonShare = parts.length > 0 ? uncommon / parts.length : 0;
  return {
    meanLength,
    uncommonShare,
    score: meanLength + UNCOMMON_WEIGHT * uncommonShare,
  };
}

export function classifyScore(score: number, language: Locale): Complexity {
  const cutoffs = SCORE_CUTOFFS[language];
  if (score < cutoffs.easy) {
    return "easy";
  }
  return score > cutoffs.hard ? "hard" : "medium";
}
