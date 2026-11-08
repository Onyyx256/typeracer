import type { Server } from "socket.io";
import { realtimeState } from "@/lib/realtime/state";

const IO_KEY = Symbol.for("nelumbotype.io");

/**
 * Pretends the real-time server is running, so presence is actually
 * tracked (without it everyone counts as connected). Room notifications go
 * nowhere.
 */
export function installFakeIo(): void {
  const room = { emit: () => true, socketsLeave: () => undefined };
  const fake = { to: () => room, in: () => room };
  (globalThis as Record<symbol, unknown>)[IO_KEY] = fake as unknown as Server;
}

/** Back to "no real-time server", with no sockets or pending timers left over. */
export function resetRealtime(): void {
  delete (globalThis as Record<symbol, unknown>)[IO_KEY];
  const state = realtimeState();
  for (const timer of state.leaveTimers.values()) {
    clearTimeout(timer);
  }
  state.leaveTimers.clear();
  state.sockets.clear();
}
