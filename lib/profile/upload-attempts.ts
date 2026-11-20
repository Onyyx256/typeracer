import "server-only";
import { attemptLimiter } from "@/lib/rate-limit";

export const MAX_UPLOADS = 10;
export const UPLOAD_WINDOW_MS = 10 * 60_000;

/** Each photo is decoded and re-encoded, so a loop of uploads would keep the server busy. */
const uploads = attemptLimiter(MAX_UPLOADS, UPLOAD_WINDOW_MS);

export function tooManyUploads(userId: string, now = Date.now()): boolean {
  return uploads.blocked(userId, now);
}

export function recordUpload(userId: string, now = Date.now()): void {
  uploads.record(userId, now);
}

export function resetUploads(): void {
  uploads.reset();
}
