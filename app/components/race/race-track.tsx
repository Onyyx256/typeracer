"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/app/components/avatar";
import { GrowingStem } from "@/app/components/growing-stem";
import { WeatherIcon } from "@/app/components/weather-icon";
import type { TrackEntry } from "@/lib/race/engine";
import { cosmeticClasses } from "@/lib/profile/cosmetics";
import type { PlayerLooks } from "@/lib/profile/look";
import type { Locale } from "@/lib/i18n/config";
import type { RaceDictionary, RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { formatPercent, interpolate } from "@/lib/i18n/format";

/**
 * Updates come 5 times a second; easing between them keeps every flower
 * growing smoothly instead of jumping.
 */
const EASE_MS = 180;

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

/** Runners keep their place (order of arrival in the room), so nobody jumps around. */
export function RaceTrack({
  entries,
  youId,
  looks = {},
  dict,
  roomDict,
  locale,
}: {
  entries: TrackEntry[];
  youId: string | null;
  looks?: PlayerLooks;
  dict: RaceDictionary;
  roomDict: RoomDictionary;
  locale: Locale;
}) {
  const shown = useSmoothProgress(entries);

  return (
    <section aria-label={dict.track} className="bg-panel p-4 text-on-panel rounded-leaf">
      <ol className="grid grid-cols-[repeat(auto-fit,minmax(7rem,9rem))] justify-center gap-x-3 gap-y-4">
        {entries.map((entry) => {
          const you = entry.userId === youId;
          const progress = shown[entry.userId] ?? 0;
          const look = looks[entry.userId];
          return (
            <li
              key={entry.userId}
              aria-label={
                interpolate(dict.progressLabel, {
                  name: entry.name,
                  percent: formatPercent(locale, entry.progress),
                  wpm: entry.wpm,
                }) + (entry.effect ? ` · ${dict.bonuses[entry.effect]}` : "")
              }
              className={`relative flex min-w-0 flex-col items-center gap-1.5 px-1 pt-2 pb-2 rounded-leaf ${
                you ? "bg-on-panel/10 ring-2 ring-on-panel" : ""
              } ${entry.status === "abandoned" ? "opacity-50 grayscale" : ""} ${
                look ? cosmeticClasses(look.cosmetics) : ""
              }`}
            >
              {entry.effect && (
                <WeatherIcon
                  kind={entry.effect}
                  className="weather-pop absolute top-1 right-1 size-7 text-on-panel"
                />
              )}
              {/* As tall as the window allows: the rest of the race page takes about 37.5rem. */}
              <GrowingStem
                progress={progress}
                zoomed
                className="h-[clamp(7rem,calc(100dvh-37.5rem),18rem)] w-auto"
              />
              <span className="flex max-w-full items-center gap-1.5">
                <Avatar name={entry.name} src={look?.avatarUrl} className="size-6 shrink-0 text-xs" />
                <span className="truncate text-sm font-medium" title={entry.name}>
                  {entry.name}
                </span>
                {entry.isGuest && (
                  <span className="shrink-0 font-mono text-[0.65rem] tracking-wide text-on-panel-muted uppercase" aria-hidden="true">
                    {roomDict.guestBadge}
                  </span>
                )}
              </span>
              {/* An effect's name can wrap to a second line: that line is always kept, so the track never grows when one lands. */}
              <span
                className="line-clamp-2 min-h-[2lh] text-center font-mono text-xs text-on-panel-muted tabular-nums"
                aria-hidden="true"
              >
                {entry.wpm} {dict.wpm} ·{" "}
                <span className="text-[0.7rem] tracking-wide uppercase">
                  {entry.effect ? dict.bonuses[entry.effect] : dict.statuses[entry.status]}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
