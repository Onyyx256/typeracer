import { describe, expect, test } from "bun:test";
import { containsSlur } from "./blocklist";
import passages from "@/db/seed/passages.json";
import enWords from "@/lib/texts/words/en.json";
import frWords from "@/lib/texts/words/fr.json";

describe("containsSlur", () => {
  test("finds a slur in any case, with punctuation around it", () => {
    expect(containsSlur('He said, "Nigger!" and left.', "en")).toBe(true);
    expect(containsSlur("Un nègre passa.", "fr")).toBe(true);
  });

  test("finds plurals", () => {
    expect(containsSlur("the niggers on the boat", "en")).toBe(true);
    expect(containsSlur("des nègres", "fr")).toBe(true);
  });

  test("leaves longer words that only start like a slur", () => {
    expect(containsSlur("a niggardly sum, a raccoon", "en")).toBe(false);
  });

  test("only checks the passage's own language", () => {
    expect(containsSlur("Le train a du retard.", "fr")).toBe(false);
    expect(containsSlur("Le négro passa.", "en")).toBe(false);
  });
});

describe("generated texts", () => {
  test("no passage contains a slur", () => {
    const flagged = passages.filter((passage) =>
      containsSlur(passage.content, passage.language === "fr" ? "fr" : "en"),
    );
    expect(flagged.map((passage) => passage.sourceRef)).toEqual([]);
  });

  test("no random word is a slur", () => {
    expect(enWords.filter((word) => containsSlur(word, "en"))).toEqual([]);
    expect(frWords.filter((word) => containsSlur(word, "fr"))).toEqual([]);
  });
});
