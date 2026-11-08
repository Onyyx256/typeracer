import type { ResultStatus } from "./types";

export type Rankable = {
  status: ResultStatus;
  /** Validated characters ÷ text length. */
  progress: number;
  /** From the start to finishing (or abandoning, or the end). */
  durationMs: number;
};

const STATUS_ORDER: Record<ResultStatus, number> = { finished: 0, timeUp: 1, abandoned: 2 };

/**
 * COURSE-10: finishers by finish time, then those the time limit stopped
 * by progress, then those who abandoned by their progress when they did.
 * Ties keep the given order. Returns new objects with `rank` from 1.
 */
export function rank<T extends Rankable>(entries: readonly T[]): (T & { rank: number })[] {
  return [...entries]
    .sort((a, b) => {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (byStatus !== 0) {
        return byStatus;
      }
      return a.status === "finished" ? a.durationMs - b.durationMs : b.progress - a.progress;
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
