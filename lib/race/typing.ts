import type { RaceConfig } from "@/lib/rooms/settings";
import { progressRatio } from "./stats";

/**
 * What a player typed, as one pure reducer. The browser runs it for
 * instant feedback (COURSE-04), and the server replays the same keys
 * through it to get the real numbers (COURSE-06), so both always agree.
 */

/** Backspace, in a batch of keys sent to the server. */
export const BACKSPACE = "\b";

export type ErrorMode = RaceConfig["errorMode"];

/**
 * Strict mode: how many wrong characters can pile up after the last
 * correct one before keys stop being accepted. Past that, the player has
 * clearly lost their place and must delete first.
 */
export const MAX_WRONG_TAIL = 8;

export type TypingState = {
  /** What the player has typed, compared character by character with the text. */
  input: string;
  /** Character keys pressed (backspaces excluded), for raw WPM. */
  keystrokes: number;
  /** Keys that matched the text where they were typed, for accuracy. */
  correctKeystrokes: number;
  /** Wrong presses per expected character, for the missed-keys chart (RES-03). */
  missed: Record<string, number>;
};

export function initialTyping(): TypingState {
  return { input: "", keystrokes: 0, correctKeystrokes: 0, missed: {} };
}

/** How many characters from the start of the input match the text. */
export function correctPrefixLength(text: string, input: string): number {
  let index = 0;
  while (index < input.length && input[index] === text[index]) {
    index++;
  }
  return index;
}

/**
 * Where backspace stops. A word is kept once the space after it is typed:
 * in strict mode only if everything up to it is correct, in free mode
 * whatever it contains (errors there are counted and left behind).
 */
export function lockedLength(text: string, mode: ErrorMode, input: string): number {
  const kept = mode === "strict" ? input.slice(0, correctPrefixLength(text, input)) : input;
  return kept.lastIndexOf(" ") + 1;
}

/**
 * Characters that count for net WPM: the correct start in strict mode
 * (what follows the first error doesn't count until it's fixed), every
 * matching position in free mode.
 */
export function correctChars(text: string, mode: ErrorMode, state: TypingState): number {
  if (mode === "strict") {
    return correctPrefixLength(text, state.input);
  }
  let matches = 0;
  for (let index = 0; index < state.input.length; index++) {
    if (state.input[index] === text[index]) {
      matches++;
    }
  }
  return matches;
}

/**
 * Validated characters: strict mode only moves past correct ones, free
 * mode moves past everything typed.
 */
export function validatedChars(text: string, mode: ErrorMode, state: TypingState): number {
  return mode === "strict" ? correctPrefixLength(text, state.input) : state.input.length;
}

export function typingProgress(text: string, mode: ErrorMode, state: TypingState): number {
  return progressRatio(validatedChars(text, mode, state), text.length);
}

export function isComplete(text: string, mode: ErrorMode, state: TypingState): boolean {
  return validatedChars(text, mode, state) >= text.length;
}

/** A single character or a backspace; anything else is ignored. */
export function isValidKey(key: string): boolean {
  return key === BACKSPACE || key.length === 1;
}

/** The state after one key. Keys that can't apply return the same object. */
export function applyKey(
  text: string,
  mode: ErrorMode,
  state: TypingState,
  key: string,
): TypingState {
  if (!isValidKey(key) || isComplete(text, mode, state)) {
    return state;
  }
  const { input } = state;

  if (key === BACKSPACE) {
    if (input.length <= lockedLength(text, mode, input)) {
      return state;
    }
    return { ...state, input: input.slice(0, -1) };
  }

  if (input.length >= text.length) {
    return state;
  }
  if (mode === "strict" && input.length - correctPrefixLength(text, input) >= MAX_WRONG_TAIL) {
    return state;
  }

  const expected = text[input.length] ?? "";
  const correct = key === expected;
  return {
    input: input + key,
    keystrokes: state.keystrokes + 1,
    correctKeystrokes: state.correctKeystrokes + (correct ? 1 : 0),
    missed: correct ? state.missed : { ...state.missed, [expected]: (state.missed[expected] ?? 0) + 1 },
  };
}

export function applyKeys(
  text: string,
  mode: ErrorMode,
  state: TypingState,
  keys: readonly string[],
): TypingState {
  return keys.reduce((current, key) => applyKey(text, mode, current, key), state);
}
