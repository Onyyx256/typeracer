"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { TextField } from "@/app/components/text-field";
import { USERNAME_MAX, USERNAME_MIN } from "@/lib/auth/validation";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";
import { isNameError } from "@/lib/rooms/names";
import type { HostRole } from "@/lib/rooms/settings";
import { joinRoomAction, type RoomActionError } from "../actions";

type JoinRoomProps = {
  dict: RoomDictionary;
  locale: Locale;
  code: string;
  /** No seat left for a runner; spectators can still come in. */
  full: boolean;
  /** The room the visitor is in already, if any (SALLE-06). */
  elsewhere: string | null;
  /**
   * What the name field starts with: the account's display name or the
   * guest's nickname, empty for a visitor without a session (who joins as a
   * guest, AUTH-02).
   */
  defaultName: string;
  hasSession: boolean;
};

const primary =
  "h-11 w-full cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";
const secondary =
  "flex h-11 w-full cursor-pointer items-center justify-center border border-line px-6 font-medium transition-colors hover:border-primary-text disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";

const LIMITS = { min: USERNAME_MIN, max: USERNAME_MAX };

/** Everyone picks their name for the room on the way in; it must be free there. */
export function JoinRoom({
  dict,
  locale,
  code,
  full,
  elsewhere,
  defaultName,
  hasSession,
}: JoinRoomProps) {
  const [error, setError] = useState<RoomActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(defaultName);
  const [role, setRole] = useState<HostRole>("participant");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  function choose(chosen: HostRole) {
    setRole(chosen);
    setError(null);
    dialog.current?.showModal();
  }

  function join() {
    setError(null);
    startTransition(async () => {
      // On success the action redirects back here, now as a member.
      const result = await joinRoomAction({
        lang: locale,
        code,
        role,
        name,
        leaveCurrent: elsewhere !== null,
      });
      setError(result.error);
      // Other errors (full room...) show beside the buttons.
      if (!isNameError(result.error)) {
        dialog.current?.close();
      }
    });
  }

  const message = error ? interpolate(dict.errors[error], LIMITS) : null;
  const nameError = isNameError(error) ? message : null;
  const t = dict.nameDialog;

  return (
    <div className="grid gap-2">
      {elsewhere && (
        <>
          <p className="text-sm">{interpolate(dict.elsewhere, { code: elsewhere })}</p>
          <Link href={localePath(locale, `/rooms/${elsewhere}`)} className={secondary}>
            {interpolate(dict.goBack, { code: elsewhere })}
          </Link>
          <p className="mt-2 font-mono text-xs text-muted">&gt; {dict.leaveAndJoin}</p>
        </>
      )}
      <button
        type="button"
        className={primary}
        disabled={pending || full}
        onClick={() => choose("participant")}
      >
        {dict.join}
      </button>
      <button
        type="button"
        className={secondary}
        disabled={pending}
        onClick={() => choose("spectator")}
      >
        {dict.joinSpectator}
      </button>
      <p role="status" className="min-h-5 font-mono text-sm text-accent-text">
        {message && !nameError ? <>&gt; {message}</> : full && <>&gt; {dict.errors.full}</>}
      </p>

      {/* A native modal dialog: focus moves in, Escape closes it, the page behind is inert. */}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(26rem,calc(100%-2rem))] border border-line bg-background p-6 text-foreground rounded-leaf backdrop:bg-black/50"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            join();
          }}
          className="grid gap-5"
        >
          <div>
            <h2 id={titleId} className="font-display text-2xl font-semibold">
              {t.title}
            </h2>
            <p className="mt-1 text-sm text-muted">{hasSession ? t.lead : t.guestLead}</p>
          </div>
          <TextField
            label={t.label}
            name="name"
            value={name}
            onChange={setName}
            autoComplete="nickname"
            maxLength={USERNAME_MAX}
            hint={interpolate(t.hint, LIMITS)}
            error={nameError ?? undefined}
          />
          <div className="grid gap-2">
            <button type="submit" className={primary} disabled={pending}>
              {role === "participant" ? dict.join : dict.joinSpectator}
            </button>
            <button
              type="button"
              className={secondary}
              onClick={() => dialog.current?.close()}
            >
              {t.cancel}
            </button>
          </div>
          {!hasSession && (
            <Link
              href={localePath(locale, "/login")}
              className="text-center text-sm font-medium text-primary-text underline underline-offset-4"
            >
              {t.login}
            </Link>
          )}
        </form>
      </dialog>
    </div>
  );
}
