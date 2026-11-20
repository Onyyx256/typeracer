import "server-only";
import { attemptLimiter, limitFromEnv } from "@/lib/rate-limit";

export const MAX_GUESTS = limitFromEnv("GUEST_LIMIT", 20);
export const GUEST_WINDOW_MS = 10 * 60_000;

const guests = attemptLimiter(MAX_GUESTS, GUEST_WINDOW_MS);

export function tooManyGuests(ip: string, now = Date.now()): boolean {
  return guests.blocked(ip, now);
}

export function recordGuest(ip: string, now = Date.now()): void {
  guests.record(ip, now);
}

export function resetGuests(): void {
  guests.reset();
}
