"use client";

import { EVENTS } from "@/lib/realtime/events";
import { useLiveRefresh, useSocketIdentity } from "@/lib/realtime/client";

/**
 * Keeps the tab's socket open as the signed-in user, on every page: an open
 * tab is how the server knows a member is still there (SALLE-08). Rendered
 * for guests too (null), so logging out reconnects the socket as a guest.
 */
export function Presence({ userId }: { userId: string | null }) {
  useSocketIdentity(userId);
  return null;
}

/** Re-renders a room page when its members, host or settings change (CONF-12). */
export function LiveRoom({ code }: { code: string }) {
  useLiveRefresh({
    watch: EVENTS.watchRoom,
    unwatch: EVENTS.unwatchRoom,
    changed: EVENTS.roomChanged,
    payload: { code },
  });
  return null;
}

/** Re-renders the public room list when a room opens, changes or closes (JOIN-02). */
export function LiveLobby() {
  useLiveRefresh({
    watch: EVENTS.watchLobby,
    unwatch: EVENTS.unwatchLobby,
    changed: EVENTS.lobbyChanged,
  });
  return null;
}
