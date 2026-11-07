import type { Locale } from "@/lib/i18n/config";
import { BLOCKLIST } from "./blocklist";

/** How many words each list keeps, most frequent first. */
export const WORD_LIST_SIZE = 10000;

type Casing = Map<string, { lower: number; upper: number }>;

const LETTERS: Record<Locale, RegExp> = {
  en: /^[a-z]+$/,
  fr: /^[a-zàâäçéèêëîïôöùûüÿ]+$/,
};

const SINGLE_LETTER_WORDS: Record<Locale, string[]> = {
  en: ["a"],
  fr: ["a", "à", "y"],
};

/**
 * Two-letter tokens are mostly subtitle noise (other languages, sounds,
 * abbreviations), so only these real words are kept.
 */
const TWO_LETTER_WORDS: Record<Locale, Set<string>> = {
  en: new Set(
    `to it of is in we me he my on do no be so go if up at oh as an us or by am
    hi ad ex ye lo ox ax pi`.split(/\s+/),
  ),
  fr: new Set(
    `de je le la tu un et il ne en on ça ce ai me si du te au va as se ma es où
    là ou sa ta vu eu dû pu ni an or su lu bu os né nu çà ci ri us`.split(/\s+/),
  ),
};

/** Common irregular forms the old Webster's list doesn't have. */
const ENGLISH_IRREGULAR = new Set(
  `am is are was were been has had did does done went gone saw seen said made
  came come took taken gave given got gotten knew known thought brought bought
  caught taught fought sought found told sold held kept slept felt left lost
  met led fed fled meant sent spent built heard stood understood began begun
  ran sat ate eaten drank drunk drove driven wrote written rode ridden rose
  risen spoke spoken broke broken chose chosen froze frozen stole stolen woke
  wore worn tore torn swore sworn born knew grew grown threw thrown flew flown
  drew drawn blew blown shook shaken forgot forgotten hid hidden bit bitten
  fell fallen sang sung rang rung swam sank sunk won hung struck stuck dug sat
  laid lay paid shot lit slid shone wept swept crept dealt men women children
  feet teeth mice geese people wives knives lives leaves wolves halves shelves
  thieves themselves ourselves yourselves better best worse worst less least
  more most these those box proud`.split(/\s+/),
);

/** A word that books capitalize far more often than not is a name. */
function looksLikeName(word: string, casing: Casing): boolean {
  const entry = casing.get(word);
  return entry !== undefined && entry.upper >= 3 && entry.upper > 3 * entry.lower;
}

function seenInLowercase(word: string, casing: Casing): boolean {
  return (casing.get(word)?.lower ?? 0) >= 2;
}

const ENGLISH_SUFFIXES: [string, string][] = [
  ["ies", "y"], ["ied", "y"], ["ier", "y"], ["iest", "y"], ["ily", "y"],
  ["es", ""], ["s", ""], ["ed", ""], ["ed", "e"], ["d", ""], ["ing", ""],
  ["ing", "e"], ["er", ""], ["er", "e"], ["est", ""], ["ly", ""],
];

/** True when the word, or the word without a regular ending, is in the dictionary. */
function inEnglishDictionary(word: string, dictionary: Set<string>): boolean {
  if (dictionary.has(word) || ENGLISH_IRREGULAR.has(word)) {
    return true;
  }
  return ENGLISH_SUFFIXES.some(([suffix, replacement]) => {
    if (!word.endsWith(suffix) || word.length - suffix.length < 2) {
      return false;
    }
    const stem = word.slice(0, -suffix.length) + replacement;
    // stopped → stopp → stop
    const undoubled =
      stem.length > 2 && stem.at(-1) === stem.at(-2) ? stem.slice(0, -1) : stem;
    return dictionary.has(stem) || dictionary.has(undoubled);
  });
}

export type WordListInput = {
  language: Locale;
  /** "word count" lines, most frequent first. */
  frequencyList: string;
  casing: Casing;
  /** Lowercase spellings the language's dictionary knows. */
  dictionary: Set<string>;
  /** Only used for English: names in the system list. */
  properNames?: Set<string>;
};

/** Frequent words that a dictionary knows and that aren't names, slang or swear words. */
export function buildWordList({
  language,
  frequencyList,
  casing,
  dictionary,
  properNames = new Set(),
}: WordListInput): string[] {
  const blocked = new Set(BLOCKLIST[language]);
  const words: string[] = [];
  const seen = new Set<string>();

  for (const line of frequencyList.split("\n")) {
    const word = line.split(" ")[0]?.trim() ?? "";
    if (!LETTERS[language].test(word) || seen.has(word) || blocked.has(word)) {
      continue;
    }
    // Other one-letter tokens are subtitle noise ("I" is always a capital).
    if (word.length === 1 && !SINGLE_LETTER_WORDS[language].includes(word)) {
      continue;
    }
    if (word.length === 2 && !TWO_LETTER_WORDS[language].has(word)) {
      continue;
    }
    if (looksLikeName(word, casing)) {
      continue;
    }
    const known =
      language === "fr"
        ? dictionary.has(word)
        : seenInLowercase(word, casing) ||
          (inEnglishDictionary(word, dictionary) &&
            !(properNames.has(word) && !dictionary.has(word)));
    if (!known) {
      continue;
    }
    seen.add(word);
    words.push(word);
    if (words.length === WORD_LIST_SIZE) {
      break;
    }
  }
  return words;
}
