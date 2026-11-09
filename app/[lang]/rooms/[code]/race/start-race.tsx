"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { RaceDictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";
import { startRaceAction, type StartRaceActionResult } from "../../actions";

type StartError = Extract<StartRaceActionResult, { ok: false }>["error"];

/** COURSE-02: the host's button, under the room settings, in the waiting room. */
export function StartRace({
  dict,
  runners,
  minRunners,
}: {
  dict: RaceDictionary;
  runners: number;
  minRunners: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<StartError | null>(null);
  const [pending, startTransition] = useTransition();
  const enough = runners >= minRunners;

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startRaceAction();
      if (result.ok) {
        // The live update does this too; this covers a missing socket.
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="grid justify-items-center gap-2 text-center">
      <button
        type="button"
        onClick={start}
        disabled={!enough || pending}
        className="h-12 cursor-pointer bg-primary px-8 text-lg font-medium text-on-primary transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 rounded-leaf"
      >
        {dict.start}
      </button>
      <p role="status" className="min-h-5 font-mono text-sm text-muted">
        {error ? (
          <span className="text-danger">&gt; {dict.startErrors[error]}</span>
        ) : (
          !enough && <>&gt; {interpolate(dict.needRunners, { min: minRunners })}</>
        )}
      </p>
    </div>
  );
}
