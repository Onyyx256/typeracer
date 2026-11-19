import type { WpmPoint } from "./types";

export type Mistake = { t: number; wpm: number; count: number };

/** The samples where the running count of wrong keystrokes went up, and by how much. */
export function mistakesOf(series: readonly WpmPoint[]): Mistake[] {
  const mistakes: Mistake[] = [];
  let before = 0;
  for (const point of series) {
    if (point.errors === undefined) {
      continue;
    }
    if (point.errors > before) {
      mistakes.push({ t: point.t, wpm: point.wpm, count: point.errors - before });
    }
    before = point.errors;
  }
  return mistakes;
}
