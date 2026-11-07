/**
 * Builds the text data from its sources (see docs/TEXTES.md):
 *   - lib/texts/words/{en,fr}.json: words for random texts, most frequent first
 *   - db/seed/passages.json: passages for coherent texts, loaded by the seed
 * Run with `bun run texts:build`. Downloads are cached in .cache/texts/.
 * The English filter reads macOS's /usr/share/dict, so run it on a Mac.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { COMMON_RANK } from "@/lib/texts/complexity";
import { bookBody, casingCounts, paragraphsOf } from "./texts/books";
import { bookPassages, type Passage } from "./texts/passages";
import {
  BOOKS,
  ENGLISH_DICTIONARY,
  ENGLISH_PROPER_NAMES,
  FREQUENCY_LISTS,
  LEXIQUE_URL,
  bookUrl,
  download,
} from "./texts/sources";
import { buildWordList } from "./texts/word-lists";

/** Per book; about 60 000 words of corpus per language. */
const PASSAGES_PER_BOOK = 60;

function writeJson(path: string, data: unknown): void {
  const full = join(process.cwd(), path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, `${JSON.stringify(data, null, 1)}\n`);
  console.log(`wrote ${path}`);
}

function englishDictionary(): { words: Set<string>; names: Set<string> } {
  const words = new Set(
    readFileSync(ENGLISH_DICTIONARY, "utf8")
      .split("\n")
      .filter((word) => word.length > 0 && word === word.toLowerCase()),
  );
  const names = new Set(
    readFileSync(ENGLISH_PROPER_NAMES, "utf8")
      .split("\n")
      .map((name) => name.trim().toLowerCase()),
  );
  return { words, names };
}

async function frenchDictionary(): Promise<Set<string>> {
  const path = await download(LEXIQUE_URL, "Lexique383.tsv");
  const words = new Set<string>();
  for (const line of readFileSync(path, "utf8").split("\n").slice(1)) {
    const [form, , , category] = line.split("\t");
    // ONO is onomatopoeia ("aah", "hop").
    if (form && category && category !== "ONO") {
      words.add(form);
    }
  }
  return words;
}

function quantile(sorted: number[], ratio: number): number {
  return sorted[Math.floor((sorted.length - 1) * ratio)] ?? 0;
}

async function main(): Promise<void> {
  const allPassages: Passage[] = [];

  for (const language of LOCALES) {
    const books = BOOKS.filter((book) => book.language === language);
    const paragraphsByBook = new Map<number, string[]>();
    const casing = new Map<string, { lower: number; upper: number }>();
    for (const book of books) {
      const path = await download(bookUrl(book), `pg${book.gutenbergId}.txt`);
      const paragraphs = paragraphsOf(bookBody(readFileSync(path, "utf8")));
      paragraphsByBook.set(book.gutenbergId, paragraphs);
      casingCounts(paragraphs, casing);
    }

    const frequencyList = readFileSync(
      await download(FREQUENCY_LISTS[language], `${language}_50k.txt`),
      "utf8",
    );
    const english = language === "en" ? englishDictionary() : null;
    const words = buildWordList({
      language,
      frequencyList,
      casing,
      dictionary: english ? english.words : await frenchDictionary(),
      properNames: english?.names,
    });
    writeJson(`lib/texts/words/${language}.json`, words);

    const common = new Set(words.slice(0, COMMON_RANK));
    const passages = books.flatMap((book) =>
      bookPassages(
        book,
        paragraphsByBook.get(book.gutenbergId) ?? [],
        common,
        PASSAGES_PER_BOOK,
      ),
    );
    allPassages.push(...passages);
    report(language, words, passages);
  }

  writeJson("db/seed/passages.json", allPassages);
}

function report(language: Locale, words: string[], passages: Passage[]): void {
  const scores = passages.map((passage) => passage.score).sort((a, b) => a - b);
  const byLevel = Object.groupBy(passages, (passage) => passage.complexity);
  console.log(
    `${language}: ${words.length} words, ${passages.length} passages;`,
    `score thirds at ${quantile(scores, 1 / 3)} / ${quantile(scores, 2 / 3)};`,
    `easy ${byLevel.easy?.length ?? 0}, medium ${byLevel.medium?.length ?? 0},`,
    `hard ${byLevel.hard?.length ?? 0}`,
  );
}

await main();
