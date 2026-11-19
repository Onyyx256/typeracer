import { describe, expect, test } from "bun:test";
import passages from "@/db/seed/passages.json";
import { accuracy, netWpm } from "@/lib/race/stats";
import {
  applyKey,
  BACKSPACE,
  correctChars,
  initialTyping,
  isComplete,
  type ErrorMode,
  type TypingState,
} from "@/lib/race/typing";
import { createRng } from "@/lib/texts/rng";
import { BOT_LEVELS, BOT_PROFILES, type BotLevel } from "./levels";
import { BotTypist, wrongKeyFor } from "./typist";

const TEXTS = passages.slice(0, 40).map((passage) => passage.content);
const TEXT = TEXTS[0] ?? "";

type Run = { typing: TypingState; keys: { key: string; at: number }[]; ms: number };

function run(
  bot: BotTypist,
  text: string,
  mode: ErrorMode,
  options: { slowed?: boolean } = {},
): Run {
  let typing = initialTyping();
  let ms = 0;
  const keys: Run["keys"] = [];
  for (let next = bot.next(text, mode, typing, options.slowed); next; ) {
    ms += next.delayMs;
    keys.push({ key: next.key, at: ms });
    typing = applyKey(text, mode, typing, next.key);
    next = bot.next(text, mode, typing, options.slowed);
  }
  return { typing, keys, ms };
}

function race(level: BotLevel, seed: number, mode: ErrorMode, text = TEXT) {
  const result = run(new BotTypist({ level, seed, errorMode: mode }), text, mode);
  return {
    ...result,
    wpm: netWpm(correctChars(text, mode, result.typing), result.ms),
    accuracy: accuracy(result.typing.correctKeystrokes, result.typing.keystrokes),
  };
}

describe("bot typist", () => {
  test("is deterministic from its seed (BOT-05)", () => {
    const first = race("intermediate", 42, "strict");
    const again = race("intermediate", 42, "strict");
    const other = race("intermediate", 43, "strict");
    expect(again.keys).toEqual(first.keys);
    expect(other.keys).not.toEqual(first.keys);
  });

  for (const mode of ["strict", "free"] as const) {
    test(`finishes the text in ${mode} mode`, () => {
      for (const level of BOT_LEVELS) {
        const { typing } = race(level, 7, mode);
        expect(isComplete(TEXT, mode, typing)).toBe(true);
      }
    });

    test(`lands in each level's speed and error range on average, ${mode} mode (BOT-01)`, () => {
      for (const level of BOT_LEVELS) {
        const profile = BOT_PROFILES[level];
        const runs = TEXTS.map((text, seed) => race(level, seed + 1, mode, text));
        const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
        const wpm = average(runs.map((entry) => entry.wpm));
        expect(wpm).toBeGreaterThanOrEqual(profile.minWpm);
        expect(wpm).toBeLessThanOrEqual(profile.maxWpm);
        const inRange = runs.filter((entry) => entry.wpm >= profile.minWpm && entry.wpm <= profile.maxWpm);
        expect(inRange.length / runs.length).toBeGreaterThanOrEqual(0.8);
        const errors = 100 - average(runs.map((entry) => entry.accuracy));
        expect(errors).toBeGreaterThan(profile.errorRate * 100 * 0.6);
        expect(errors).toBeLessThan(profile.errorRate * 100 * 1.4);
      }
    });
  }

  test("speed varies during the race (BOT-02)", () => {
    const { keys } = race("expert", 3, "strict");
    const perSecond = new Map<number, number>();
    for (const { at } of keys) {
      const second = Math.floor(at / 1000);
      perSecond.set(second, (perSecond.get(second) ?? 0) + 1);
    }
    const counts = [...perSecond.values()].slice(1, -1);
    expect(Math.max(...counts) - Math.min(...counts)).toBeGreaterThanOrEqual(4);
  });

  test("takes longer on long words and special characters (BOT-02)", () => {
    const perChar = (text: string) => {
      let total = 0;
      for (let seed = 1; seed <= 30; seed++) {
        total += run(new BotTypist({ level: "expert", seed, errorMode: "free" }), text, "free").ms;
      }
      return total / text.length;
    };
    const short = "le mot est un peu court mais pas trop vu le bon jeu";
    const long = "remarquablement extraordinaires constitutionnellement incomparables";
    expect(perChar(long)).toBeGreaterThan(perChar(short) * 1.1);
    expect(perChar(short.toUpperCase())).toBeGreaterThan(perChar(short) * 1.3);
  });

  test("deletes its errors in strict mode, and they cost time (BOT-03)", () => {
    const { keys, typing } = race("noob", 5, "strict");
    expect(keys.some(({ key }) => key === BACKSPACE)).toBe(true);
    expect(typing.input).toBe(TEXT);
    expect(typing.keystrokes).toBeGreaterThan(TEXT.length);
  });

  test("may leave errors behind in free mode (BOT-03)", () => {
    const { typing } = race("noob", 5, "free");
    expect(typing.input.length).toBe(TEXT.length);
    expect(typing.input).not.toBe(TEXT);
  });

  test("is slower while glare hides the next words", () => {
    const plain = run(new BotTypist({ level: "expert", seed: 9, errorMode: "strict" }), TEXT, "strict");
    const glared = run(new BotTypist({ level: "expert", seed: 9, errorMode: "strict" }), TEXT, "strict", {
      slowed: true,
    });
    expect(glared.ms).toBeGreaterThan(plain.ms * 2);
  });

  test("follows a text that changes under it, as bonuses do", () => {
    const bot = new BotTypist({ level: "impossible", seed: 11, errorMode: "strict" });
    let text = "un deux trois quatre cinq six sept";
    let typing = initialTyping();
    for (let next = bot.next(text, "strict", typing); next; next = bot.next(text, "strict", typing)) {
      typing = applyKey(text, "strict", typing, next.key);
      if (typing.input === "un deux") {
        text = "un deux trois";
      }
    }
    expect(typing.input).toBe("un deux trois");
  });

  test("slips on a neighbouring key, never the right one", () => {
    const rng = createRng(1);
    for (const char of ["a", "p", "Q", " ", "é", "1", ",", "«"]) {
      for (let index = 0; index < 20; index++) {
        const wrong = wrongKeyFor(char, rng);
        expect(wrong).not.toBe(char);
        expect(wrong).toHaveLength(1);
      }
    }
    expect(["f", "h"]).toContain(wrongKeyFor("g", rng));
  });
});
