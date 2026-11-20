import "server-only";
import * as z from "zod";

export type AttemptLimiter = {
  blocked(key: string, now?: number): boolean;
  record(key: string, now?: number): void;
  reset(): void;
};

const PRUNE_ABOVE = 10_000;

/**
 * At most `max` recorded attempts per key in a fixed window. In memory: the
 * app runs as a single process, and losing the counts on a restart only
 * gives an attacker one extra window.
 */
export function attemptLimiter(max: number, windowMs: number): AttemptLimiter {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  return {
    blocked(key, now = Date.now()) {
      const entry = attempts.get(key);
      return entry !== undefined && entry.resetAt > now && entry.count >= max;
    },
    record(key, now = Date.now()) {
      const entry = attempts.get(key);
      if (entry && entry.resetAt > now) {
        entry.count++;
        return;
      }
      if (attempts.size >= PRUNE_ABOVE) {
        for (const [stale, value] of attempts) {
          if (value.resetAt <= now) {
            attempts.delete(stale);
          }
        }
      }
      attempts.set(key, { count: 1, resetAt: now + windowMs });
    },
    reset() {
      attempts.clear();
    },
  };
}

/** A limit the end-to-end tests can raise, since all their browsers share one address. */
export function limitFromEnv(name: string, fallback: number): number {
  return z.coerce.number().int().positive().catch(fallback).parse(process.env[name] ?? fallback);
}
