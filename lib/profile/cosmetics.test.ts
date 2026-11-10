import { describe, expect, test } from "bun:test";
import {
  canWear,
  cosmeticClasses,
  cosmeticsSchema,
  isUnlocked,
  PETALS,
  readCosmetics,
  STEMS,
} from "./cosmetics";

const beginner = { races: 0, wins: 0, bestWpm: 0 };

describe("cosmetics", () => {
  test("a new player can wear the free colours only", () => {
    expect(canWear({ stem: "classic", petal: "classic" }, beginner)).toBe(true);
    expect(canWear({ stem: "fern", petal: "snow" }, beginner)).toBe(true);
    expect(canWear({ stem: "lilac", petal: "classic" }, beginner)).toBe(false);
    expect(canWear({ stem: "classic", petal: "midnight" }, beginner)).toBe(false);
  });

  test("a colour unlocks exactly at its milestone", () => {
    const sky = { kind: "races", at: 5 } as const;
    expect(isUnlocked(sky, { ...beginner, races: 4 })).toBe(false);
    expect(isUnlocked(sky, { ...beginner, races: 5 })).toBe(true);
    expect(canWear({ stem: "lilac", petal: "poppy" }, { ...beginner, wins: 1 })).toBe(true);
    expect(canWear({ stem: "gold", petal: "midnight" }, { ...beginner, bestWpm: 79.9 })).toBe(false);
    expect(canWear({ stem: "gold", petal: "midnight" }, { ...beginner, bestWpm: 80 })).toBe(true);
  });

  test("every list starts with a free default and has unique ids", () => {
    for (const list of [STEMS, PETALS]) {
      expect(list[0]).toEqual({ id: "classic", unlock: null });
      expect(new Set(list.map((item) => item.id)).size).toBe(list.length);
    }
  });

  test("rejects unknown ids from the client (TECH-07)", () => {
    expect(cosmeticsSchema.safeParse({ stem: "fern", petal: "snow" }).success).toBe(true);
    expect(cosmeticsSchema.safeParse({ stem: "rainbow", petal: "snow" }).success).toBe(false);
    expect(cosmeticsSchema.safeParse({ stem: "fern" }).success).toBe(false);
  });

  test("a stored id that no longer exists reads as the default", () => {
    expect(readCosmetics("retired", "snow")).toEqual({ stem: "classic", petal: "snow" });
  });

  test("the default colours need no class", () => {
    expect(cosmeticClasses({ stem: "classic", petal: "classic" })).toBe("");
    expect(cosmeticClasses({ stem: "sky", petal: "classic" })).toBe("stem-sky");
    expect(cosmeticClasses({ stem: "sky", petal: "poppy" })).toBe("stem-sky petal-poppy");
  });
});
