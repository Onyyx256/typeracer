import "server-only";
import { attemptLimiter, limitFromEnv } from "@/lib/rate-limit";

export const MAX_CODE_MISSES = limitFromEnv("CODE_MISS_LIMIT", 10);
export const CODE_MISS_WINDOW_MS = 60_000;

const misses = attemptLimiter(MAX_CODE_MISSES, CODE_MISS_WINDOW_MS, "codeMisses");

/** Only misses count, so someone typing the right code is never slowed down. */
export function tooManyCodeMisses(ip: string, now = Date.now()): boolean {
  return misses.blocked(ip, now);
}

export function recordCodeMiss(ip: string, now = Date.now()): void {
  misses.record(ip, now);
}

export function resetCodeMisses(): void {
  misses.reset();
}
