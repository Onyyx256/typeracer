import * as z from "zod";

/** Slowest first. */
export const BOT_LEVELS = ["noob", "beginner", "intermediate", "expert", "impossible"] as const;

export type BotLevel = (typeof BOT_LEVELS)[number];

export const botLevelSchema = z.enum(BOT_LEVELS);

/**
 * Speed and error rate from the spec's table. `hesitation` is how often a
 * word starts with a pause, so slower levels stop to think more.
 */
export type BotProfile = { minWpm: number; maxWpm: number; errorRate: number; hesitation: number };

export const BOT_PROFILES: Record<BotLevel, BotProfile> = {
  noob: { minWpm: 10, maxWpm: 20, errorRate: 0.12, hesitation: 0.12 },
  beginner: { minWpm: 20, maxWpm: 35, errorRate: 0.08, hesitation: 0.09 },
  intermediate: { minWpm: 35, maxWpm: 60, errorRate: 0.05, hesitation: 0.06 },
  expert: { minWpm: 70, maxWpm: 100, errorRate: 0.02, hesitation: 0.04 },
  // "140+" in the spec; 170 gives the engine a range to vary in.
  impossible: { minWpm: 140, maxWpm: 170, errorRate: 0.005, hesitation: 0.02 },
};
