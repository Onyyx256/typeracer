"use client";

import type { Locale } from "@/lib/i18n/config";
import type { RaceDictionary, RoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { AbandonRace } from "./abandon-race";
import { RaceTrack } from "./race-track";
import { TypingArea } from "./typing-area";
import { useNow, useRace } from "./use-race";

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
    <div className="grid gap-4">
      {/* The countdown shows over the garden bed, so it takes no room once the race is on. */}
      <div className="relative">
        <RaceTrack entries={track} youId={userId} dict={dict} roomDict={roomDict} locale={locale} />
        <Countdown startsAt={race.startsAt} endsAt={race.endsAt} dict={dict} />
      </div>

      {racing && race.you !== null && (
        <>
          {/* DES-06: no race on a phone, only the track. */}
          <div className="flex flex-wrap items-center justify-between gap-4 md:hidden">
            <p className="font-mono text-sm text-accent-text">&gt; {dict.mobile}</p>
            <AbandonRace dict={dict} />
          </div>
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
              // Next to the stats, far from "Leave the room", which doesn't ask first.
              action={<AbandonRace dict={dict} />}
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

/** COURSE-03: the synchronized 3-2-1, then "Go!", then "Time's up!" at the limit. */
function Countdown({
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

function Note({ text }: { text: string }) {
  return <p className="font-mono text-sm text-muted">&gt; {text}</p>;
}
