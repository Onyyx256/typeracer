"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Avatar } from "@/app/components/avatar";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import { removeAvatarAction, uploadAvatarAction, type AccountError } from "./actions";
import { secondaryButton } from "./styles";

type Copy = Dictionary["accountPage"];

/** Same limit as the server; checked here too so a big file isn't sent for nothing. */
const MAX_BYTES = 2 * 1024 * 1024;

/** AUTH-04: the photo is sent as soon as it's chosen. */
export function PhotoForm({
  name,
  avatarUrl,
  dict,
}: {
  name: string;
  avatarUrl: string | null;
  dict: Copy;
}) {
  const router = useRouter();
  const inputId = useId();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ error: AccountError } | { done: string } | null>(null);

  function upload(file: File) {
    if (file.size > MAX_BYTES) {
      setStatus({ error: "avatarTooBig" });
      return;
    }
    const form = new FormData();
    form.set("photo", file);
    setStatus(null);
    startTransition(async () => {
      const result = await uploadAvatarAction(form);
      setStatus(result.ok ? { done: dict.photo.saved } : { error: result.error });
      if (result.ok) {
        router.refresh();
      }
    });
  }

  function remove() {
    setStatus(null);
    startTransition(async () => {
      const result = await removeAvatarAction();
      setStatus(result.ok ? { done: dict.photo.removed } : { error: result.error });
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar name={name} src={avatarUrl} className="size-24 text-4xl" />
      <div className="grid gap-2">
        <p className="text-sm text-muted">{dict.photo.lead}</p>
        <div className="flex flex-wrap gap-2">
          {/* The real input is hidden; its label is the button, so it stays keyboard-reachable. */}
          <input
            id={inputId}
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            className="peer sr-only"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                upload(file);
              }
            }}
          />
          <label
            htmlFor={inputId}
            className={`${secondaryButton} peer-focus-visible:outline-2 peer-focus-visible:outline-accent-text ${
              pending ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {dict.photo.choose}
          </label>
          {avatarUrl && (
            <button type="button" className={secondaryButton} disabled={pending} onClick={remove}>
              {dict.photo.remove}
            </button>
          )}
        </div>
        <p role="status" className="min-h-5 font-mono text-sm text-accent-text">
          {pending ? (
            <>&gt; {dict.photo.uploading}</>
          ) : status && "error" in status ? (
            <span className="text-danger">&gt; {dict.errors[status.error]}</span>
          ) : (
            status && <>&gt; {status.done}</>
          )}
        </p>
      </div>
    </div>
  );
}
