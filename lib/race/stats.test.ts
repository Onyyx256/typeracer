import { describe, expect, test } from "bun:test";
import { accuracy, netWpm, progressRatio, rawWpm } from "./stats";

describe("WPM (annex A)", () => {
  test("is characters ÷ 5 ÷ minutes", () => {
    // 300 characters in one minute = 60 words of 5 characters.
    expect(netWpm(300, 60_000)).toBe(60);
    expect(netWpm(150, 30_000)).toBe(60);
    expect(rawWpm(400, 60_000)).toBe(80);
  });

  test("is 0 before any time has passed", () => {
    expect(netWpm(10, 0)).toBe(0);
    expect(rawWpm(10, -5)).toBe(0);
  });
});

describe("accuracy", () => {
  test("is correct keystrokes over all keystrokes, in percent", () => {
    expect(accuracy(45, 50)).toBe(90);
    expect(accuracy(0, 4)).toBe(0);
  });

  test("is 100 before the first key", () => {
    expect(accuracy(0, 0)).toBe(100);
  });
});

describe("progressRatio", () => {
  test("is validated characters over the text length, kept in [0, 1]", () => {
    expect(progressRatio(25, 100)).toBe(0.25);
    expect(progressRatio(120, 100)).toBe(1);
    expect(progressRatio(-1, 100)).toBe(0);
    expect(progressRatio(3, 0)).toBe(0);
  });
});
