import { BURST_KEYS, MAX_KEYS_PER_BATCH, MAX_KEYS_PER_SECOND, START_KEYS } from "./engine";

/**
 * The browser's copy of the server's speed check (Race.applyKeys). The
 * server refuses a whole batch that needs more keys than it allows, and
 * those keys are lost; so the browser sends only what fits and keeps the
 * rest for the next send. It matters after a reconnection, when everything
 * typed offline would otherwise go in one batch above the burst.
 */
export type SendAllowance = { tokens: number; at: number };

/**
 * Less than the server's burst: messages can reach the server closer
 * together than they were sent, which leaves it less time to refill.
 */
export const SEND_BURST = BURST_KEYS - 10;

export function startAllowance(startsAt: number): SendAllowance {
  return { tokens: START_KEYS, at: startsAt };
}

export function keysAllowed(allowance: SendAllowance, now: number): number {
  const refill = (Math.max(0, now - allowance.at) / 1000) * MAX_KEYS_PER_SECOND;
  const tokens = Math.min(SEND_BURST, allowance.tokens + refill);
  return Math.min(MAX_KEYS_PER_BATCH, Math.floor(tokens));
}

export function spendAllowance(
  allowance: SendAllowance,
  now: number,
  count: number,
): SendAllowance {
  const refill = (Math.max(0, now - allowance.at) / 1000) * MAX_KEYS_PER_SECOND;
  const tokens = Math.min(SEND_BURST, allowance.tokens + refill);
  return { tokens: tokens - count, at: Math.max(now, allowance.at) };
}
