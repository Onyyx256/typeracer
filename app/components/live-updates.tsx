"use client";

import { EVENTS } from "@/lib/realtime/events";
import { useLiveRefresh, useSocketIdentity } from "@/lib/realtime/client";

/**
 * An open tab is how the server knows a member is still there. Rendered for
 * guests too (null), so logging out reconnects the socket as a guest.
 */
export function Presence({ userId }: { userId: string | null }) {
  useSocketIdentity(userId);
  return null;
}

export function LiveRoom({ code }: { code: string }) {
  useLiveRefresh({
    watch: EVENTS.watchRoom,
    unwatch: EVENTS.unwatchRoom,
    changed: EVENTS.roomChanged,
    payload: { code },
  });
  return null;
}

export function LiveLobby() {
  useLiveRefresh({
    watch: EVENTS.watchLobby,
    unwatch: EVENTS.unwatchLobby,
    changed: EVENTS.lobbyChanged,
  });
  return null;
}
