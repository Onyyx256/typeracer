import type { RaceConfig } from "@/lib/rooms/settings";
import { classifyScore, measureComplexity } from "./complexity";
import { pick, type Rng } from "./rng";
import { splitWords, stripAccents } from "./text-utils";

/** A period after these doesn't end the sentence. */
const ABBREVIATIONS = new Set([
  "mr.", "mrs.", "dr.", "st.", "jr.", "sr.", "messrs.", "m.", "mm.", "mme.",
  "mlle.",
]);

/** A sentence ends at . ! or ? followed by a non-lowercase word. */
export function splitSentences(content: string): string[] {
  const words = splitWords(content);
  const sentences: string[] = [];
  let current: string[] = [];

  words.forEach((word, index) => {
    current.push(word);
    const next = words[index + 1];
    const ends =
      /[.!?]["')]*$/.test(word) &&
      !ABBREVIATIONS.has(word.toLowerCase()) &&
      (next === undefined || !/^\p{Ll}/u.test(next));
    if (ends) {
      sentences.push(current.join(" "));
      current = [];
    }
  });
  if (current.length > 0) {
    sentences.push(current.join(" "));
  }
  return sentences;
}

/** 15 %, at least 2 words. */
export function lengthTolerance(target: number): number {
  return Math.max(2, Math.round(target * 0.15));
}

export type SentenceWindow = { text: string; wordCount: number };

/** If no run is within tolerance, the single closest one, so a passage always gives something. */
export function sentenceWindows(
  sentences: string[],
  target: number,
): { fitting: SentenceWindow[]; closest: SentenceWindow | null } {
  const counts = sentences.map((sentence) => splitWords(sentence).length);
  const tolerance = lengthTolerance(target);
  const fitting: SentenceWindow[] = [];
  let closest: SentenceWindow | null = null;

  for (let start = 0; start < sentences.length; start++) {
    let total = 0;
    for (let end = start; end < sentences.length; end++) {
      total += counts[end] ?? 0;
      const window = {
        text: sentences.slice(start, end + 1).join(" ").replace(/^- /, ""),
        wordCount: total,
      };
      if (Math.abs(total - target) <= tolerance) {
        fitting.push(window);
      }
      if (!closest || Math.abs(total - target) < Math.abs(closest.wordCount - target)) {
        closest = window;
      }
      if (total > target + tolerance) {
        break;
      }
    }
  }
  return { fitting, closest };
}

export type PassageCandidate = {
  id: string;
  content: string;
};

/**
 * Prefers runs whose own score matches the asked difficulty, then any run
 * of the right length, then the closest length found.
 */
export function choosePassageExcerpt<T extends PassageCandidate>(
  candidates: readonly T[],
  config: Pick<RaceConfig, "language" | "length" | "complexity">,
  common: ReadonlySet<string>,
  rng: Rng,
): { passage: T; text: string } | null {
  const matching: { passage: T; text: string }[] = [];
  const rightLength: { passage: T; text: string }[] = [];
  let closest: { passage: T; window: SentenceWindow } | null = null;

  for (const passage of candidates) {
    const windows = sentenceWindows(splitSentences(passage.content), config.length);
    for (const window of windows.fitting) {
      const { score } = measureComplexity(window.text, common);
      const entry = { passage, text: window.text };
      rightLength.push(entry);
      if (classifyScore(score, config.language) === config.complexity) {
        matching.push(entry);
      }
    }
    const best = windows.closest;
    if (
      best &&
      (!closest ||
        Math.abs(best.wordCount - config.length) <
          Math.abs(closest.window.wordCount - config.length))
    ) {
      closest = { passage, window: best };
    }
  }

  if (matching.length > 0) {
    return pick(rng, matching);
  }
  if (rightLength.length > 0) {
    return pick(rng, rightLength);
  }
  return closest ? { passage: closest.passage, text: closest.window.text } : null;
}

/** Keeps apostrophes and hyphens inside words ("l'homme", "peut-être"). */
export function stripPunctuation(text: string): string {
  return splitWords(text)
    .map((word) =>
      word
        .replace(/[.,;:!?"()]/g, "")
        .replace(/^['-]+|['-]+$/g, ""),
    )
    .filter((word) => word.length > 0)
    .join(" ");
}

/** Numbers are handled when choosing the passage. */
export function shapePassage(
  text: string,
  config: Pick<RaceConfig, "language" | "punctuation" | "capitals" | "accents">,
): string {
  let shaped = text;
  if (!config.punctuation) {
    shaped = stripPunctuation(shaped);
  }
  if (!config.capitals) {
    shaped = shaped.toLowerCase();
  }
  if (!(config.language === "fr" && config.accents)) {
    shaped = stripAccents(shaped);
  }
  return shaped;
}
