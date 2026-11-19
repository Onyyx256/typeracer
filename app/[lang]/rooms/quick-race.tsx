"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";
import { roomLabel, type CurrentRoom } from "@/lib/rooms/label";
import { createDefaultRoomAction, quickRaceAction } from "./actions";

type QuickRaceProps = {
  dict: Dictionary["roomsPage"]["quickRace"];
  roomNames: Dictionary["roomNames"];
  locale: Locale;
  /** Guests can't host, so they only get the empty state. */
  canCreate: boolean;
};

type Outcome =
  | { kind: "noRoom" }
  | { kind: "alreadyInRoom"; current?: CurrentRoom }
  | { kind: "unavailable" };

const primary =
  "h-11 cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf";

export function QuickRace({ dict, roomNames, locale, canCreate }: QuickRaceProps) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: (input: unknown) => Promise<{ error: string; current?: CurrentRoom }>) {
    setOutcome(null);
    startTransition(async () => {
      // On success the action redirects to the room.
      const result = await action({ lang: locale });
      if (result.error === "noRoom") {
        setOutcome({ kind: "noRoom" });
      } else if (result.error === "alreadyInRoom") {
        setOutcome({ kind: "alreadyInRoom", current: result.current });
      } else {
        setOutcome({ kind: "unavailable" });
      }
    });
  }

  return (
    <section className="mt-8 grid gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className={primary}
          disabled={pending}
          onClick={() => run(quickRaceAction)}
        >
          {dict.button}
        </button>
        <p className="text-sm text-muted">{dict.hint}</p>
      </div>

      <div role="status">
        {outcome?.kind === "noRoom" && (
          <div className="flex max-w-xl flex-col items-start gap-3 border border-line bg-surface px-5 py-4 rounded-leaf">
            <p className="font-medium">{dict.noRoom}</p>
            <p className="text-sm text-muted">{canCreate ? dict.createLead : dict.guestLead}</p>
            <div className="flex flex-wrap gap-2">
              {canCreate && (
                <button
                  type="button"
                  className={primary}
                  disabled={pending}
                  onClick={() => run(createDefaultRoomAction)}
                >
                  {dict.create}
                </button>
              )}
              <button
                type="button"
                className="h-11 cursor-pointer border border-line px-6 font-medium transition-colors hover:border-primary-text rounded-leaf"
                onClick={() => setOutcome(null)}
              >
                {dict.close}
              </button>
            </div>
          </div>
        )}
        {outcome?.kind === "alreadyInRoom" && outcome.current && (
          <p className="font-mono text-sm text-accent-text">
            &gt;{" "}
            <Link
              href={localePath(locale, `/rooms/${outcome.current.code}`)}
              className="underline underline-offset-4"
            >
              {interpolate(dict.alreadyInRoom, { room: roomLabel(roomNames, outcome.current) })}
            </Link>
          </p>
        )}
        {(outcome?.kind === "unavailable" ||
          (outcome?.kind === "alreadyInRoom" && !outcome.current)) && (
          <p className="font-mono text-sm text-accent-text">&gt; {dict.unavailable}</p>
        )}
      </div>
    </section>
  );
}
