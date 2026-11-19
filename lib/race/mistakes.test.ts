import { describe, expect, test } from "bun:test";
import { mistakesOf } from "./mistakes";

describe("mistakesOf (RES-03)", () => {
  test("keeps the samples where the count went up, with how many were added", () => {
    expect(
      mistakesOf([
        { t: 1000, wpm: 40, errors: 0 },
        { t: 2000, wpm: 42, errors: 2 },
        { t: 3000, wpm: 45, errors: 2 },
        { t: 3400, wpm: 44, errors: 3 },
      ]),
    ).toEqual([
      { t: 2000, wpm: 42, count: 2 },
      { t: 3400, wpm: 44, count: 1 },
    ]);
  });

  test("counts a mistake in the first second", () => {
    expect(mistakesOf([{ t: 1000, wpm: 30, errors: 1 }])).toEqual([{ t: 1000, wpm: 30, count: 1 }]);
  });

  test("finds none in a race saved before mistakes were recorded", () => {
    expect(mistakesOf([{ t: 1000, wpm: 30 }, { t: 2000, wpm: 35 }])).toEqual([]);
  });
});
