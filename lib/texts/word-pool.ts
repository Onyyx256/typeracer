import type { Locale } from "@/lib/i18n/config";
import type { RaceConfig } from "@/lib/rooms/settings";
import { COMMON_RANK, WORD_TIERS } from "./complexity";
import { hasAccent } from "./text-utils";
import en from "./words/en.json";
import fr from "./words/fr.json";

/** Most frequent first: a word's rank is its index + 1. */
export const WORD_LISTS: Record<Locale, readonly string[]> = { en, fr };

/** Below this, the difficulty tier is dropped so the filters still leave some variety. */
export const MIN_POOL_SIZE = 30;

export type CharacterFilter = {
  /** Lowercase letters; each word must contain at least one of them. */
  include: ReadonlySet<string>;
  /** Lowercase characters that never appear (letters, digits or punctuation). */
  exclude: ReadonlySet<string>;
};

/**
 * CONF-07: the host's include/exclude lists, compared without case.
 * Only letters count for "include"; a character in both lists is excluded.
 */
export function characterFilter(
  config: Pick<RaceConfig, "includeChars" | "excludeChars">,
): CharacterFilter {
  const exclude = new Set([...config.excludeChars.toLowerCase()].filter((c) => c.trim()));
  const include = new Set(
    [...config.includeChars.toLowerCase()].filter(
      (c) => /\p{L}/u.test(c) && !exclude.has(c),
    ),
  );
  return { include, exclude };
}

function allowed(
  word: string,
  accents: boolean,
  { include, exclude }: CharacterFilter,
): boolean {
  if (!accents && hasAccent(word)) {
    return false;
  }
  const letters = [...word];
  if (letters.some((letter) => exclude.has(letter))) {
    return false;
  }
  return include.size === 0 || letters.some((letter) => include.has(letter));
}

/**
 * The words a random text draws from: the difficulty's tier (rank and
 * length, see WORD_TIERS), minus words with accents when they are off and
 * words that fail the include/exclude lists. If that leaves fewer than
 * MIN_POOL_SIZE words, every word of the list that passes the filters is used.
 */
export function buildWordPool(
  config: Pick<
    RaceConfig,
    "language" | "complexity" | "accents" | "includeChars" | "excludeChars"
  >,
  words: readonly string[] = WORD_LISTS[config.language],
): string[] {
  const filter = characterFilter(config);
  const accents = config.language === "fr" && config.accents;
  const tier = WORD_TIERS[config.complexity];
  const passes = (word: string) => allowed(word, accents, filter);

  const pool = words.filter((word, index) => {
    const rank = index + 1;
    const length = [...word].length;
    return (
      rank >= tier.minRank &&
      rank <= tier.maxRank &&
      length >= tier.minLength &&
      length <= tier.maxLength &&
      passes(word)
    );
  });
  return pool.length >= MIN_POOL_SIZE ? pool : words.filter(passes);
}

const commonWordsCache = new Map<Locale, ReadonlySet<string>>();

/** The words that don't count as uncommon in the passage score. */
export function commonWords(language: Locale): ReadonlySet<string> {
  let words = commonWordsCache.get(language);
  if (!words) {
    words = new Set(WORD_LISTS[language].slice(0, COMMON_RANK));
    commonWordsCache.set(language, words);
  }
  return words;
}
