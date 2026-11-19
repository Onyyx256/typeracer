import { describe, expect, test } from "bun:test";
import { cosmeticsSchema } from "@/lib/profile/cosmetics";
import { BOT_LEVELS } from "./levels";
import { BOT_COSMETICS } from "./looks";

describe("bot colours (BOT-04)", () => {
  test("every level wears existing colours, none shared with another level", () => {
    for (const level of BOT_LEVELS) {
      expect(cosmeticsSchema.safeParse(BOT_COSMETICS[level]).success).toBe(true);
    }
    const stems = BOT_LEVELS.map((level) => BOT_COSMETICS[level].stem);
    const petals = BOT_LEVELS.map((level) => BOT_COSMETICS[level].petal);
    expect(new Set(stems).size).toBe(BOT_LEVELS.length);
    expect(new Set(petals).size).toBe(BOT_LEVELS.length);
  });
});
