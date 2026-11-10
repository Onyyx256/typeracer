"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import type { RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";
import { transferHostAction, type TransferHostActionResult } from "../actions";

type TransferError = Extract<TransferHostActionResult, { ok: false }>["error"];

const primary =
  "h-11 w-full cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";
const secondary =
  "flex h-11 w-full cursor-pointer items-center justify-center border border-line px-6 font-medium transition-colors hover:border-primary-text disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";

export function MakeHost({
  dict,
  userId,
  name,
}: {
  dict: RoomDictionary;
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<TransferError | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = dict.makeHostDialog;

  function transfer() {
    setError(null);
    startTransition(async () => {
      const result = await transferHostAction({ userId });
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
        aria-label={interpolate(dict.makeHostLabel, { name })}
        title={dict.makeHost}
        className="flex size-8 cursor-pointer items-center justify-center border border-line text-accent-text transition-colors hover:border-accent-text rounded-leaf"
      >
        <CrownIcon />
      </button>
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
            <button type="button" className={primary} disabled={pending} onClick={transfer}>
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
            {error && <>&gt; {dict.makeHostErrors[error]}</>}
          </p>
        </div>
      </dialog>
    </>
  );
}

function CrownIcon() {
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
      <path d="M3 18h18" />
      <path d="M4 15 3 7l5 4 4-6 4 6 5-4-1 8Z" />
    </svg>
  );
}
