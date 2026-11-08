"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import type { RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";
import { kickMemberAction, type KickActionResult } from "../actions";

type KickError = Extract<KickActionResult, { ok: false }>["error"];

/** Red, not the accent pink: removing someone can't be undone. */
const danger =
  "h-11 w-full cursor-pointer bg-danger px-6 font-medium text-on-danger transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";
const secondary =
  "flex h-11 w-full cursor-pointer items-center justify-center border border-line px-6 font-medium transition-colors hover:border-primary-text disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";

/** SALLE-07: shown to the host beside each other member; asks before removing them. */
export function KickMember({
  dict,
  userId,
  name,
}: {
  dict: RoomDictionary;
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<KickError | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = dict.kickDialog;

  function kick() {
    setError(null);
    startTransition(async () => {
      const result = await kickMemberAction({ userId });
      if (result.ok) {
        dialog.current?.close();
        // The live update does this too; this covers a missing socket.
        router.refresh();
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
        aria-label={interpolate(dict.kickLabel, { name })}
        title={dict.kick}
        className="flex size-8 cursor-pointer items-center justify-center border border-danger/40 text-danger transition-colors hover:border-danger hover:bg-danger/10 rounded-leaf"
      >
        <RemovePersonIcon />
      </button>
      {/* Same centered native dialog as the join form. */}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="fixed top-1/2 left-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line bg-background p-6 text-left font-sans text-base tracking-normal normal-case text-foreground rounded-leaf backdrop:bg-black/50"
      >
        <div className="grid gap-5">
          <div>
            <h2 id={titleId} className="font-display text-2xl font-semibold break-words">
              {interpolate(t.title, { name })}
            </h2>
            <p className="mt-1 text-sm text-muted">{t.lead}</p>
          </div>
          <div className="grid gap-2">
            <button type="button" className={danger} disabled={pending} onClick={kick}>
              {t.confirm}
            </button>
            <button
              type="button"
              className={secondary}
              onClick={() => dialog.current?.close()}
            >
              {t.cancel}
            </button>
          </div>
          <p role="status" className="min-h-5 font-mono text-sm text-danger">
            {error && <>&gt; {dict.kickErrors[error]}</>}
          </p>
        </div>
      </dialog>
    </>
  );
}

/** A person with a minus sign: removes someone, doesn't delete anything. */
function RemovePersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
      <path d="M16 11h6" />
    </svg>
  );
}
