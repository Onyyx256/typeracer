import { describe, expect, test } from "bun:test";
import { raceConfigSchema, defaultRoomSettings, type RaceConfig } from "@/lib/rooms/settings";
import { WORD_TIERS } from "./complexity";
import { generateRandomText } from "./random-text";
import { createRng } from "./rng";
import { splitWords } from "./text-utils";
import { MIN_POOL_SIZE, WORD_LISTS, buildWordPool, characterFilter } from "./word-pool";

function config(overrides: Partial<RaceConfig> = {}): RaceConfig {
  return {
    ...raceConfigSchema.parse(defaultRoomSettings("fr")),
    textType: "random",
    ...overrides,
  };
}

describe("buildWordPool", () => {
  test("keeps each difficulty within its rank and length", () => {
    for (const complexity of ["easy", "medium", "hard"] as const) {
      const tier = WORD_TIERS[complexity];
      const list = WORD_LISTS.en;
      const pool = buildWordPool(config({ language: "en", complexity }));
      expect(pool.length).toBeGreaterThan(MIN_POOL_SIZE);
      for (const word of pool) {
        const rank = list.indexOf(word) + 1;
        expect(rank).toBeGreaterThanOrEqual(tier.minRank);
        expect(rank).toBeLessThanOrEqual(tier.maxRank);
        expect(word.length).toBeGreaterThanOrEqual(tier.minLength);
        expect(word.length).toBeLessThanOrEqual(tier.maxLength);
      }
    }
  });

  test("drops accented words when accents are off", () => {
    const pool = buildWordPool(config({ accents: false }));
    expect(pool.some((word) => /[àâäçéèêëîïôöùûüÿ]/.test(word))).toBe(false);
    expect(buildWordPool(config({ accents: true })).some((word) => word.includes("é"))).toBe(true);
  });

  test("applies the include and exclude lists without case", () => {
    const pool = buildWordPool(config({ includeChars: "QZ", excludeChars: "E" }));
    expect(pool.length).toBeGreaterThan(0);
    for (const word of pool) {
      expect(/[qz]/.test(word)).toBe(true);
      expect(word.includes("e")).toBe(false);
    }
  });

  test("widens past the difficulty tier when the filters leave too few words", () => {
    const words = ["chat", "chien", "zèbre", "anticonstitutionnellement"];
    const pool = buildWordPool(config({ complexity: "hard", includeChars: "z" }), words);
    expect(pool).toEqual(["zèbre"]);
  });

  test("is empty when nothing passes", () => {
    const letters = "abcdefghijklmnopqrstuvwxyzàâäçéèêëîïôöùûüÿ";
    expect(buildWordPool(config({ excludeChars: letters }))).toEqual([]);
  });
});

describe("characterFilter", () => {
  test("ignores non-letters for include and lets exclude win", () => {
    const filter = characterFilter({ includeChars: "a1!b", excludeChars: "B," });
    expect([...filter.include]).toEqual(["a"]);
    expect(filter.exclude.has("b")).toBe(true);
    expect(filter.exclude.has(",")).toBe(true);
  });
});

describe("generateRandomText", () => {
  test("has exactly the asked number of words", () => {
    for (const length of [10, 55, 200]) {
      const text = generateRandomText(config({ length }), createRng(length));
      expect(splitWords(text ?? "")).toHaveLength(length);
    }
  });

  test("is the same for the same seed", () => {
    const first = generateRandomText(config(), createRng(42));
    expect(generateRandomText(config(), createRng(42))).toBe(first);
    expect(generateRandomText(config(), createRng(43))).not.toBe(first);
  });

  test("has only lowercase letters when every toggle is off", () => {
    const text = generateRandomText(
      config({ punctuation: false, capitals: false, numbers: false, accents: false }),
      createRng(1),
    );
    expect(text).toMatch(/^[a-z ]+$/);
  });

  test("adds sentence punctuation, capitals and numbers when on", () => {
    const text =
      generateRandomText(
        config({ length: 200, punctuation: true, capitals: true, numbers: true }),
        createRng(7),
      ) ?? "";
    expect(text).toMatch(/[.?!]$/);
    expect(text).toMatch(/,/);
    expect(text).toMatch(/\d/);
    expect(text).toMatch(/^\p{Lu}|^\d/u);
    // After an end mark, the next word starts with a capital (or is a number).
    expect(text).not.toMatch(/[.?!] \p{Ll}/u);
  });

  test("never uses an excluded character, punctuation and digits included", () => {
    const text =
      generateRandomText(
        config({ length: 200, numbers: true, excludeChars: "e.,5" }),
        createRng(3),
      ) ?? "";
    expect(text.toLowerCase()).not.toMatch(/[e.,5]/);
  });

  test("never repeats a word twice in a row", () => {
    const words = splitWords(
      generateRandomText(config({ length: 200, punctuation: false, numbers: false }), createRng(9)) ?? "",
    ).map((word) => word.toLowerCase());
    for (let index = 1; index < words.length; index++) {
      expect(words[index]).not.toBe(words[index - 1]);
    }
  });

  test("returns null when no word passes the filters", () => {
    expect(generateRandomText(config(), createRng(1), [])).toBeNull();
  });
});
