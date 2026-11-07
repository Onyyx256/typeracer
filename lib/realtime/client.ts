"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";

/** One connection per tab, shared by every component; the cookie identifies the user. */
let socket: Socket | null = null;
let identity: string | null = null;

export function getSocket(): Socket {
  socket ??= io({ withCredentials: true });
  return socket;
}

/**
 * The server reads the session cookie only when the socket connects, so
 * after logging in or out the socket reconnects as the new identity.
 */
export function useSocketIdentity(userId: string | null): void {
  useEffect(() => {
    if (identity === userId) {
      return;
    }
    identity = userId;
    // A guest only needs a socket on pages that watch something.
    if (!socket && userId === null) {
      return;
    }
    const current = getSocket();
    if (current.connected) {
      current.disconnect().connect();
    }
  }, [userId]);
}

/** Batches bursts of events into one re-render. */
const REFRESH_DELAY_MS = 150;

/**
 * Follows a channel and re-renders the page on the server when it changes,
 * so the page's own permission checks run again. Watches again after a
 * reconnection, since the server forgets channels on disconnect.
 */
export function useLiveRefresh(options: {
  watch: string;
  unwatch: string;
  changed: string;
  payload?: unknown;
}): void {
  const router = useRouter();
  const { watch, unwatch, changed } = options;
  const key = JSON.stringify(options.payload ?? null);

  useEffect(() => {
    const current = getSocket();
    const payload: unknown = JSON.parse(key);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const subscribe = () => current.emit(watch, payload);
    const onChanged = () => {
      timer ??= setTimeout(() => {
        timer = null;
        router.refresh();
      }, REFRESH_DELAY_MS);
    };

    subscribe();
    current.on("connect", subscribe);
    current.on(changed, onChanged);
    return () => {
      current.emit(unwatch);
      current.off("connect", subscribe);
      current.off(changed, onChanged);
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [router, watch, unwatch, changed, key]);
}
