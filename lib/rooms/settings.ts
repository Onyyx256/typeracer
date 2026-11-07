import * as z from "zod";
import { localeSchema, type Locale } from "@/lib/i18n/config";

/** Whether the host races or only watches the track (SALLE-01). */
export const HOST_ROLES = ["participant", "spectator"] as const;

/** Listed, code or link only, or invite link only (SALLE-03). */
export const VISIBILITIES = ["public", "code", "private"] as const;

/** Participants only; spectators don't count (SALLE-05). */
export const CAPACITY_MIN = 2;
export const CAPACITY_MAX = 30;

/** In seconds; 0 means no limit (CONF-01: none, or 30 s to 10 min). */
export const TIME_LIMITS = [0, 30, 60, 120, 180, 300, 600] as const;

/** Real passages from the corpus, or dictionary words (CONF-03). */
export const TEXT_TYPES = ["coherent", "random"] as const;

/** In words (CONF-04). */
export const LENGTH_MIN = 10;
export const LENGTH_MAX = 200;
export const LENGTH_STEP = 5;

export const COMPLEXITIES = ["easy", "medium", "hard"] as const;

/** Fix every mistake before moving on, or keep going and have it counted (CONF-08). */
export const ERROR_MODES = ["strict", "free"] as const;

/** Upper bound for the include/exclude character lists (CONF-07). */
export const CHARSET_MAX = 60;

export const roomSettingsSchema = z.object({
  hostRole: z.enum(HOST_ROLES),
  visibility: z.enum(VISIBILITIES),
  capacity: z.int().min(CAPACITY_MIN).max(CAPACITY_MAX),
  timeLimit: z.literal(TIME_LIMITS),
  language: localeSchema,
  textType: z.enum(TEXT_TYPES),
  length: z
    .int()
    .min(LENGTH_MIN)
    .max(LENGTH_MAX)
    .multipleOf(LENGTH_STEP),
  complexity: z.enum(COMPLEXITIES),
  punctuation: z.boolean(),
  numbers: z.boolean(),
  capitals: z.boolean(),
  accents: z.boolean(),
  includeChars: z.string().max(CHARSET_MAX),
  excludeChars: z.string().max(CHARSET_MAX),
  errorMode: z.enum(ERROR_MODES),
  bonuses: z.boolean(),
});

export type RoomSettings = z.infer<typeof roomSettingsSchema>;

/**
 * The settings that shape the text and the race, kept together in the room's
 * `config` column. Visibility and capacity have their own columns (they are
 * filtered on), and the host's role is their membership row.
 */
export const raceConfigSchema = roomSettingsSchema.omit({
  hostRole: true,
  visibility: true,
  capacity: true,
});

export type RaceConfig = z.infer<typeof raceConfigSchema>;

export type HostRole = (typeof HOST_ROLES)[number];
export type Visibility = (typeof VISIBILITIES)[number];

/** COURSE-01: EN_ATTENTE, DÉCOMPTE, EN_COURSE, RÉSULTATS, FERMÉE. */
export const ROOM_STATES = [
  "waiting",
  "countdown",
  "racing",
  "results",
  "closed",
] as const;

export type RoomState = (typeof ROOM_STATES)[number];

/** People can come in only between races (SALLE-09). */
export const JOINABLE_STATES: readonly RoomState[] = ["waiting", "results"];

/**
 * Drops what the chosen options make meaningless, so the stored config says
 * what the race really uses: accents only exist in French, and the
 * include/exclude lists only apply to random text (CONF-07).
 */
export function normalizeSettings(settings: RoomSettings): RoomSettings {
  const random = settings.textType === "random";
  return {
    ...settings,
    accents: settings.language === "fr" && settings.accents,
    includeChars: random ? settings.includeChars : "",
    excludeChars: random ? settings.excludeChars : "",
  };
}

/** What the create form starts with; the text language follows the interface. */
export function defaultRoomSettings(language: Locale): RoomSettings {
  return {
    hostRole: "participant",
    visibility: "public",
    capacity: 8,
    timeLimit: 0,
    language,
    textType: "coherent",
    length: 50,
    complexity: "medium",
    punctuation: true,
    numbers: false,
    capitals: true,
    accents: language === "fr",
    includeChars: "",
    excludeChars: "",
    errorMode: "strict",
    bonuses: true,
  };
}
