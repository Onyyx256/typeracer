import { afterEach, describe, expect, test } from "bun:test";
import {
  CODE_MISS_WINDOW_MS,
  MAX_CODE_MISSES,
  recordCodeMiss,
  resetCodeMisses,
  tooManyCodeMisses,
} from "./code-attempts";

afterEach(resetCodeMisses);

describe("code attempts (SALLE-10)", () => {
  test("blocks an address after 10 misses in a minute", () => {
    const now = 1_000_000;
    for (let miss = 0; miss < MAX_CODE_MISSES - 1; miss++) {
      recordCodeMiss("1.2.3.4", now);
    }
    expect(tooManyCodeMisses("1.2.3.4", now)).toBe(false);
    recordCodeMiss("1.2.3.4", now);
    expect(tooManyCodeMisses("1.2.3.4", now)).toBe(true);
  });

  test("other addresses are not affected", () => {
    for (let miss = 0; miss < MAX_CODE_MISSES; miss++) {
      recordCodeMiss("1.2.3.4");
    }
    expect(tooManyCodeMisses("5.6.7.8")).toBe(false);
  });

  test("the block lifts once the minute is over", () => {
    const now = 1_000_000;
    for (let miss = 0; miss < MAX_CODE_MISSES; miss++) {
      recordCodeMiss("1.2.3.4", now);
    }
    expect(tooManyCodeMisses("1.2.3.4", now + CODE_MISS_WINDOW_MS)).toBe(false);
    recordCodeMiss("1.2.3.4", now + CODE_MISS_WINDOW_MS);
    expect(tooManyCodeMisses("1.2.3.4", now + CODE_MISS_WINDOW_MS)).toBe(false);
  });
});
