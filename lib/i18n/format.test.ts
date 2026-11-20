import { describe, expect, test } from "bun:test";
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  interpolate,
  plural,
} from "./format";

// Intl puts narrow no-break spaces in French numbers; compare with plain spaces.
function spaced(text: string): string {
  return text.replace(/[  ]/g, " ");
}

describe("interpolate", () => {
  test("fills each placeholder, numbers included", () => {
    expect(interpolate("{name} typed {wpm} WPM", { name: "Ana", wpm: 72 })).toBe("Ana typed 72 WPM");
  });

  test("leaves unknown placeholders as they are", () => {
    expect(interpolate("Hello {name}, {missing}", { name: "Ana" })).toBe("Hello Ana, {missing}");
    expect(interpolate("no values {here}")).toBe("no values {here}");
  });
});

describe("plural", () => {
  const races = { one: "{count} race", other: "{count} races" };

  test("picks the English form from the count", () => {
    expect(plural("en", races, 1)).toBe("1 race");
    expect(plural("en", races, 0)).toBe("0 races");
    expect(plural("en", races, 2)).toBe("2 races");
  });

  test("follows French rules, where 0 and 1 are singular", () => {
    const courses = { one: "{count} course", other: "{count} courses" };
    expect(plural("fr", courses, 0)).toBe("0 course");
    expect(plural("fr", courses, 1)).toBe("1 course");
    expect(plural("fr", courses, 2)).toBe("2 courses");
  });

  test("passes the other values along", () => {
    const won = { one: "{name} won {count} race", other: "{name} won {count} races" };
    expect(plural("en", won, 3, { name: "Ana" })).toBe("Ana won 3 races");
  });
});

describe("numbers", () => {
  test("formatPercent follows each language's spacing", () => {
    expect(formatPercent("en", 0.42)).toBe("42%");
    expect(spaced(formatPercent("fr", 0.42))).toBe("42 %");
    expect(formatPercent("en", 0.98765, 1)).toBe("98.8%");
  });

  test("formatNumber uses each language's separators", () => {
    expect(formatNumber("en", 1234.5, 1)).toBe("1,234.5");
    expect(spaced(formatNumber("fr", 1234.5, 1))).toBe("1 234,5");
    expect(formatNumber("en", 72.6)).toBe("73");
  });
});

describe("formatDuration", () => {
  test("shows whole minutes in minutes", () => {
    expect(spaced(formatDuration("en", 120))).toBe("2 min");
    expect(spaced(formatDuration("fr", 60))).toBe("1 min");
  });

  test("shows anything else in seconds", () => {
    expect(spaced(formatDuration("en", 30))).toBe("30 sec");
    expect(spaced(formatDuration("fr", 30))).toBe("30 s");
    expect(spaced(formatDuration("en", 90))).toBe("90 sec");
  });
});

describe("formatDateTime", () => {
  test("shows the time in Toronto, whatever the server's time zone", () => {
    // 01:30 UTC on 2 March is still 1 March, 8:30 p.m. in Toronto.
    const date = new Date("2026-03-02T01:30:00Z");
    const shown = spaced(formatDateTime("en", date));
    expect(shown).toContain("Mar 1, 2026");
    expect(shown).toContain("8:30 PM");
  });
});
