import { afterEach, beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { installFakeIo, resetRealtime } from "@/test/realtime";
import {
  DISCONNECT_GRACE_MS,
  isConnected,
  scheduleGone,
  socketClosed,
  socketOpened,
} from "./presence";

const user = "user-1";

beforeEach(() => {
  jest.useFakeTimers();
  installFakeIo();
});

afterEach(() => {
  // Before going back to real timers, so the fake ones are the ones cleared.
  resetRealtime();
  jest.useRealTimers();
});

describe("presence grace period", () => {
  test("the grace period is 30 seconds", () => {
    expect(DISCONNECT_GRACE_MS).toBe(30_000);
  });

  test("a user counts as gone 30 s after their last tab closes, not before", () => {
    const onGone = mock();
    socketOpened(user);
    socketClosed(user, onGone);
    expect(isConnected(user)).toBe(false);

    jest.advanceTimersByTime(DISCONNECT_GRACE_MS - 1);
    expect(onGone).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onGone).toHaveBeenCalledTimes(1);
    expect(onGone).toHaveBeenCalledWith(user);
  });

  test("coming back within the grace period keeps the seat", () => {
    const onGone = mock();
    socketOpened(user);
    socketClosed(user, onGone);
    jest.advanceTimersByTime(DISCONNECT_GRACE_MS - 1_000);
    socketOpened(user);
    jest.advanceTimersByTime(DISCONNECT_GRACE_MS * 2);
    expect(onGone).not.toHaveBeenCalled();
    expect(isConnected(user)).toBe(true);
  });

  test("leaving again after coming back restarts the full delay", () => {
    const onGone = mock();
    socketOpened(user);
    socketClosed(user, onGone);
    jest.advanceTimersByTime(20_000);
    socketOpened(user);
    socketClosed(user, onGone);
    jest.advanceTimersByTime(DISCONNECT_GRACE_MS - 1);
    expect(onGone).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onGone).toHaveBeenCalledTimes(1);
  });

  test("closing one of several tabs changes nothing", () => {
    const onGone = mock();
    socketOpened(user);
    socketOpened(user);
    socketClosed(user, onGone);
    jest.advanceTimersByTime(DISCONNECT_GRACE_MS * 2);
    expect(onGone).not.toHaveBeenCalled();
    expect(isConnected(user)).toBe(true);

    socketClosed(user, onGone);
    jest.advanceTimersByTime(DISCONNECT_GRACE_MS);
    expect(onGone).toHaveBeenCalledTimes(1);
  });

  test("one timer per user, however often it is asked for", () => {
    const onGone = mock();
    scheduleGone(user, onGone);
    scheduleGone(user, onGone);
    jest.advanceTimersByTime(DISCONNECT_GRACE_MS);
    expect(onGone).toHaveBeenCalledTimes(1);
  });

  test("users are timed separately", () => {
    const onGone = mock();
    scheduleGone("early", onGone);
    jest.advanceTimersByTime(10_000);
    scheduleGone("late", onGone);
    jest.advanceTimersByTime(DISCONNECT_GRACE_MS - 10_000);
    expect(onGone.mock.calls).toEqual([["early"]]);
    jest.advanceTimersByTime(10_000);
    expect(onGone.mock.calls).toEqual([["early"], ["late"]]);
  });

  test("nothing is scheduled for a connected user", () => {
    const onGone = mock();
    socketOpened(user);
    scheduleGone(user, onGone);
    jest.advanceTimersByTime(DISCONNECT_GRACE_MS);
    expect(onGone).not.toHaveBeenCalled();
  });

  test("without the real-time server everyone counts as connected", () => {
    resetRealtime();
    const onGone = mock();
    expect(isConnected(user)).toBe(true);
    scheduleGone(user, onGone);
    jest.advanceTimersByTime(DISCONNECT_GRACE_MS);
    expect(onGone).not.toHaveBeenCalled();
  });
});
