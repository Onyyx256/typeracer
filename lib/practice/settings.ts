import * as z from "zod";
import { BOTS_MAX, botsSchema } from "@/lib/bots/levels";
import type { Locale } from "@/lib/i18n/config";
import {
  defaultRoomSettings,
  normalizeSettings,
  raceConfigSchema,
  type RaceConfig,
} from "@/lib/rooms/settings";

/**
 * No catch-up bonuses in practice: it stays a plain run against the clock
 * and the bots.
 */

export const PRACTICE_BOTS_MAX = BOTS_MAX;

export const practiceConfigSchema = raceConfigSchema.omit({ bonuses: true, bots: true });

export type PracticeConfig = z.infer<typeof practiceConfigSchema>;

export const practiceSettingsSchema = practiceConfigSchema.extend({
  bots: botsSchema,
});

export type PracticeSettings = z.infer<typeof practiceSettingsSchema>;

export function defaultPracticeSettings(language: Locale): PracticeSettings {
  // parse() keeps only the practice fields.
  return { ...practiceConfigSchema.parse(defaultRoomSettings(language)), bots: [] };
}

export function practiceRaceConfig(config: PracticeConfig): RaceConfig {
  return normalizeSettings({ ...practiceConfigSchema.parse(config), bonuses: false, bots: [] });
}
