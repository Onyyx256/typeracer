import { describe, expect, test } from "bun:test";
import { filterQuery, parseRoomFilters } from "./filters";

describe("parseRoomFilters (JOIN-02, TECH-07)", () => {
  test("keeps valid values", () => {
    expect(parseRoomFilters({ lang: "fr", complexity: "hard" })).toEqual({
      lang: "fr",
      complexity: "hard",
    });
  });

  test("no params means no filter", () => {
    expect(parseRoomFilters({})).toEqual({});
  });

  test("drops unknown values instead of failing", () => {
    expect(parseRoomFilters({ lang: "de", complexity: "'; drop table rooms; --" })).toEqual({});
  });

  test("a repeated key keeps its first value", () => {
    expect(parseRoomFilters({ lang: ["en", "fr"] })).toEqual({ lang: "en" });
  });

  test("ignores other params", () => {
    expect(parseRoomFilters({ lang: "en", page: "2" })).toEqual({ lang: "en" });
  });
});

describe("filterQuery", () => {
  test("changes one key and keeps the other", () => {
    expect(filterQuery({ lang: "fr", complexity: "easy" }, "complexity", "hard")).toBe(
      "?lang=fr&complexity=hard",
    );
  });

  test("clearing the last filter gives an empty query", () => {
    expect(filterQuery({ lang: "fr" }, "lang", undefined)).toBe("");
  });
});
