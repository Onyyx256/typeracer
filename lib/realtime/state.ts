import "server-only";
import type { Server } from "socket.io";

/**
 * Real-time state lives on globalThis: server.ts creates the Socket.IO
 * server there, and Next bundles instrumentation.ts and server actions as
 * separate module graphs, so module-level variables would not be shared.
 */
type RealtimeState = {
  /** Open sockets per signed-in user (several tabs = several sockets). */
  sockets: Map<string, number>;
  leaveTimers: Map<string, ReturnType<typeof setTimeout>>;
  /** When each channel last changed, for pages that subscribe after rendering. */
  changedAt: Map<string, number>;
  handlersAttached: boolean;
};

const IO_KEY = Symbol.for("nelumbotype.io");
const STATE_KEY = Symbol.for("nelumbotype.realtime");

type Globals = Record<symbol, unknown>;

/** Null under plain `next dev`/`next build`, where server.ts isn't running. */
export function getIo(): Server | null {
  return ((globalThis as Globals)[IO_KEY] as Server | undefined) ?? null;
}

/**
 * Fills in any field the stored object lacks: in development the object
 * outlives hot reloads, so it can predate a field added to the code since.
 */
export function realtimeState(): RealtimeState {
  const globals = globalThis as Globals;
  const stored = (globals[STATE_KEY] ?? {}) as Partial<RealtimeState>;
  const state: RealtimeState = {
    sockets: stored.sockets ?? new Map(),
    leaveTimers: stored.leaveTimers ?? new Map(),
    changedAt: stored.changedAt ?? new Map(),
    handlersAttached: stored.handlersAttached ?? false,
  };
  globals[STATE_KEY] = Object.assign(stored, state);
  return stored as RealtimeState;
}
