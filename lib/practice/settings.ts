import * as z from "zod";
import { botLevelSchema, type BotLevel } from "@/lib/bots/levels";
import type { Locale } from "@/lib/i18n/config";
import {
  defaultRoomSettings,
  normalizeSettings,
  raceConfigSchema,
  type RaceConfig,
} from "@/lib/rooms/settings";

/**
 * Practice: a race alone, with bots if wanted, for anyone, signed in or
 * not. It has no room, so no visibility or capacity, and no catch-up
 * bonuses: they need someone else ahead or behind, and bots don't race yet.
 */

/** Enough for a full track without hiding the player's flower. */
export const PRACTICE_BOTS_MAX = 5;

export const practiceBotSchema = z.object({ level: botLevelSchema });

export type PracticeBot = z.infer<typeof practiceBotSchema>;

/** The text and the race; validated again by the server action (TECH-07). */
export const practiceConfigSchema = raceConfigSchema.omit({ bonuses: true });

export type PracticeConfig = z.infer<typeof practiceConfigSchema>;

export const practiceSettingsSchema = practiceConfigSchema.extend({
  bots: z.array(practiceBotSchema).max(PRACTICE_BOTS_MAX),
});

export type PracticeSettings = z.infer<typeof practiceSettingsSchema>;

/** Same text defaults as a new room, without bots. */
export function defaultPracticeSettings(language: Locale): PracticeSettings {
  // parse() keeps only the practice fields.
  return { ...practiceConfigSchema.parse(defaultRoomSettings(language)), bots: [] };
}

/** What the text generator gets: bonuses off, cleaned like a room's config. */
export function practiceRaceConfig(config: PracticeConfig): RaceConfig {
  return normalizeSettings({ ...practiceConfigSchema.parse(config), bonuses: false });
}

export function addBot(settings: PracticeSettings, level: BotLevel): PracticeSettings {
  if (settings.bots.length >= PRACTICE_BOTS_MAX) {
    return settings;
  }
  return { ...settings, bots: [...settings.bots, { level }] };
}

export function removeBot(settings: PracticeSettings, index: number): PracticeSettings {
  return { ...settings, bots: settings.bots.filter((_, at) => at !== index) };
}

export function setBotLevel(
  settings: PracticeSettings,
  index: number,
  level: BotLevel,
): PracticeSettings {
  return {
    ...settings,
    bots: settings.bots.map((bot, at) => (at === index ? { level } : bot)),
  };
}
