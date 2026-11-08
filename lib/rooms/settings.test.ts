import { describe, expect, test } from "bun:test";
import {
  CAPACITY_MAX,
  CAPACITY_MIN,
  CHARSET_MAX,
  LENGTH_MAX,
  LENGTH_MIN,
  defaultRoomSettings,
  normalizeSettings,
  raceConfigSchema,
  roomSettingsSchema,
  type RoomSettings,
} from "./settings";

const base: RoomSettings = defaultRoomSettings("fr");

function accepts(changes: Record<string, unknown>): boolean {
  return roomSettingsSchema.safeParse({ ...base, ...changes }).success;
}

describe("normalizeSettings (CONF-07)", () => {
  test("keeps accents for French texts", () => {
    expect(normalizeSettings({ ...base, language: "fr", accents: true }).accents).toBe(true);
    expect(normalizeSettings({ ...base, language: "fr", accents: false }).accents).toBe(false);
  });

  test("drops accents for English texts", () => {
    expect(normalizeSettings({ ...base, language: "en", accents: true }).accents).toBe(false);
  });

  test("keeps the letter filters for random words", () => {
    const settings = { ...base, textType: "random" as const, includeChars: "asdf", excludeChars: "q" };
    const normalized = normalizeSettings(settings);
    expect(normalized.includeChars).toBe("asdf");
    expect(normalized.excludeChars).toBe("q");
  });

  test("clears the letter filters for book passages", () => {
    const settings = { ...base, textType: "coherent" as const, includeChars: "asdf", excludeChars: "q" };
    const normalized = normalizeSettings(settings);
    expect(normalized.includeChars).toBe("");
    expect(normalized.excludeChars).toBe("");
  });

  test("leaves every other setting alone", () => {
    const settings: RoomSettings = { ...base, capacity: 12, length: 80, errorMode: "free" };
    expect(normalizeSettings(settings)).toEqual({ ...settings, includeChars: "", excludeChars: "" });
  });
});

describe("room settings schema", () => {
  test("the defaults are valid in both languages", () => {
    expect(roomSettingsSchema.safeParse(defaultRoomSettings("fr")).success).toBe(true);
    expect(roomSettingsSchema.safeParse(defaultRoomSettings("en")).success).toBe(true);
  });

  test("capacity stays within bounds (SALLE-05)", () => {
    expect(accepts({ capacity: CAPACITY_MIN })).toBe(true);
    expect(accepts({ capacity: CAPACITY_MAX })).toBe(true);
    expect(accepts({ capacity: CAPACITY_MIN - 1 })).toBe(false);
    expect(accepts({ capacity: CAPACITY_MAX + 1 })).toBe(false);
    expect(accepts({ capacity: 4.5 })).toBe(false);
  });

  test("only the listed time limits (CONF-01)", () => {
    for (const timeLimit of [0, 30, 600]) {
      expect(accepts({ timeLimit })).toBe(true);
    }
    for (const timeLimit of [10, 45, 601, -30]) {
      expect(accepts({ timeLimit })).toBe(false);
    }
  });

  test("length in steps of 5 words (CONF-04)", () => {
    expect(accepts({ length: LENGTH_MIN })).toBe(true);
    expect(accepts({ length: LENGTH_MAX })).toBe(true);
    expect(accepts({ length: 55 })).toBe(true);
    expect(accepts({ length: 52 })).toBe(false);
    expect(accepts({ length: LENGTH_MIN - 5 })).toBe(false);
    expect(accepts({ length: LENGTH_MAX + 5 })).toBe(false);
  });

  test("enums refuse unknown values", () => {
    expect(accepts({ hostRole: "referee" })).toBe(false);
    expect(accepts({ visibility: "secret" })).toBe(false);
    expect(accepts({ language: "de" })).toBe(false);
    expect(accepts({ textType: "code" })).toBe(false);
    expect(accepts({ complexity: "extreme" })).toBe(false);
    expect(accepts({ errorMode: "lenient" })).toBe(false);
  });

  test("character lists have a maximum length (CONF-07)", () => {
    expect(accepts({ includeChars: "a".repeat(CHARSET_MAX) })).toBe(true);
    expect(accepts({ includeChars: "a".repeat(CHARSET_MAX + 1) })).toBe(false);
    expect(accepts({ excludeChars: "a".repeat(CHARSET_MAX + 1) })).toBe(false);
  });

  test("types are not coerced", () => {
    expect(accepts({ capacity: "8" })).toBe(false);
    expect(accepts({ punctuation: "true" })).toBe(false);
  });

  test("a missing field is refused", () => {
    const missing: Partial<RoomSettings> = { ...base };
    delete missing.bonuses;
    expect(roomSettingsSchema.safeParse(missing).success).toBe(false);
  });

  test("the stored race config leaves out the columns", () => {
    const config = raceConfigSchema.parse(base);
    expect(config).not.toHaveProperty("hostRole");
    expect(config).not.toHaveProperty("visibility");
    expect(config).not.toHaveProperty("capacity");
  });
});
