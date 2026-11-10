"use client";

import { useId, useRef } from "react";
import type { RaceDictionary } from "@/lib/i18n/dictionaries/fr";

const danger =
  "h-11 w-full cursor-pointer bg-danger px-6 font-medium text-on-danger transition-[filter] hover:brightness-110 rounded-leaf";
const secondary =
  "flex h-11 w-full cursor-pointer items-center justify-center border border-line px-6 font-medium transition-colors hover:border-primary-text rounded-leaf";

/** COURSE-07: giving up asks first; `onConfirm` then ends the runner's race. */
export function AbandonRace({ dict, onConfirm }: { dict: RaceDictionary; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = dict.abandonDialog;

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="h-11 cursor-pointer border border-danger/50 px-6 font-medium text-danger transition-colors hover:border-danger hover:bg-danger/10 rounded-leaf"
      >
        {dict.abandon}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="fixed top-1/2 left-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line bg-background p-6 text-left text-foreground rounded-leaf backdrop:bg-black/50"
      >
        <div className="grid gap-5">
          <div>
            <h2 id={titleId} className="font-display text-2xl font-semibold">
              {t.title}
            </h2>
            <p className="mt-1 text-sm text-muted">{t.lead}</p>
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              className={danger}
              onClick={() => {
                onConfirm();
                dialog.current?.close();
              }}
            >
              {t.confirm}
            </button>
            {/* Focused when the dialog opens, so a stray key never gives up the race. */}
            <button type="button" autoFocus className={secondary} onClick={() => dialog.current?.close()}>
              {t.cancel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
