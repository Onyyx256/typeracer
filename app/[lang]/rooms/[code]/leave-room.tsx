"use client";

import { useId, useRef, useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { leaveClosesRoomAction, leaveRoomAction } from "../actions";

/** Red like the kick dialog: deleting the room can't be undone. */
const danger =
  "h-11 w-full cursor-pointer bg-danger px-6 font-medium text-on-danger transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";
const secondary =
  "flex h-11 w-full cursor-pointer items-center justify-center border border-line px-6 font-medium transition-colors hover:border-primary-text disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";

/**
 * Leaves the room. When the host is the last account in it, the room would
 * be deleted (SALLE-08), so it asks first. The server checks at click time,
 * since who is connected changes without the page re-rendering.
 */
export function LeaveRoom({ dict, locale }: { dict: RoomDictionary; locale: Locale }) {
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  const [checking, startTransition] = useTransition();
  const titleId = useId();
  const t = dict.leaveDialog;

  function leave() {
    confirmed.current = true;
    form.current?.requestSubmit();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmed.current) {
      return;
    }
    // Stops the form action until we know whether the room would close.
    event.preventDefault();
    startTransition(async () => {
      if (await leaveClosesRoomAction()) {
        dialog.current?.showModal();
      } else {
        leave();
      }
    });
  }

  return (
    <>
      <form ref={form} action={leaveRoomAction} onSubmit={onSubmit}>
        <input type="hidden" name="lang" value={locale} />
        <button
          type="submit"
          disabled={checking}
          className="h-11 cursor-pointer border border-line px-6 font-medium transition-colors hover:border-primary-text disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf"
        >
          {dict.leave}
        </button>
      </form>
      {/* Same centered native dialog as the kick confirmation. */}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="fixed top-1/2 left-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line bg-background p-6 text-left font-sans text-base tracking-normal normal-case text-foreground rounded-leaf backdrop:bg-black/50"
      >
        <div className="grid gap-5">
          <div>
            <h2 id={titleId} className="font-display text-2xl font-semibold break-words">
              {t.title}
            </h2>
            <p className="mt-1 text-sm text-muted">{t.lead}</p>
          </div>
          <div className="grid gap-2">
            <button type="button" className={danger} onClick={leave}>
              {t.confirm}
            </button>
            <button
              type="button"
              className={secondary}
              autoFocus
              onClick={() => dialog.current?.close()}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
