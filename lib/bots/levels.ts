import * as z from "zod";

/** Slowest first. The bot engine doesn't exist yet; these are what it will aim for. */
export const BOT_LEVELS = ["noob", "beginner", "intermediate", "expert", "impossible"] as const;

export type BotLevel = (typeof BOT_LEVELS)[number];

export const botLevelSchema = z.enum(BOT_LEVELS);

/** From the spec's table. */
export type BotProfile = { minWpm: number; maxWpm: number; errorRate: number };

export const BOT_PROFILES: Record<BotLevel, BotProfile> = {
  noob: { minWpm: 10, maxWpm: 20, errorRate: 0.12 },
  beginner: { minWpm: 20, maxWpm: 35, errorRate: 0.08 },
  intermediate: { minWpm: 35, maxWpm: 60, errorRate: 0.05 },
  expert: { minWpm: 70, maxWpm: 100, errorRate: 0.02 },
  // "140+" in the spec; 170 gives the engine a range to vary in.
  impossible: { minWpm: 140, maxWpm: 170, errorRate: 0.005 },
};
