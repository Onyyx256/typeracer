import { describe, expect, test } from "bun:test";
import { en } from "@/lib/i18n/dictionaries/en";
import { roomLabel } from "./label";

describe("roomLabel", () => {
  test("names a room by its code", () => {
    expect(roomLabel(en.roomNames, { code: "ABC234", visibility: "code" })).toBe("room ABC234");
  });

  test("leaves the code out for a private room", () => {
    expect(roomLabel(en.roomNames, { code: "ABC234", visibility: "private" })).toBe(
      "your private room",
    );
  });
});
