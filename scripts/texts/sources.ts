import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Locale } from "@/lib/i18n/config";

/** Downloads are kept here (gitignored) so a rebuild doesn't fetch them again. */
export const CACHE_DIR = join(process.cwd(), ".cache", "texts");

/**
 * Word frequencies from OpenSubtitles 2018, by Hermit Dave.
 * CC BY-SA 4.0: https://github.com/hermitdave/FrequencyWords
 */
export const FREQUENCY_LISTS: Record<Locale, string> = {
  en: "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt",
  fr: "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_50k.txt",
};

/**
 * French lexicon with every inflected form and no proper nouns, used to keep
 * only real French words. Lexique 3.83, New & Pallier, CC BY-SA 4.0:
 * http://www.lexique.org
 */
export const LEXIQUE_URL =
  "https://www.lexique.org/databases/Lexique383/Lexique383.tsv";

/** English spelling dictionary that ships with macOS (Webster's 2nd, public domain). */
export const ENGLISH_DICTIONARY = "/usr/share/dict/web2";
export const ENGLISH_PROPER_NAMES = "/usr/share/dict/propernames";

export type Book = {
  gutenbergId: number;
  language: Locale;
  title: string;
  author: string;
};

/** Public-domain books from Project Gutenberg, chosen for varied difficulty. */
export const BOOKS: Book[] = [
  { gutenbergId: 1342, language: "en", title: "Pride and Prejudice", author: "Jane Austen" },
  { gutenbergId: 74, language: "en", title: "The Adventures of Tom Sawyer", author: "Mark Twain" },
  { gutenbergId: 1661, language: "en", title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle" },
  { gutenbergId: 84, language: "en", title: "Frankenstein", author: "Mary Shelley" },
  { gutenbergId: 2701, language: "en", title: "Moby Dick", author: "Herman Melville" },
  { gutenbergId: 800, language: "fr", title: "Le tour du monde en quatre-vingts jours", author: "Jules Verne" },
  { gutenbergId: 4791, language: "fr", title: "Voyage au centre de la Terre", author: "Jules Verne" },
  { gutenbergId: 17489, language: "fr", title: "Les Misérables, tome I : Fantine", author: "Victor Hugo" },
  { gutenbergId: 13951, language: "fr", title: "Les Trois Mousquetaires", author: "Alexandre Dumas" },
  { gutenbergId: 11049, language: "fr", title: "Eugénie Grandet", author: "Honoré de Balzac" },
];

export function bookUrl(book: Book): string {
  return `https://www.gutenberg.org/cache/epub/${book.gutenbergId}/pg${book.gutenbergId}.txt`;
}

export async function download(url: string, fileName: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, fileName);
  if (existsSync(path)) {
    return path;
  }
  console.log(`downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }
  await Bun.write(path, response);
  return path;
}
