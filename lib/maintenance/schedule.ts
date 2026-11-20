import "server-only";
import { deleteExpiredData } from "./cleanup";

const EVERY_MS = 24 * 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;

const shared = globalThis as unknown as { cleanupScheduled?: boolean };

async function run(): Promise<void> {
  try {
    const counts = await deleteExpiredData();
    if (counts.guests > 0 || counts.rooms > 0) {
      console.log(`cleanup: deleted ${counts.guests} expired guests and ${counts.rooms} closed rooms`);
    }
  } catch (error) {
    console.error("cleanup failed:", error instanceof Error ? error.message : error);
  }
}

/** Once per process: dev hot reloads run instrumentation again. */
export function scheduleCleanup(): void {
  if (shared.cleanupScheduled) {
    return;
  }
  shared.cleanupScheduled = true;
  setTimeout(() => void run(), FIRST_RUN_DELAY_MS).unref();
  setInterval(() => void run(), EVERY_MS).unref();
}
