"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { deleteRoomAction, type DeleteRoomActionResult } from "../actions";

type DeleteError = Extract<DeleteRoomActionResult, { ok: false }>["error"];

/** Red like the kick dialog: deleting the room can't be undone. */
const danger =
  "h-11 w-full cursor-pointer bg-danger px-6 font-medium text-on-danger transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";
const secondary =
  "flex h-11 w-full cursor-pointer items-center justify-center border border-line px-6 font-medium transition-colors hover:border-primary-text disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";

/**
 * Shown to the host beside the leave button: deletes the room at once,
 * without kicking everyone out first. Asks before doing it.
 */
export function DeleteRoom({ dict, locale }: { dict: RoomDictionary; locale: Locale }) {
  const router = useRouter();
  const [error, setError] = useState<DeleteError | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = dict.deleteDialog;

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteRoomAction();
      if (result.ok) {
        router.push(localePath(locale, "/"));
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          dialog.current?.showModal();
        }}
        className="h-11 cursor-pointer border border-danger/40 px-6 font-medium text-danger transition-colors hover:border-danger hover:bg-danger/10 rounded-leaf"
      >
        {dict.deleteRoom}
      </button>
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
            <button type="button" className={danger} disabled={pending} onClick={remove}>
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
          <p role="status" className="min-h-5 font-mono text-sm text-danger">
            {error && <>&gt; {dict.deleteErrors[error]}</>}
          </p>
        </div>
      </dialog>
    </>
  );
}
