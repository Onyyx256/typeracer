import { randomInt } from "node:crypto";
import * as z from "zod";

/** No 0/O or 1/I/L, which are easy to mix up when read aloud or typed. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

/** Same rule as the rooms_code_format check in the database. */
export const ROOM_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/;

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(ROOM_CODE_PATTERN);

export function generateRoomCode(): string {
  let code = "";
  for (let index = 0; index < ROOM_CODE_LENGTH; index++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
