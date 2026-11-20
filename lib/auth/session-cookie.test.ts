import { describe, expect, test } from "bun:test";
import { needsSignIn } from "./session-cookie";

describe("needsSignIn", () => {
  test("covers the pages that require an account", () => {
    for (const path of ["/stats", "/stats/races/42", "/account", "/rooms/new"]) {
      expect(needsSignIn(path)).toBe(true);
    }
  });

  test("leaves the public pages alone", () => {
    for (const path of ["/", "/login", "/rooms", "/rooms/ABCD", "/practice", "/statsx", "/rooms/newer"]) {
      expect(needsSignIn(path)).toBe(false);
    }
  });
});
