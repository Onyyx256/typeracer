"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
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
};

const primary =
  "h-11 w-full cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";
const secondary =
  "flex h-11 w-full cursor-pointer items-center justify-center border border-line px-6 font-medium transition-colors hover:border-primary-text disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";

export function JoinRoom({ dict, locale, code, full, elsewhere }: JoinRoomProps) {
  const [error, setError] = useState<JoinRoomActionError | null>(null);
  const [pending, startTransition] = useTransition();

  function join(role: HostRole) {
    setError(null);
    startTransition(async () => {
      // On success the action redirects back here, now as a member.
      const result = await joinRoomAction({
        lang: locale,
        code,
        role,
        leaveCurrent: elsewhere !== null,
      });
      setError(result.error);
    });
  }

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
        onClick={() => join("participant")}
      >
        {dict.join}
      </button>
      <button
        type="button"
        className={secondary}
        disabled={pending}
        onClick={() => join("spectator")}
      >
        {dict.joinSpectator}
      </button>
      <p role="status" className="min-h-5 font-mono text-sm text-accent-text">
        {error ? <>&gt; {dict.errors[error]}</> : full && <>&gt; {dict.errors.full}</>}
      </p>
    </div>
  );
}
