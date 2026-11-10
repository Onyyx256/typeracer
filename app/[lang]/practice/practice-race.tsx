"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AbandonRace } from "@/app/components/race/abandon-race";
import { Countdown } from "@/app/components/race/countdown";
import { RaceTrack } from "@/app/components/race/race-track";
import { TypingBox, useTyping } from "@/app/components/race/typing-box";
import type { ParticipantResult, Race } from "@/lib/race/engine";
import { initialTyping } from "@/lib/race/typing";
import type { Locale } from "@/lib/i18n/config";
import type {
  PracticeDictionary,
  RaceDictionary,
  RoomDictionary,
} from "@/lib/i18n/dictionaries/fr";

/** The practice runner's id in the engine; there is no account behind it. */
export const PRACTICE_PLAYER = "practice-player";

/** How often the track and the WPM samples are refreshed (COURSE-05: ~4+ per second). */
const TICK_MS = 200;

/**
 * A practice race, run in this browser by the same engine as a room's
 * (lib/race/engine.ts): same countdown, typing rules, time limit and
 * numbers. Nothing goes to the server, so nothing is saved.
 */
export function PracticeRace({
  race,
  hasBots,
  onEnd,
  dict,
  raceDict,
  roomDict,
  locale,
}: {
  race: Race;
  /** Bots were asked for, but don't race yet. */
  hasBots: boolean;
  onEnd: (results: ParticipantResult[]) => void;
  dict: PracticeDictionary;
  raceDict: RaceDictionary;
  roomDict: RoomDictionary;
  locale: Locale;
}) {
  const typing = useTyping({
    text: race.text,
    errorMode: race.mode,
    startsAt: race.startsAt,
    endsAt: race.deadline,
    initial: initialTyping(),
  });
  const { press, set, state } = typing;
  const [track, setTrack] = useState(() => race.track(Date.now()));
  const ended = useRef(false);

  /** Refreshes the track; once the race is over, hands the results up once. */
  const refresh = useCallback(() => {
    const now = Date.now();
    race.tick(now);
    setTrack(race.track(now));
    if (!ended.current && race.isOver(now)) {
      ended.current = true;
      onEnd(race.results(now));
    }
  }, [race, onEnd]);

  const onKeys = useCallback(
    (keys: string[]) => {
      const accepted = press(keys);
      if (accepted.length === 0) {
        return;
      }
      const result = race.applyKeys(PRACTICE_PLAYER, accepted, Date.now());
      const engine = race.playerState(PRACTICE_PLAYER);
      // Refused (a burst too fast to be typed by hand): back to the engine's state.
      if (!result.ok && engine) {
        set({ ...engine, missed: state.current.missed });
      }
      refresh();
    },
    [press, set, state, race, refresh],
  );

  useEffect(() => {
    const timer = setInterval(refresh, TICK_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const abandon = (
    <AbandonRace
      dict={{ ...raceDict, abandonDialog: dict.abandonDialog }}
      onConfirm={() => {
        race.abandon(PRACTICE_PLAYER, Date.now());
        refresh();
      }}
    />
  );

  return (
    <div className="grid gap-4">
      {/* The countdown shows over the garden bed, like in a room. */}
      <div className="relative">
        <RaceTrack entries={track} youId={PRACTICE_PLAYER} dict={raceDict} roomDict={roomDict} locale={locale} />
        <Countdown startsAt={race.startsAt} endsAt={race.deadline} dict={raceDict} />
      </div>
      {hasBots && <p className="font-mono text-sm text-muted">&gt; {dict.bots.soon}</p>}

      {/* DES-06: no race on a phone, only the track. */}
      <div className="flex flex-wrap items-center justify-between gap-4 md:hidden">
        <p className="font-mono text-sm text-accent-text">&gt; {raceDict.mobile}</p>
        {abandon}
      </div>
      <div className="hidden md:block">
        <TypingBox
          text={race.text}
          errorMode={race.mode}
          startsAt={race.startsAt}
          endsAt={race.deadline}
          typing={typing}
          onKeys={onKeys}
          dict={raceDict}
          locale={locale}
          action={abandon}
        />
      </div>
    </div>
  );
}
