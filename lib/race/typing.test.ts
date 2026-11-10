import { describe, expect, test } from "bun:test";
import {
  applyKey,
  applyKeys,
  BACKSPACE,
  correctChars,
  initialTyping,
  isComplete,
  MAX_WRONG_TAIL,
  typingProgress,
  type ErrorMode,
} from "./typing";

const TEXT = "le chat dort";

function type(mode: ErrorMode, keys: string) {
  return applyKeys(TEXT, mode, initialTyping(), [...keys].map((key) => (key === "<" ? BACKSPACE : key)));
}

describe("strict mode (mandatory correction)", () => {
  test("a correct run moves forward and counts every key as correct", () => {
    const state = type("strict", "le ch");
    expect(state.input).toBe("le ch");
    expect(state.keystrokes).toBe(5);
    expect(state.correctKeystrokes).toBe(5);
    expect(typingProgress(TEXT, "strict", state)).toBeCloseTo(5 / TEXT.length);
  });

  test("wrong letters stay, but the text doesn't advance until they are deleted", () => {
    const state = type("strict", "le cx");
    expect(state.input).toBe("le cx");
    expect(correctChars(TEXT, "strict", state)).toBe(4);
    expect(typingProgress(TEXT, "strict", state)).toBeCloseTo(4 / TEXT.length);

    // Even letters that match after an error don't count until it's fixed.
    const further = applyKeys(TEXT, "strict", state, ["a", "t"]);
    expect(correctChars(TEXT, "strict", further)).toBe(4);
  });

  test("each wrong press is an error, even after it is corrected", () => {
    const state = type("strict", "le cx<h");
    expect(state.input).toBe("le ch");
    expect(state.keystrokes).toBe(6);
    expect(state.correctKeystrokes).toBe(5);
    expect(state.missed).toEqual({ h: 1 });
  });

  test("backspace can't go back into a correct word already followed by a space", () => {
    const state = type("strict", "le <<<");
    expect(state.input).toBe("le ");
  });

  test("backspace can go back over a wrong space", () => {
    const state = type("strict", "lx <<e");
    expect(state.input).toBe("le");
  });

  test("keys stop being accepted after too many wrong ones in a row", () => {
    const state = type("strict", "l" + "z".repeat(MAX_WRONG_TAIL + 3));
    expect(state.input).toBe("l" + "z".repeat(MAX_WRONG_TAIL));
    expect(state.keystrokes).toBe(1 + MAX_WRONG_TAIL);
  });

  test("the race is complete only once the whole text is correct", () => {
    expect(isComplete(TEXT, "strict", type("strict", "le chat dorx"))).toBe(false);
    const done = type("strict", "le chat dort");
    expect(isComplete(TEXT, "strict", done)).toBe(true);
    expect(applyKey(TEXT, "strict", done, "s")).toBe(done);
  });
});

describe("free mode (errors counted)", () => {
  test("wrong letters move forward and count as errors", () => {
    const state = type("free", "lx chat");
    expect(state.input).toBe("lx chat");
    expect(typingProgress(TEXT, "free", state)).toBeCloseTo(7 / TEXT.length);
    expect(correctChars(TEXT, "free", state)).toBe(6);
    expect(state.keystrokes - state.correctKeystrokes).toBe(1);
  });

  test("a word can still be fixed until its space is typed, not after", () => {
    expect(type("free", "lx<e").input).toBe("le");
    expect(type("free", "lx <<").input).toBe("lx ");
  });

  test("the race is complete when the length is reached, errors included", () => {
    expect(isComplete(TEXT, "free", type("free", "le chat dorx"))).toBe(true);
    expect(type("free", "le chat dortttt").input).toBe("le chat dort");
  });
});

test("keys that aren't one character or a backspace are ignored", () => {
  const state = applyKeys(TEXT, "strict", initialTyping(), ["le", "", "Shift", "l"]);
  expect(state.input).toBe("l");
  expect(state.keystrokes).toBe(1);
});
