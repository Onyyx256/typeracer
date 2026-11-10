import { describe, expect, test } from "bun:test";
import { BOT_LEVELS, BOT_PROFILES } from "@/lib/bots/levels";
import {
  PRACTICE_BOTS_MAX,
  addBot,
  defaultPracticeSettings,
  practiceRaceConfig,
  practiceSettingsSchema,
  removeBot,
  setBotLevel,
} from "./settings";

const base = defaultPracticeSettings("fr");

describe("practice settings", () => {
  test("start from the room defaults, without room fields or bots", () => {
    expect(base.bots).toEqual([]);
    expect(base.language).toBe("fr");
    expect(base).not.toHaveProperty("visibility");
    expect(base).not.toHaveProperty("bonuses");
    expect(practiceSettingsSchema.safeParse(base).success).toBe(true);
  });

  test("accept up to the bot limit, with known levels only", () => {
    const full = { ...base, bots: Array.from({ length: PRACTICE_BOTS_MAX }, () => ({ level: "expert" })) };
    expect(practiceSettingsSchema.safeParse(full).success).toBe(true);
    const tooMany = { ...full, bots: [...full.bots, { level: "expert" }] };
    expect(practiceSettingsSchema.safeParse(tooMany).success).toBe(false);
    expect(practiceSettingsSchema.safeParse({ ...base, bots: [{ level: "god" }] }).success).toBe(false);
  });

  test("the race config has bonuses off and is normalized", () => {
    const config = practiceRaceConfig({ ...base, language: "en", accents: true });
    expect(config.bonuses).toBe(false);
    expect(config.accents).toBe(false);
    expect(config).not.toHaveProperty("bots");
  });
});

describe("practice bots (CONF-10)", () => {
  test("are added, changed and removed by position", () => {
    let settings = addBot(base, "noob");
    settings = addBot(settings, "expert");
    settings = setBotLevel(settings, 0, "impossible");
    expect(settings.bots).toEqual([{ level: "impossible" }, { level: "expert" }]);
    expect(removeBot(settings, 0).bots).toEqual([{ level: "expert" }]);
  });

  test("stop at the limit", () => {
    let settings = base;
    for (let count = 0; count < PRACTICE_BOTS_MAX + 2; count++) {
      settings = addBot(settings, "beginner");
    }
    expect(settings.bots).toHaveLength(PRACTICE_BOTS_MAX);
  });
});

describe("bot levels (BOT-01)", () => {
  test("go from slowest and sloppiest to fastest and most precise", () => {
    const profiles = BOT_LEVELS.map((level) => BOT_PROFILES[level]);
    for (const [index, profile] of profiles.entries()) {
      expect(profile.minWpm).toBeLessThan(profile.maxWpm);
      const next = profiles[index + 1];
      if (next) {
        expect(next.minWpm).toBeGreaterThanOrEqual(profile.minWpm);
        expect(next.errorRate).toBeLessThan(profile.errorRate);
      }
    }
    expect(BOT_PROFILES.impossible.minWpm).toBeGreaterThanOrEqual(140);
  });
});
