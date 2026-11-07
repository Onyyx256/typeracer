import "server-only";
import { getIo, realtimeState } from "./state";

/**
 * A member with no open tab for this long counts as having left the room
 * (same delay as COURSE-08's reconnection window), so a reload or a short
 * network drop doesn't cost their seat.
 */
export const DISCONNECT_GRACE_MS = 30_000;

/**
 * Whether the user has the site open (SALLE-08 hands the host role to a
 * connected member). Without the real-time server, everyone counts as connected.
 */
export function isConnected(userId: string): boolean {
  if (!getIo()) {
    return true;
  }
  return (realtimeState().sockets.get(userId) ?? 0) > 0;
}

export function socketOpened(userId: string): void {
  const state = realtimeState();
  state.sockets.set(userId, (state.sockets.get(userId) ?? 0) + 1);
  const timer = state.leaveTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    state.leaveTimers.delete(userId);
  }
}

/** When the user's last socket closes, `onGone` runs after the grace delay unless they come back. */
export function socketClosed(userId: string, onGone: (userId: string) => void): void {
  const state = realtimeState();
  const count = (state.sockets.get(userId) ?? 1) - 1;
  if (count > 0) {
    state.sockets.set(userId, count);
    return;
  }
  state.sockets.delete(userId);
  scheduleGone(userId, onGone);
}

export function scheduleGone(userId: string, onGone: (userId: string) => void): void {
  const state = realtimeState();
  if (state.leaveTimers.has(userId) || isConnected(userId)) {
    return;
  }
  const timer = setTimeout(() => {
    state.leaveTimers.delete(userId);
    if (!isConnected(userId)) {
      onGone(userId);
    }
  }, DISCONNECT_GRACE_MS);
  // Don't keep the process alive just for this.
  timer.unref?.();
  state.leaveTimers.set(userId, timer);
}
