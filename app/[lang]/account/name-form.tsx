"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TextField } from "@/app/components/text-field";
import { USERNAME_MAX, USERNAME_MIN } from "@/lib/auth/validation";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";
import { updateDisplayNameAction, type AccountError } from "./actions";
import { primaryButton } from "./styles";

const LIMITS = { min: USERNAME_MIN, max: USERNAME_MAX };

/** AUTH-05: the display name, with the same rules as a nickname. */
export function NameForm({
  displayName,
  dict,
}: {
  displayName: string;
  dict: Dictionary["accountPage"];
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [error, setError] = useState<AccountError | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateDisplayNameAction({ displayName: name });
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={save} className="grid max-w-md gap-3">
      <TextField
        label={dict.name.label}
        name="displayName"
        value={name}
        onChange={(value) => {
          setName(value);
          setSaved(false);
        }}
        autoComplete="nickname"
        maxLength={USERNAME_MAX}
        hint={interpolate(dict.name.hint, LIMITS)}
        error={error ? interpolate(dict.errors[error], LIMITS) : undefined}
      />
      <p className="text-sm text-muted">{dict.name.note}</p>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          className={primaryButton}
          disabled={pending || name.trim() === displayName}
        >
          {dict.name.save}
        </button>
        <p role="status" className="font-mono text-sm text-accent-text">
          {saved && <>&gt; {dict.name.saved}</>}
        </p>
      </div>
    </form>
  );
}
