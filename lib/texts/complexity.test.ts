import { describe, expect, test } from "bun:test";
import { classifyScore, measureComplexity, SCORE_CUTOFFS, UNCOMMON_WEIGHT } from "./complexity";

const COMMON = new Set(["the", "cat", "sat", "homme"]);

describe("measureComplexity", () => {
  test("counts only letters in the mean word length", () => {
    // "the" 3, "cat," 3, "sat." 3.
    expect(measureComplexity("the cat, sat.", COMMON).meanLength).toBe(3);
  });

  test("has no uncommon words when every word is common", () => {
    const measure = measureComplexity("the cat sat", COMMON);
    expect(measure.uncommonShare).toBe(0);
    expect(measure.score).toBe(3);
  });

  test("adds the weighted share of uncommon words to the score", () => {
    const measure = measureComplexity("the cat sat serendipitously", COMMON);
    expect(measure.uncommonShare).toBe(0.25);
    expect(measure.meanLength).toBe((3 + 3 + 3 + 15) / 4);
    expect(measure.score).toBe(measure.meanLength + UNCOMMON_WEIGHT * 0.25);
  });

  test("looks up each part of an elided or hyphenated word, ignoring case", () => {
    // "l'Homme" → "homme" (common); "peut-être" → "peut", "être" (both uncommon).
    const measure = measureComplexity("l'Homme peut-être", COMMON);
    expect(measure.uncommonShare).toBeCloseTo(2 / 3);
  });

  test("ignores parts of two letters or less", () => {
    expect(measureComplexity("a an to the", COMMON).uncommonShare).toBe(0);
  });

  test("is all zeros for an empty text", () => {
    expect(measureComplexity("   ", COMMON)).toEqual({ meanLength: 0, uncommonShare: 0, score: 0 });
  });
});

describe("classifyScore", () => {
  test("splits on the language's cut-offs", () => {
    const { easy, hard } = SCORE_CUTOFFS.en;
    expect(classifyScore(easy - 0.01, "en")).toBe("easy");
    expect(classifyScore(easy, "en")).toBe("medium");
    expect(classifyScore(hard, "en")).toBe("medium");
    expect(classifyScore(hard + 0.01, "en")).toBe("hard");
  });

  test("uses higher cut-offs for French, whose words are longer", () => {
    expect(classifyScore(6, "en")).toBe("hard");
    expect(classifyScore(6, "fr")).toBe("easy");
  });
});
