import { describe, expect, test } from "bun:test";
import { classifyScore, measureComplexity } from "./complexity";
import {
  choosePassageExcerpt,
  lengthTolerance,
  sentenceWindows,
  shapePassage,
  splitSentences,
  stripPunctuation,
} from "./passage-text";
import { createRng } from "./rng";
import { splitWords } from "./text-utils";
import { commonWords } from "./word-pool";
import passages from "@/db/seed/passages.json";

describe("splitSentences", () => {
  test("splits after end marks followed by a capital, dash or quote", () => {
    expect(
      splitSentences('Il part. - Non! dit-elle. "Pourquoi?" demanda-t-il. Fin.'),
    ).toEqual(["Il part.", "- Non! dit-elle.", '"Pourquoi?" demanda-t-il.', "Fin."]);
  });

  test("doesn't split after common abbreviations", () => {
    expect(splitSentences("Mr. Darcy bowed. M. Fogg smiled.")).toEqual([
      "Mr. Darcy bowed.",
      "M. Fogg smiled.",
    ]);
  });
});

describe("sentenceWindows", () => {
  const sentences = ["One two three.", "Four five.", "Six seven eight nine ten.", "Eleven."];

  test("keeps runs of whole sentences near the target length", () => {
    const { fitting } = sentenceWindows(sentences, 5);
    expect(fitting.map((window) => window.wordCount).sort()).toEqual([3, 5, 5, 6, 7]);
    for (const window of fitting) {
      expect(Math.abs(window.wordCount - 5)).toBeLessThanOrEqual(lengthTolerance(5));
    }
  });

  test("gives the closest run when none fits", () => {
    const { fitting, closest } = sentenceWindows(["A b c d e f g h i j k l m n o p."], 4);
    expect(fitting).toEqual([]);
    expect(closest?.wordCount).toBe(16);
  });
});

describe("choosePassageExcerpt", () => {
  const corpus = passages
    .filter((passage) => passage.language === "en")
    .map((passage, index) => ({ id: String(index), content: passage.content }));
  const common = commonWords("en");

  test("returns whole sentences of about the asked length", () => {
    for (const length of [10, 50, 120, 200]) {
      const excerpt = choosePassageExcerpt(
        corpus,
        { language: "en", length, complexity: "medium" },
        common,
        createRng(length),
      );
      const count = splitWords(excerpt?.text ?? "").length;
      expect(Math.abs(count - length)).toBeLessThanOrEqual(lengthTolerance(length));
      expect(excerpt?.text).toMatch(/[.!?]["')]*$/);
    }
  });

  test("prefers excerpts whose score matches the difficulty", () => {
    for (const complexity of ["easy", "medium", "hard"] as const) {
      const excerpt = choosePassageExcerpt(
        corpus,
        { language: "en", length: 50, complexity },
        common,
        createRng(5),
      );
      const { score } = measureComplexity(excerpt?.text ?? "", common);
      expect(classifyScore(score, "en")).toBe(complexity);
    }
  });

  test("returns null without candidates", () => {
    expect(
      choosePassageExcerpt([], { language: "en", length: 50, complexity: "easy" }, common, createRng(1)),
    ).toBeNull();
  });
});

describe("shapePassage", () => {
  const text = "\"Déjà?\" dit-il. L'homme, peut-être - pas.";

  test("keeps the text as is when every toggle is on", () => {
    expect(
      shapePassage(text, { language: "fr", punctuation: true, capitals: true, accents: true }),
    ).toBe(text);
  });

  test("removes punctuation but keeps apostrophes and hyphens inside words", () => {
    expect(stripPunctuation(text)).toBe("Déjà dit-il L'homme peut-être pas");
  });

  test("lowercases and strips accents", () => {
    expect(
      shapePassage(text, { language: "fr", punctuation: false, capitals: false, accents: false }),
    ).toBe("deja dit-il l'homme peut-etre pas");
  });

  test("always strips accents in English", () => {
    expect(
      shapePassage("A café.", { language: "en", punctuation: true, capitals: true, accents: true }),
    ).toBe("A cafe.");
  });
});
