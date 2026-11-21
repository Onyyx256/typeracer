"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import * as z from "zod";
import { RoomSettingsFields } from "@/app/components/room-settings-fields";
import { useSessionDraft } from "@/app/components/use-session-draft";
import type { Locale } from "@/lib/i18n/config";
import type { CreateRoomDictionary, RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { editableSettingsSchema, type EditableSettings } from "@/lib/rooms/settings";
import { updateRoomSettingsAction, type UpdateSettingsActionResult } from "../actions";

type UpdateError = Extract<UpdateSettingsActionResult, { ok: false }>["error"];

const draftSchema = z.object({ open: z.boolean(), settings: editableSettingsSchema });

const primary =
  "h-11 cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 disabled:cursor-wait disabled:opacity-70 rounded-leaf";
const secondary =
  "flex h-11 cursor-pointer items-center justify-center border border-line px-6 font-medium transition-colors hover:border-primary-text rounded-leaf";

export function EditSettings({
  code,
  dict,
  fieldsDict,
  locale,
  settings: current,
}: {
  code: string;
  dict: RoomDictionary;
  fieldsDict: CreateRoomDictionary;
  locale: Locale;
  settings: EditableSettings;
}) {
  const router = useRouter();
  // Saved only while the dialog is open, so a language switch reopens it as it was.
  const [draft, setDraft, clearDraft] = useSessionDraft(`edit-settings:${code}`, draftSchema, {
    open: false,
    settings: current,
  });
  const { open: isOpen, settings } = draft;
  const [error, setError] = useState<UpdateError | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = dict.editSettingsDialog;

  useEffect(() => {
    const element = dialog.current;
    if (isOpen && element && !element.open) element.showModal();
  }, [isOpen]);

  function open() {
    // Starts from what the room has now, not from an earlier draft.
    setDraft({ open: true, settings: current });
    setError(null);
  }

  function update(changes: Partial<EditableSettings>) {
    setDraft({ open: true, settings: { ...settings, ...changes } });
    setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editableSettingsSchema.safeParse(settings).success) {
      setError("invalid");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateRoomSettingsAction({ settings });
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
      <button type="button" onClick={open} className={`mt-6 w-full ${secondary}`}>
        {dict.editSettings}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClose={clearDraft}
        className="fixed top-1/2 left-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[min(48rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line bg-background p-0 text-left text-foreground rounded-leaf backdrop:bg-black/50"
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid gap-10 p-6">
            <div>
              <h2 id={titleId} className="font-display text-2xl font-semibold">
                {t.title}
              </h2>
              <p className="mt-1 text-sm text-muted">{t.lead}</p>
            </div>
            <RoomSettingsFields
              dict={fieldsDict}
              botsDict={dict.bots}
              locale={locale}
              settings={settings}
              update={update}
            />
          </div>
          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-background px-6 py-4">
            <p role="status" className="min-h-5 flex-1 font-mono text-sm text-danger">
              {pending ? (
                <span className="text-accent-text">&gt; {t.saving}</span>
              ) : (
                error && <>&gt; {dict.editSettingsErrors[error]}</>
              )}
            </p>
            <button type="button" className={secondary} onClick={() => dialog.current?.close()}>
              {t.cancel}
            </button>
            <button type="submit" className={primary} disabled={pending}>
              {t.save}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
