"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { TextField } from "@/app/components/text-field";
import { USERNAME_MAX, USERNAME_MIN } from "@/lib/auth/validation";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";
import type { HostRole } from "@/lib/rooms/settings";
import { joinRoomAction, type JoinRoomActionError } from "../actions";

type JoinRoomProps = {
  dict: RoomDictionary;
  locale: Locale;
  code: string;
  /** No seat left for a runner; spectators can still come in. */
  full: boolean;
  /** The room the visitor is in already, if any (SALLE-06). */
  elsewhere: string | null;
  /** The visitor has no session: they pick a nickname and join as a guest (AUTH-02). */
  needsNickname: boolean;
};

const primary =
  "h-11 w-full cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";
const secondary =
  "flex h-11 w-full cursor-pointer items-center justify-center border border-line px-6 font-medium transition-colors hover:border-primary-text disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";

const LIMITS = { min: USERNAME_MIN, max: USERNAME_MAX };
const NICKNAME_ERRORS: JoinRoomActionError[] = ["nicknameLength", "nicknameChars"];

export function JoinRoom({
  dict,
  locale,
  code,
  full,
  elsewhere,
  needsNickname,
}: JoinRoomProps) {
  const [error, setError] = useState<JoinRoomActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState<HostRole>("participant");
  const dialog = useRef<HTMLDialogElement>(null);

  function join(chosen: HostRole, guestNickname?: string) {
    setError(null);
    startTransition(async () => {
      // On success the action redirects back here, now as a member.
      const result = await joinRoomAction({
        lang: locale,
        code,
        role: chosen,
        leaveCurrent: elsewhere !== null,
        nickname: guestNickname,
      });
      setError(result.error);
      // Once the guest exists, other errors (full room...) show beside the buttons.
      if (!NICKNAME_ERRORS.includes(result.error)) {
        dialog.current?.close();
      }
    });
  }

  function choose(chosen: HostRole) {
    if (!needsNickname) {
      join(chosen);
      return;
    }
    setRole(chosen);
    setError(null);
    dialog.current?.showModal();
  }

  const message = error ? interpolate(dict.errors[error], LIMITS) : null;
  const nicknameError = error && NICKNAME_ERRORS.includes(error) ? message : null;
  const g = dict.guest;

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
        {message && !nicknameError ? (
          <>&gt; {message}</>
        ) : (
          full && <>&gt; {dict.errors.full}</>
        )}
      </p>

      {needsNickname && (
        // A native modal dialog: focus moves in, Escape closes it, the page behind is inert.
        <dialog
          ref={dialog}
          aria-labelledby="guest-title"
          className="m-auto w-[min(26rem,calc(100%-2rem))] border border-line bg-background p-6 text-foreground rounded-leaf backdrop:bg-black/50"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              join(role, nickname);
            }}
            className="grid gap-5"
          >
            <div>
              <h2 id="guest-title" className="font-display text-2xl font-semibold">
                {g.title}
              </h2>
              <p className="mt-1 text-sm text-muted">{g.lead}</p>
            </div>
            <TextField
              label={g.label}
              name="nickname"
              value={nickname}
              onChange={setNickname}
              autoComplete="nickname"
              maxLength={USERNAME_MAX}
              hint={interpolate(g.hint, LIMITS)}
              error={nicknameError ?? undefined}
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
                {g.cancel}
              </button>
            </div>
            <Link
              href={localePath(locale, "/login")}
              className="text-center text-sm font-medium text-primary-text underline underline-offset-4"
            >
              {g.login}
            </Link>
          </form>
        </dialog>
      )}
    </div>
  );
}
