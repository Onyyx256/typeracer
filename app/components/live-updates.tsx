"use client";

import { EVENTS } from "@/lib/realtime/events";
import { useLiveRefresh } from "@/lib/realtime/client";

export function LiveRoom({ code, renderedAt }: { code: string; renderedAt: number }) {
  useLiveRefresh({
    watch: EVENTS.watchRoom,
    unwatch: EVENTS.unwatchRoom,
    changed: EVENTS.roomChanged,
    payload: { code },
    renderedAt,
  });
  return null;
}

export function LiveLobby({ renderedAt }: { renderedAt: number }) {
  useLiveRefresh({
    watch: EVENTS.watchLobby,
    unwatch: EVENTS.unwatchLobby,
    changed: EVENTS.lobbyChanged,
    renderedAt,
  });
  return null;
}
