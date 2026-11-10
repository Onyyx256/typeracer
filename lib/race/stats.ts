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

export function netWpm(correctChars: number, elapsedMs: number): number {
  return perMinute(correctChars, elapsedMs);
}

export function rawWpm(typedChars: number, elapsedMs: number): number {
  return perMinute(typedChars, elapsedMs);
}

/** 100 before the first key. */
export function accuracy(correctKeystrokes: number, keystrokes: number): number {
  if (keystrokes === 0) {
    return 100;
  }
  return (correctKeystrokes / keystrokes) * 100;
}

export function progressRatio(validatedChars: number, textLength: number): number {
  if (textLength <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, validatedChars / textLength));
}
