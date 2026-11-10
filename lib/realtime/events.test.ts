import { describe, expect, test } from "bun:test";
import { raceKeysSchema } from "./events";

describe("race:keys message (TECH-07)", () => {
  test("accepts a batch with or without its send time", () => {
    expect(raceKeysSchema.safeParse({ seq: 0, keys: ["a", "b"] }).success).toBe(true);
    expect(raceKeysSchema.safeParse({ seq: 3, keys: ["a"], at: 1250 }).success).toBe(true);
  });

  test("refuses a send time that isn't a whole, positive, sane number", () => {
    for (const at of [-1, 1.5, "1000", 25 * 60 * 60 * 1000, Number.NaN]) {
      expect(raceKeysSchema.safeParse({ seq: 0, keys: ["a"], at }).success).toBe(false);
    }
  });
});
