import "server-only";

export const MAX_CODE_MISSES = 10;
export const CODE_MISS_WINDOW_MS = 60_000;
const PRUNE_ABOVE = 10_000;

/**
 * In memory: the app runs as a single process, and losing the counts on a
 * restart only gives a guesser one extra minute.
 */
const misses = new Map<string, { count: number; resetAt: number }>();

/** Only misses count, so someone typing the right code is never slowed down. */
export function tooManyCodeMisses(ip: string, now = Date.now()): boolean {
  const entry = misses.get(ip);
  return entry !== undefined && entry.resetAt > now && entry.count >= MAX_CODE_MISSES;
}

export function recordCodeMiss(ip: string, now = Date.now()): void {
  const entry = misses.get(ip);
  if (entry && entry.resetAt > now) {
    entry.count++;
    return;
  }
  if (misses.size >= PRUNE_ABOVE) {
    for (const [key, value] of misses) {
      if (value.resetAt <= now) {
        misses.delete(key);
      }
    }
  }
  misses.set(ip, { count: 1, resetAt: now + CODE_MISS_WINDOW_MS });
}

export function resetCodeMisses(): void {
  misses.clear();
}
