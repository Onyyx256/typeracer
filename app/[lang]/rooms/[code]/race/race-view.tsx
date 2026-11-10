"use client";

import type { Locale } from "@/lib/i18n/config";
import type { PlayerLooks } from "@/lib/profile/look";
import type { RaceDictionary, RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { AbandonRace } from "@/app/components/race/abandon-race";
import { Countdown } from "@/app/components/race/countdown";
import { RaceTrack } from "@/app/components/race/race-track";
import { WeatherIcon } from "@/app/components/weather-icon";
import { TypingArea } from "./typing-area";
import { EVENTS } from "@/lib/realtime/events";
import { getSocket } from "@/lib/realtime/client";
import { useRace } from "./use-race";

/**
 * The countdown and the race (DÉCOMPTE, EN_COURSE). Runners get the typing
 * area; spectators and visitors get the track only (COURSE-05).
 */
export function RaceView({
  code,
  userId,
  looks,
  dict,
  roomDict,
  locale,
}: {
  code: string;
  userId: string | null;
  looks: PlayerLooks;
  dict: RaceDictionary;
  roomDict: RoomDictionary;
  locale: Locale;
}) {
  const { race, track } = useRace(code);

  if (!race) {
    return <p className="font-mono text-sm text-muted">&gt; {dict.loading}</p>;
  }

  const mine = track.find((entry) => entry.userId === userId);
  const racing = race.you !== null && mine?.status === "racing";
  // The server marks the runner as abandoned.
  const abandon = <AbandonRace dict={dict} onConfirm={() => getSocket().emit(EVENTS.raceAbandon)} />;

  return (
    <div className="grid gap-4">
      {/* The countdown shows over the garden bed, so it takes no room once the race is on. */}
      <div className="relative">
        <RaceTrack entries={track} youId={userId} looks={looks} dict={dict} roomDict={roomDict} locale={locale} />
        <Countdown startsAt={race.startsAt} endsAt={race.endsAt} dict={dict} />
        {/* BONUS-03: the targeted runner is told what fell on them, over the track like the countdown. */}
        {racing && (
          <p
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4"
          >
            {mine.effect && (
              <span className="flex items-center gap-2 bg-background/95 px-4 py-2 font-mono text-sm text-accent-text shadow-lg rounded-leaf">
                <WeatherIcon kind={mine.effect} className="size-5 shrink-0" />
                {dict.bonusNotices[mine.effect]}
              </span>
            )}
          </p>
        )}
      </div>

      {racing && race.you !== null && (
        <>
          {/* DES-06: no race on a phone, only the track. */}
          <div className="flex flex-wrap items-center justify-between gap-4 md:hidden">
            <p className="font-mono text-sm text-accent-text">&gt; {dict.mobile}</p>
            {abandon}
          </div>
          <div className="hidden md:block">
            <TypingArea
              code={code}
              errorMode={race.errorMode}
              startsAt={race.startsAt}
              endsAt={race.endsAt}
              initial={race.you}
              syncId={race.syncId}
              glare={mine.effect === "glare"}
              serverTextLength={mine.textLength}
              dict={dict}
              locale={locale}
              // Next to the stats, far from "Leave the room", which doesn't ask first.
              action={abandon}
            />
          </div>
        </>
      )}
      {mine?.status === "finished" && <Note text={dict.finished} />}
      {mine?.status === "abandoned" && <Note text={dict.abandoned} />}
      {race.you === null && <Note text={dict.spectating} />}
    </div>
  );
}

function Note({ text }: { text: string }) {
  return <p className="font-mono text-sm text-muted">&gt; {text}</p>;
}
