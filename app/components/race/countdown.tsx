"use client";

import type { RaceDictionary } from "@/lib/i18n/dictionaries/fr";
import { useNow } from "./use-now";

/** COURSE-03: the synchronized 3-2-1, then "Go!", then "Time's up!" at the limit. */
export function Countdown({
  startsAt,
  endsAt,
  dict,
}: {
  startsAt: number;
  endsAt: number | null;
  dict: RaceDictionary;
}) {
  const now = useNow(100);
  let content: React.ReactNode = null;
  if (now < startsAt) {
    content = (
      <>
        {dict.countdown}{" "}
        <span className="text-accent-text tabular-nums">{Math.ceil((startsAt - now) / 1000)}</span>
      </>
    );
  } else if (endsAt !== null && now >= endsAt) {
    content = dict.timeUp;
  } else if (now < startsAt + 1_000) {
    content = dict.go;
  }
  // Always in the page, so screen readers announce each change (aria-live).
  // Shown over the track: its parent must be positioned.
  return (
    <p
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 grid place-items-center"
    >
      {content && (
        <span className="bg-background/90 px-8 py-4 font-display text-4xl font-semibold text-foreground shadow-lg rounded-leaf">
          {content}
        </span>
      )}
    </p>
  );
}
