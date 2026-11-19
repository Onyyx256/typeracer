"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";
import type { InviteStatus } from "@/lib/rooms/invites";
import { createInviteAction, type CreateInviteActionResult } from "../actions";

export type InviteLink = {
  url: string;
  status: InviteStatus;
  name: string | null;
};

type InviteLinksProps = {
  dict: RoomDictionary["invites"];
  invites: InviteLink[];
  /** A code-only room can also be joined with its code. */
  codeOnly: boolean;
};

type CreateError = Extract<CreateInviteActionResult, { ok: false }>["error"];

const STATUS_STYLE: Record<InviteStatus, string> = {
  pending: "text-muted",
  accepted: "text-primary-text",
  revoked: "text-accent-text",
};

export function InviteLinks({ dict, invites, codeOnly }: InviteLinksProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<CreateError | null>(null);
  const [copied, setCopied] = useState<{ index: number; ok: boolean } | null>(null);

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createInviteAction();
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  async function copy(index: number, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied({ index, ok: true });
    } catch {
      setCopied({ index, ok: false });
    }
  }

  function statusText(invite: InviteLink): string {
    if (invite.status !== "accepted") {
      return dict.status[invite.status];
    }
    return invite.name ? interpolate(dict.status.accepted, { name: invite.name }) : dict.status.acceptedAnon;
  }

  return (
    <section>
      <h2 className="flex items-center gap-4 font-display text-2xl font-semibold">
        {dict.heading}
        <span className="font-mono text-sm font-normal text-muted">{invites.length}</span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">{codeOnly ? dict.leadCode : dict.lead}</p>

      {invites.length === 0 ? (
        <p className="mt-4 font-mono text-sm text-muted">&gt; {dict.empty}</p>
      ) : (
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {invites.map((invite, index) => {
            const number = String(index + 1);
            return (
              <li key={invite.url} className="grid content-start gap-1.5 border border-line bg-background px-4 py-3 rounded-leaf">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{interpolate(dict.number, { number })}</span>
                  <span
                    className={`min-w-0 text-right font-mono text-xs break-words ${STATUS_STYLE[invite.status]}`}
                  >
                    {statusText(invite)}
                  </span>
                </div>
                {invite.status !== "revoked" && (
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={invite.url}
                      aria-label={interpolate(dict.number, { number })}
                      onFocus={(event) => event.currentTarget.select()}
                      className="h-9 min-w-0 flex-1 border border-line bg-surface px-2 font-mono text-xs rounded-leaf"
                    />
                    <button
                      type="button"
                      onClick={() => copy(index, invite.url)}
                      aria-label={interpolate(dict.copyLabel, { number })}
                      className="h-9 shrink-0 cursor-pointer border border-line px-3 text-sm font-medium transition-colors hover:border-primary-text rounded-leaf"
                    >
                      {dict.copy}
                    </button>
                  </div>
                )}
                {copied?.index === index && (
                  <p role="status" className="font-mono text-xs text-muted">
                    &gt; {copied.ok ? dict.copied : dict.copyFailed}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <button
        type="button"
        onClick={create}
        disabled={pending}
        className="mt-3 h-11 cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf"
      >
        {dict.create}
      </button>
      <p role="status" className="mt-2 min-h-5 font-mono text-sm text-accent-text">
        {error && <>&gt; {dict.errors[error]}</>}
      </p>
    </section>
  );
}
