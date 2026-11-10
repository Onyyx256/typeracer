import type { Locale } from "@/lib/i18n/config";
import {
  classifyScore,
  measureComplexity,
  type Complexity,
} from "@/lib/texts/complexity";
import { hasDigit, splitWords } from "@/lib/texts/text-utils";
import type { Book } from "./sources";
import { containsSlur } from "./blocklist";
import { isProse, normalizeParagraph } from "./books";

/** A race takes a run of sentences out of a passage, up to LENGTH_MAX (200) words. */
const MIN_WORDS = 60;
const TARGET_WORDS = 220;
const MAX_WORDS = 320;

export type Passage = {
  language: Locale;
  content: string;
  wordCount: number;
  complexity: Complexity;
  score: number;
  hasDigits: boolean;
  sourceTitle: string;
  sourceAuthor: string;
  sourceRef: string;
};

/**
 * Groups consecutive prose paragraphs into passages of about TARGET_WORDS.
 * A heading or a paragraph that can't be typed ends the current passage, so
 * a passage never jumps over a chapter break.
 */
export function chunkParagraphs(paragraphs: string[]): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let count = 0;

  const close = () => {
    if (count >= MIN_WORDS) {
      chunks.push(current.join(" "));
    }
    current = [];
    count = 0;
  };

  for (const raw of paragraphs) {
    const paragraph = normalizeParagraph(raw);
    if (!isProse(paragraph)) {
      close();
      continue;
    }
    const words = splitWords(paragraph).length;
    if (words > MAX_WORDS) {
      // A very long paragraph is skipped rather than cut mid-thought.
      close();
      continue;
    }
    if (count + words > MAX_WORDS) {
      close();
    }
    current.push(paragraph);
    count += words;
    if (count >= TARGET_WORDS) {
      close();
    }
  }
  close();
  return chunks;
}

/** Up to `limit` passages spread evenly through the book, not just its opening. */
export function bookPassages(
  book: Book,
  paragraphs: string[],
  commonWords: ReadonlySet<string>,
  limit: number,
): Passage[] {
  const chunks = chunkParagraphs(paragraphs);
  const step = Math.max(1, chunks.length / limit);
  const passages: Passage[] = [];
  let next = 0;

  for (let position = 0; position < chunks.length && passages.length < limit; position += step) {
    // A chunk with a slur gives way to the next clean one, so the other
    // picks keep their source refs and old races keep their text.
    let index = Math.max(Math.floor(position), next);
    while (index < chunks.length && containsSlur(chunks[index] ?? "", book.language)) {
      index += 1;
    }
    const content = chunks[index];
    if (content === undefined) {
      break;
    }
    next = index + 1;
    const { score } = measureComplexity(content, commonWords);
    passages.push({
      language: book.language,
      content,
      wordCount: splitWords(content).length,
      complexity: classifyScore(score, book.language),
      score: Math.round(score * 100) / 100,
      hasDigits: hasDigit(content),
      sourceTitle: book.title,
      sourceAuthor: book.author,
      sourceRef: `gutenberg:${book.gutenbergId}:${index}`,
    });
  }
  return passages;
}
