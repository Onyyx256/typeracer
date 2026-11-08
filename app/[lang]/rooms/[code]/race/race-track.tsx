"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/app/components/avatar";
import { GrowingStem } from "@/app/components/growing-stem";
import type { TrackEntry } from "@/lib/race/engine";
import type { Locale } from "@/lib/i18n/config";
import type { RaceDictionary, RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { formatPercent, interpolate } from "@/lib/i18n/format";

/**
 * How fast the drawn progress catches up with the server's: updates come
 * 5 times a second, and easing between them keeps every flower growing
 * smoothly instead of jumping (COURSE-05).
 */
const EASE_MS = 180;

/** Eases each runner's progress toward the latest value, one frame at a time. */
function useSmoothProgress(entries: TrackEntry[]): Record<string, number> {
  const [shown, setShown] = useState<Record<string, number>>({});
  const current = useRef<Record<string, number>>({});

  useEffect(() => {
    const targets = Object.fromEntries(entries.map((entry) => [entry.userId, entry.progress]));
    let frame = 0;
    let last = performance.now();
    const animate = (time: number) => {
      const step = 1 - Math.exp(-(time - last) / EASE_MS);
      last = time;
      let moving = false;
      const next: Record<string, number> = {};
      for (const [userId, target] of Object.entries(targets)) {
        const from = current.current[userId] ?? 0;
        const value = Math.abs(target - from) < 0.001 ? target : from + (target - from) * step;
        moving ||= value !== target;
        next[userId] = value;
      }
      current.current = next;
      setShown(next);
      if (moving) {
        frame = requestAnimationFrame(animate);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [entries]);

  return shown;
}

/**
 * COURSE-05, DES-04: the track is a garden bed, one flower per runner,
 * that grows with their progress and blooms at the finish. Runners keep
 * their place (order of arrival in the room) so nobody jumps around.
 */
export function RaceTrack({
  entries,
  youId,
  dict,
  roomDict,
  locale,
}: {
  entries: TrackEntry[];
  youId: string | null;
  dict: RaceDictionary;
  roomDict: RoomDictionary;
  locale: Locale;
}) {
  const shown = useSmoothProgress(entries);

  return (
    <section aria-label={dict.track} className="bg-panel p-5 text-on-panel rounded-leaf sm:p-6">
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-x-2 gap-y-6">
        {entries.map((entry) => {
          const you = entry.userId === youId;
          const progress = shown[entry.userId] ?? 0;
          return (
            <li
              key={entry.userId}
              aria-label={interpolate(dict.progressLabel, {
                name: entry.name,
                percent: formatPercent(locale, entry.progress),
                wpm: entry.wpm,
              })}
              className={`flex min-w-0 flex-col items-center gap-2 p-1 rounded-leaf ${
                you ? "bg-on-panel/10 ring-2 ring-on-panel" : ""
              } ${entry.status === "abandoned" ? "opacity-50 grayscale" : ""}`}
            >
              <GrowingStem progress={progress} className="h-32 w-auto sm:h-40" />
              <span className="flex max-w-full items-center gap-1.5">
                <Avatar name={entry.name} className="size-6 text-xs" />
                <span className="truncate text-sm font-medium" title={entry.name}>
                  {entry.name}
                </span>
              </span>
              <span className="font-mono text-xs text-on-panel-muted tabular-nums" aria-hidden="true">
                {entry.wpm} {dict.wpm}
                {you && <> · {roomDict.you}</>}
              </span>
              <span className="font-mono text-[0.7rem] tracking-wide text-on-panel-muted uppercase" aria-hidden="true">
                {entry.isGuest && <>{roomDict.guestBadge} · </>}
                {dict.statuses[entry.status]}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
