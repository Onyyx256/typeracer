import { splitWords } from "@/lib/texts/text-utils";

/** Only what a French or English keyboard types directly (no «», curly quotes, œ...). */
const TYPABLE = /^[A-Za-zÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸàâäçéèêëîïôöùûüÿ0-9 .,;:!?'"()-]+$/;

export function bookBody(raw: string): string {
  const text = raw.replace(/\r\n?/g, "\n");
  const start = text.search(/^\*\*\* ?START OF TH(E|IS) PROJECT GUTENBERG.*$/m);
  const end = text.search(/^\*\*\* ?END OF TH(E|IS) PROJECT GUTENBERG.*$/m);
  if (start === -1 || end === -1) {
    throw new Error("Gutenberg start/end markers not found.");
  }
  return text.slice(text.indexOf("\n", start) + 1, end);
}

/** Paragraphs are separated by blank lines; their lines are joined back together. */
export function paragraphsOf(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, " ").trim())
    .filter((block) => block.length > 0);
}

/**
 * Rewrites typography into plain keyboard characters: straight quotes,
 * "..." for ellipses, " - " for dashes, oe/ae ligatures spelled out, and no
 * space before punctuation (French editions disagree on it, so pick one).
 */
export function normalizeParagraph(paragraph: string): string {
  return paragraph
    .replace(/_/g, "") // _italics_
    .replace(/[  ]/g, " ")
    .replace(/«\s*/g, '"')
    .replace(/\s*»/g, '"')
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/,\s*(--+|[—–])\s*/g, ", ")
    .replace(/\s*(--+|[—–])\s*/g, " - ")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "Oe")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "Ae")
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+/g, " ")
    .replace(/^- /, "")
    .trim();
}

export function isProse(paragraph: string): boolean {
  if (!TYPABLE.test(paragraph)) {
    return false;
  }
  const words = splitWords(paragraph);
  if (words.length < 4 || !/[.!?]["')]?$/.test(paragraph)) {
    return false;
  }
  const letters = paragraph.replace(/[^\p{L}]/gu, "");
  // Chapter titles and the like are written in capitals.
  if (letters === letters.toUpperCase()) {
    return false;
  }
  return !/^(chapter|chapitre|livre|book)\b/i.test(paragraph);
}

/**
 * Counts how often each word appears in lowercase versus capitalized in the
 * middle of a sentence. Names are almost always capitalized, which tells
 * them apart from real words.
 */
export function casingCounts(
  paragraphs: string[],
  counts: Map<string, { lower: number; upper: number }>,
): void {
  for (const paragraph of paragraphs) {
    const words = splitWords(paragraph);
    for (let index = 1; index < words.length; index++) {
      const previous = words[index - 1] ?? "";
      // The first word of a sentence is capitalized anyway.
      if (/[.!?:"]$/.test(previous)) {
        continue;
      }
      const word = (words[index] ?? "").replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
      if (!/^\p{L}+$/u.test(word)) {
        continue;
      }
      const key = word.toLowerCase();
      const entry = counts.get(key) ?? { lower: 0, upper: 0 };
      if (word === key) {
        entry.lower++;
      } else {
        entry.upper++;
      }
      counts.set(key, entry);
    }
  }
}
