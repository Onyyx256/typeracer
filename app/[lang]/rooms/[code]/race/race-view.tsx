"use client";

import type { Locale } from "@/lib/i18n/config";
import type { RaceDictionary, RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { AbandonRace } from "@/app/components/race/abandon-race";
import { Countdown } from "@/app/components/race/countdown";
import { RaceTrack } from "@/app/components/race/race-track";
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
  dict,
  roomDict,
  locale,
}: {
  code: string;
  userId: string | null;
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

  return (
    <div className="grid gap-6">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-4">
        <Countdown startsAt={race.startsAt} endsAt={race.endsAt} dict={dict} />
        {racing && (
          // The server marks the runner as abandoned.
          <AbandonRace dict={dict} onConfirm={() => getSocket().emit(EVENTS.raceAbandon)} />
        )}
      </div>

      <RaceTrack entries={track} youId={userId} dict={dict} roomDict={roomDict} locale={locale} />

      {racing && race.you !== null && (
        <>
          {/* DES-06: no race on a phone, only the track. */}
          <p className="font-mono text-sm text-accent-text md:hidden">&gt; {dict.mobile}</p>
          <div className="hidden md:block">
            <TypingArea
              code={code}
              text={race.text}
              errorMode={race.errorMode}
              startsAt={race.startsAt}
              endsAt={race.endsAt}
              initial={race.you}
              syncId={race.syncId}
              dict={dict}
              locale={locale}
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
