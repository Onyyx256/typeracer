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
  handlersAttached: boolean;
};

const IO_KEY = Symbol.for("nelumbotype.io");
const STATE_KEY = Symbol.for("nelumbotype.realtime");

type Globals = Record<symbol, unknown>;

/** Null under plain `next dev`/`next build`, where server.ts isn't running. */
export function getIo(): Server | null {
  return ((globalThis as Globals)[IO_KEY] as Server | undefined) ?? null;
}

export function realtimeState(): RealtimeState {
  const globals = globalThis as Globals;
  globals[STATE_KEY] ??= {
    sockets: new Map(),
    leaveTimers: new Map(),
    handlersAttached: false,
  } satisfies RealtimeState;
  return globals[STATE_KEY] as RealtimeState;
}
