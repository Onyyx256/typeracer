import { describe, expect, test } from "bun:test";
import { historyPageSchema, keyLabel, movingAverage, niceScale, pageCount } from "./series";

describe("movingAverage", () => {
  test("averages each point with the ones before it, up to the window", () => {
    expect(movingAverage([10, 20, 30, 40], 2)).toEqual([10, 15, 25, 35]);
    expect(movingAverage([10, 20, 30, 40], 3)).toEqual([10, 15, 20, 30]);
  });

  test("is the values themselves with a window of 1", () => {
    expect(movingAverage([3, 7, 5], 1)).toEqual([3, 7, 5]);
  });

  test("is empty for no values", () => {
    expect(movingAverage([], 5)).toEqual([]);
  });
});

describe("niceScale", () => {
  test("rounds the bounds out to clean ticks", () => {
    expect(niceScale(23, 87)).toEqual({ min: 20, max: 100, ticks: [20, 40, 60, 80, 100] });
  });

  test("never goes below zero", () => {
    expect(niceScale(-5, 30).min).toBe(0);
  });

  test("still has a range when every value is the same", () => {
    const scale = niceScale(50, 50);
    expect(scale.max).toBeGreaterThan(scale.min);
    expect(scale.ticks.length).toBeGreaterThanOrEqual(2);
  });
});

describe("history page", () => {
  test("reads a page number from the query string", () => {
    expect(historyPageSchema.parse("3")).toBe(3);
  });

  test("falls back to the first page for anything else", () => {
    for (const value of [undefined, "", "0", "-2", "1.5", "abc", ["2", "3"]]) {
      expect(historyPageSchema.parse(value)).toBe(1);
    }
  });

  test("counts at least one page, even with no races", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(10)).toBe(1);
    expect(pageCount(11)).toBe(2);
  });
});

describe("keyLabel", () => {
  test("shows invisible characters as symbols", () => {
    expect(keyLabel(" ")).toBe("␣");
    expect(keyLabel("é")).toBe("é");
  });
});
