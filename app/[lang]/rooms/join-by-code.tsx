"use client";

import { useState, useTransition } from "react";
import { TextField } from "@/app/components/text-field";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import { ROOM_CODE_LENGTH } from "@/lib/rooms/code";
import { findRoomAction, type FindRoomError } from "./actions";

type JoinByCodeProps = {
  dict: Dictionary["roomsPage"]["joinByCode"];
  locale: Locale;
};

export function JoinByCode({ dict, locale }: JoinByCodeProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<FindRoomError | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || code.length === 0) return;
        setError(null);
        startTransition(async () => {
          // On success the action redirects to the room.
          const result = await findRoomAction({ lang: locale, code });
          setError(result.error);
        });
      }}
      className="grid w-full max-w-sm gap-2"
    >
      <h2 className="font-display text-xl font-semibold">{dict.heading}</h2>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            label={dict.label}
            name="code"
            value={code}
            onChange={(value) => setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            autoComplete="off"
            maxLength={ROOM_CODE_LENGTH}
            hint={dict.hint}
            error={error ? dict.errors[error] : undefined}
          />
        </div>
        <button
          type="submit"
          aria-disabled={pending || code.length === 0 || undefined}
          className="h-11 shrink-0 cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 rounded-leaf"
        >
          {dict.submit}
        </button>
      </div>
    </form>
  );
}
