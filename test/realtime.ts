import type { Server } from "socket.io";
import { realtimeState } from "@/lib/realtime/state";

const IO_KEY = Symbol.for("nelumbotype.io");

export type FakeEmit = { target: string; event: string; payload: unknown };

/**
 * Pretends the real-time server is running, so presence is actually
 * tracked (without it everyone counts as connected). Room notifications go
 * nowhere, but are recorded in the returned list.
 */
export function installFakeIo(): FakeEmit[] {
  const emitted: FakeEmit[] = [];
  const channel = (target: string) => ({
    emit: (event: string, payload?: unknown) => {
      emitted.push({ target, event, payload });
      return true;
    },
    socketsLeave: () => undefined,
  });
  const fake = { to: channel, in: channel };
  (globalThis as Record<symbol, unknown>)[IO_KEY] = fake as unknown as Server;
  return emitted;
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
