/**
 * The formulas of the spec's annex A. Spaces count as characters, and a
 * "word" is 5 characters.
 */

const CHARS_PER_WORD = 5;
const MS_PER_MINUTE = 60_000;

function perMinute(chars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) {
    return 0;
  }
  return chars / CHARS_PER_WORD / (elapsedMs / MS_PER_MINUTE);
}

/** Net WPM: correctly typed characters ÷ 5 ÷ elapsed minutes. */
export function netWpm(correctChars: number, elapsedMs: number): number {
  return perMinute(correctChars, elapsedMs);
}

/** Raw WPM: every typed character (right or wrong) ÷ 5 ÷ elapsed minutes. */
export function rawWpm(typedChars: number, elapsedMs: number): number {
  return perMinute(typedChars, elapsedMs);
}

/** Correct keystrokes ÷ all keystrokes × 100; 100 before the first key. */
export function accuracy(correctKeystrokes: number, keystrokes: number): number {
  if (keystrokes === 0) {
    return 100;
  }
  return (correctKeystrokes / keystrokes) * 100;
}

/** Validated characters ÷ text length, between 0 and 1. */
export function progressRatio(validatedChars: number, textLength: number): number {
  if (textLength <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, validatedChars / textLength));
}
