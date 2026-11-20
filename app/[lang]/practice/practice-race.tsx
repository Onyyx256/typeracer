"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AbandonRace } from "@/app/components/race/abandon-race";
import { Countdown } from "@/app/components/race/countdown";
import { RaceTrack } from "@/app/components/race/race-track";
import { TypingBox, useTyping } from "@/app/components/race/typing-box";
import type { ParticipantResult, Race } from "@/lib/race/engine";
import { keysAllowed, spendAllowance, startAllowance } from "@/lib/race/pacing";
import { initialTyping } from "@/lib/race/typing";
import type { Locale } from "@/lib/i18n/config";
import type { PlayerLooks } from "@/lib/profile/look";
import type {
  PracticeDictionary,
  RaceDictionary,
  RoomDictionary,
} from "@/lib/i18n/dictionaries/fr";

export const PRACTICE_PLAYER = "practice-player";

/** At least 4 updates per second. */
const TICK_MS = 200;

/** Runs in this browser with the same engine as a room. Nothing is saved. */
export function PracticeRace({
  race,
  looks,
  onEnd,
  dict,
  raceDict,
  roomDict,
  locale,
}: {
  race: Race;
  looks: PlayerLooks;
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
  // Paced like a room's sends, so text that lands all at once (a text
  // expander) reaches the engine over a few ticks instead of being refused.
  const pending = useRef<string[]>([]);
  const allowance = useRef(startAllowance(race.startsAt));

  const flush = useCallback(
    (now: number) => {
      const count = Math.min(pending.current.length, keysAllowed(allowance.current, now));
      if (count === 0) {
        return;
      }
      allowance.current = spendAllowance(allowance.current, now, count);
      const result = race.applyKeys(PRACTICE_PLAYER, pending.current.splice(0, count), now);
      const engine = race.playerState(PRACTICE_PLAYER);
      if (!result.ok && engine) {
        pending.current = [];
        set({ ...engine, missed: state.current.missed });
      }
    },
    [race, set, state],
  );

  /** Refreshes the track; once the race is over, hands the results up once. */
  const refresh = useCallback(() => {
    const now = Date.now();
    flush(now);
    race.tick(now);
    setTrack(race.track(now));
    if (!ended.current && race.isOver(now)) {
      ended.current = true;
      onEnd(race.results(now));
    }
  }, [race, onEnd, flush]);

  const onKeys = useCallback(
    (keys: string[]) => {
      const accepted = press(keys);
      if (accepted.length === 0) {
        return;
      }
      pending.current.push(...accepted);
      refresh();
    },
    [press, refresh],
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
      <div className="relative">
        <RaceTrack entries={track} youId={PRACTICE_PLAYER} looks={looks} dict={raceDict} roomDict={roomDict} locale={locale} />
        <Countdown startsAt={race.startsAt} endsAt={race.deadline} dict={raceDict} />
      </div>

      {/* No race on a phone, only the track. */}
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
