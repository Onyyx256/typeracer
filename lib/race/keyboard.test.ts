import { describe, expect, test } from "bun:test";
import { heatLevel, keyFor, missesByKey } from "./keyboard";

describe("keyFor", () => {
  test("puts capitals and shifted symbols on their key", () => {
    expect(keyFor("E")).toBe("e");
    expect(keyFor("?")).toBe("/");
    expect(keyFor(":")).toBe(";");
    expect(keyFor(" ")).toBe(" ");
  });

  test("has no key for accents and typographic quotes", () => {
    expect(keyFor("é")).toBeNull();
    expect(keyFor("É")).toBeNull();
    expect(keyFor("’")).toBeNull();
  });
});

describe("missesByKey", () => {
  test("adds up the characters typed with the same key", () => {
    const { keys, others } = missesByKey({ e: 2, E: 1, "?": 1, "/": 2, é: 3, à: 3, "«": 1, x: 0 });
    expect(keys.get("e")).toBe(3);
    expect(keys.get("/")).toBe(3);
    expect(keys.has("x")).toBe(false);
    expect(others).toEqual([
      { char: "à", misses: 3 },
      { char: "é", misses: 3 },
      { char: "«", misses: 1 },
    ]);
  });
});

describe("heatLevel", () => {
  test("is 0 without misses and the top step for the most-missed key", () => {
    expect(heatLevel(0, 10)).toBe(0);
    expect(heatLevel(10, 10)).toBe(4);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(6, 10)).toBe(3);
  });
});
