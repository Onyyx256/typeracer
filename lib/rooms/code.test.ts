import { describe, expect, test } from "bun:test";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_PATTERN,
  generateRoomCode,
  roomCodeSchema,
} from "./code";

describe("room codes", () => {
  test("the alphabet has no ambiguous characters", () => {
    for (const ambiguous of "0O1IL") {
      expect(ROOM_CODE_ALPHABET.includes(ambiguous)).toBe(false);
    }
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(31);
  });

  test("generated codes match the database pattern and vary", () => {
    const codes = Array.from({ length: 500 }, generateRoomCode);
    for (const code of codes) {
      expect(code).toMatch(ROOM_CODE_PATTERN);
    }
    expect(new Set(codes).size).toBeGreaterThan(495);
  });

  test("the pattern accepts exactly the alphabet", () => {
    for (const character of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") {
      expect(ROOM_CODE_PATTERN.test(character.repeat(6))).toBe(
        ROOM_CODE_ALPHABET.includes(character),
      );
    }
  });

  test("typed codes are trimmed and uppercased", () => {
    expect(roomCodeSchema.parse(" abc234 ")).toBe("ABC234");
    expect(roomCodeSchema.safeParse("ABC23").success).toBe(false);
    expect(roomCodeSchema.safeParse("ABC230").success).toBe(false);
  });
});
