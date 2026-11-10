"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { EVENTS, type RoomClosed as RoomClosedPayload, type RoomClosedReason } from "@/lib/realtime/events";
import { getSocket } from "@/lib/realtime/client";

/**
 * SALLE-08: tells a member that their room was deleted while they were in
 * it (the host left and no signed-in member could take over, or the host
 * deleted it). The server
 * sends this to their own tabs only. Mounted in the layout, so a room page
 * re-rendering into a 404 at the same moment doesn't take the notice away.
 */
export function RoomClosed({
  dict,
  locale,
}: {
  dict: RoomDictionary["closed"];
  locale: Locale;
}) {
  const [closed, setClosed] = useState<RoomClosedReason | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const socket = getSocket();
    const onClosed = (payload: RoomClosedPayload) => setClosed(payload.reason);
    socket.on(EVENTS.roomClosed, onClosed);
    return () => {
      socket.off(EVENTS.roomClosed, onClosed);
    };
  }, []);

  useEffect(() => {
    if (closed && !dialog.current?.open) {
      dialog.current?.showModal();
    }
  }, [closed]);

  function dismiss() {
    dialog.current?.close();
    setClosed(null);
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      // The room is gone: Escape doesn't hide the notice over a stale page.
      onCancel={(event) => event.preventDefault()}
      className="fixed top-1/2 left-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line bg-background p-8 text-left text-foreground rounded-leaf backdrop:bg-black/50"
    >
      <h2 id={titleId} className="font-display text-3xl leading-tight font-semibold">
        {dict.title}
      </h2>
      <p className="mt-3 text-muted">{closed === "deleted" ? dict.deletedLead : dict.lead}</p>
      <Link
        href={localePath(locale, "/rooms")}
        onClick={dismiss}
        className="mt-6 inline-flex h-11 items-center bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 rounded-leaf"
      >
        {dict.back}
      </Link>
    </dialog>
  );
}
