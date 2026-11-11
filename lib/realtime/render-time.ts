import "server-only";
import { connection } from "next/server";
import { changeClock } from "./notify";

/**
 * When a live page renders, for useLiveRefresh. Waits for the request first:
 * a time read while prerendering would be stale, and Next refuses it.
 */
export async function renderTime(): Promise<number> {
  await connection();
  return changeClock();
}
