import type { ResultStatus } from "./types";

export type Rankable = {
  status: ResultStatus;
  progress: number;
  durationMs: number;
};

const STATUS_ORDER: Record<ResultStatus, number> = { finished: 0, timeUp: 1, abandoned: 2 };

/**
 * Finishers by time, then those the time limit stopped by progress, then
 * those who abandoned. Ties keep the given order.
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
