import "server-only";
import { attemptLimiter, limitFromEnv } from "@/lib/rate-limit";

export const LOGIN_WINDOW_MS = 15 * 60_000;
export const MAX_FAILURES_PER_ACCOUNT = 5;
export const MAX_FAILURES_PER_IP = limitFromEnv("LOGIN_FAILURE_LIMIT", 30);

// Per account and address, so a stranger guessing can't lock the real owner out.
const perAccount = attemptLimiter(MAX_FAILURES_PER_ACCOUNT, LOGIN_WINDOW_MS);
// Per address, against one machine trying a few passwords on many accounts.
const perIp = attemptLimiter(MAX_FAILURES_PER_IP, LOGIN_WINDOW_MS);

function accountKey(ip: string, username: string): string {
  return `${ip} ${username.toLowerCase()}`;
}

/** Only failures count, so someone who types their password right is never slowed down. */
export function tooManyLoginFailures(ip: string, username: string, now = Date.now()): boolean {
  return perIp.blocked(ip, now) || perAccount.blocked(accountKey(ip, username), now);
}

export function recordLoginFailure(ip: string, username: string, now = Date.now()): void {
  perIp.record(ip, now);
  perAccount.record(accountKey(ip, username), now);
}

export function resetLoginFailures(): void {
  perIp.reset();
  perAccount.reset();
}
