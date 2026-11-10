import { describe, expect, test } from "bun:test";
import { nicknameSchema } from "./validation";

function check(input: string): { name: string } | { error: string } {
  const parsed = nicknameSchema.safeParse(input);
  return parsed.success ? { name: parsed.data } : { error: parsed.error.issues[0].message };
}

describe("room and guest names (AUTH-02)", () => {
  test("3 to 20 characters", () => {
    expect(check("abc")).toEqual({ name: "abc" });
    expect(check("a".repeat(20))).toEqual({ name: "a".repeat(20) });
    expect(check("ab")).toEqual({ error: "usernameLength" });
    expect(check("a".repeat(21))).toEqual({ error: "usernameLength" });
    expect(check("")).toEqual({ error: "usernameLength" });
  });

  test("letters of any language", () => {
    for (const name of ["Zoë", "Jürgen", "Ольга", "李小龍", "مريم", "Ñandú", "Đặng Thị"]) {
      expect(check(name)).toEqual({ name });
    }
  });

  test("digits, spaces and a few separators", () => {
    for (const name of ["Player 2", "j.doe", "o'brien", "anne-marie", "snake_case"]) {
      expect(check(name)).toEqual({ name });
    }
  });

  test("outer spaces are trimmed and inner runs collapse to one", () => {
    expect(check("  Anne   Marie  ")).toEqual({ name: "Anne Marie" });
    expect(check("Anne\t\nMarie")).toEqual({ name: "Anne Marie" });
  });

  test("the length is counted after the cleanup", () => {
    // Five characters typed, but only "a b" is left.
    expect(check("a   b")).toEqual({ name: "a b" });
    expect(check("  ab  ")).toEqual({ error: "usernameLength" });
    expect(check(`${"a".repeat(10)}     ${"b".repeat(9)}`)).toEqual({
      name: `${"a".repeat(10)} ${"b".repeat(9)}`,
    });
  });

  test("other characters are refused", () => {
    for (const name of ["<script>", "a@b.com", "hey!", "50%", "x/y", "😀😀😀", "semi;colon"]) {
      expect(check(name)).toEqual({ error: "nicknameChars" });
    }
  });
});
