import { afterEach, describe, expect, test } from "bun:test";
import { realtimeState } from "./state";

const STATE_KEY = Symbol.for("nelumbotype.realtime");
const globals = globalThis as Record<symbol, unknown>;
const original = globals[STATE_KEY];

afterEach(() => {
  globals[STATE_KEY] = original;
});

describe("realtimeState", () => {
  test("fills in a field missing from a state made by older code, keeping the rest", () => {
    const sockets = new Map([["user", 2]]);
    const stale = { sockets, leaveTimers: new Map(), handlersAttached: true };
    globals[STATE_KEY] = stale;

    const state = realtimeState();
    expect(state.changedAt).toBeInstanceOf(Map);
    expect(state.sockets).toBe(sockets);
    expect(state.handlersAttached).toBe(true);
    expect(realtimeState()).toBe(state);
    expect(globals[STATE_KEY]).toBe(stale);
  });
});
