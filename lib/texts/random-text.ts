import type { RaceConfig } from "@/lib/rooms/settings";
import { chance, pick, randomInt, type Rng } from "./rng";
import { buildWordPool, characterFilter } from "./word-pool";

/** Weighted by repetition: mostly periods and commas. */
const END_MARKS = [".", ".", ".", ".", "?", "!"];
const MID_MARKS = [",", ",", ",", ",", ";", ":"];
const DIGITS = "0123456789";

const NUMBER_RATE = 0.1;
const MID_MARK_RATE = 0.12;
const CAPITAL_RATE = 0.08;
const SENTENCE_MIN = 5;
const SENTENCE_MAX = 12;

function capitalize(word: string): string {
  const [first = "", ...rest] = word;
  return first.toUpperCase() + rest.join("");
}

function randomNumber(rng: Rng, digits: string[]): string {
  const length = randomInt(rng, 1, 4);
  const leading = length > 1 ? digits.filter((d) => d !== "0") : digits;
  let number = pick(rng, leading.length > 0 ? leading : digits);
  for (let index = 1; index < length; index++) {
    number += pick(rng, digits);
  }
  return number;
}

/**
 * Null when the filters leave no word at all. Excluded characters never
 * appear, punctuation and digits included.
 */
export function generateRandomText(
  config: RaceConfig,
  rng: Rng,
  words?: readonly string[],
): string | null {
  const pool = buildWordPool(config, words);
  if (pool.length === 0) {
    return null;
  }
  const { exclude } = characterFilter(config);
  const endMarks = END_MARKS.filter((mark) => !exclude.has(mark));
  const midMarks = MID_MARKS.filter((mark) => !exclude.has(mark));
  const digits = [...DIGITS].filter((digit) => !exclude.has(digit));

  const tokens: string[] = [];
  let sentenceLeft = randomInt(rng, SENTENCE_MIN, SENTENCE_MAX);
  let sentenceStart = true;
  let previous = "";

  for (let index = 0; index < config.length; index++) {
    const last = index === config.length - 1;
    let token: string;
    if (config.numbers && digits.length > 0 && chance(rng, NUMBER_RATE)) {
      token = randomNumber(rng, digits);
    } else {
      token = pick(rng, pool);
      while (pool.length > 1 && token === previous) {
        token = pick(rng, pool);
      }
      if (config.capitals && (sentenceStart || chance(rng, CAPITAL_RATE))) {
        token = capitalize(token);
      }
    }
    previous = token.toLowerCase();
    sentenceStart = false;

    if (config.punctuation) {
      sentenceLeft--;
      if ((sentenceLeft <= 0 || last) && endMarks.length > 0) {
        token += pick(rng, endMarks);
        sentenceStart = true;
        sentenceLeft = randomInt(rng, SENTENCE_MIN, SENTENCE_MAX);
      } else if (!last && midMarks.length > 0 && chance(rng, MID_MARK_RATE)) {
        token += pick(rng, midMarks);
      }
    }
    tokens.push(token);
  }
  return tokens.join(" ");
}
