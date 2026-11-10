"use client";

import { useCallback, useState, useTransition } from "react";
import { RaceResults } from "@/app/components/race/race-results";
import {
  RaceRulesFields,
  Section,
  TextSettingsSection,
} from "@/app/components/room-settings-fields";
import { Race, type ParticipantResult } from "@/lib/race/engine";
import type { Locale } from "@/lib/i18n/config";
import type {
  CreateRoomDictionary,
  PracticeDictionary,
  RaceDictionary,
  ResultsDictionary,
  RoomDictionary,
} from "@/lib/i18n/dictionaries/fr";
import {
  addBot,
  defaultPracticeSettings,
  practiceSettingsSchema,
  removeBot,
  setBotLevel,
  type PracticeSettings,
} from "@/lib/practice/settings";
import { practiceTextAction, type PracticeTextError } from "./actions";
import { BotList } from "./bot-list";
import { InRoomNotice } from "./in-room-notice";
import { PRACTICE_PLAYER, PracticeRace } from "./practice-race";

type Source = { title: string; author: string } | null;

/** Réglages → course → résultats, then again or back to the settings. */
type Phase =
  | { kind: "setup" }
  | { kind: "race"; race: Race; source: Source; id: number }
  | { kind: "results"; results: ParticipantResult[]; source: Source };

const primary =
  "h-11 cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 disabled:cursor-wait disabled:opacity-70 rounded-leaf";
const secondary =
  "h-11 cursor-pointer border border-line px-6 font-medium transition-colors hover:border-primary-text rounded-leaf";

/** The practice page, entirely in this browser once the text is fetched. */
export function PracticeMode({
  playerName,
  isGuest,
  dict,
  settingsDict,
  raceDict,
  resultsDict,
  roomDict,
  locale,
}: {
  playerName: string;
  /** No account: shown with the guest badge, like in a room. */
  isGuest: boolean;
  dict: PracticeDictionary;
  settingsDict: CreateRoomDictionary;
  raceDict: RaceDictionary;
  resultsDict: ResultsDictionary;
  roomDict: RoomDictionary;
  locale: Locale;
}) {
  const [settings, setSettings] = useState<PracticeSettings>(() => defaultPracticeSettings(locale));
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });
  const [error, setError] = useState<PracticeTextError | null>(null);
  // Set when the server refuses because a room was joined meanwhile (another tab).
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(changes: Partial<PracticeSettings>) {
    setSettings((current) => ({ ...current, ...changes }));
    setError(null);
  }

  function start() {
    if (!practiceSettingsSchema.safeParse(settings).success) {
      setError("invalid");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await practiceTextAction(settings);
      if (!result.ok) {
        setError(result.error);
        setRoomCode(result.error === "inRoom" ? (result.currentCode ?? null) : null);
        setPhase({ kind: "setup" });
        return;
      }
      // Created now, so the countdown starts as the text appears (COURSE-03).
      const race = new Race({
        text: result.text,
        errorMode: settings.errorMode,
        timeLimit: settings.timeLimit,
        participants: [{ userId: PRACTICE_PLAYER, name: playerName, isGuest }],
        now: Date.now(),
      });
      setPhase({ kind: "race", race, source: result.source, id: Date.now() });
    });
  }

  const source = phase.kind === "setup" ? null : phase.source;
  const onEnd = useCallback(
    (results: ParticipantResult[]) => setPhase({ kind: "results", results, source }),
    [source],
  );

  const status = (pending || error) && (
    <p role="status" className="min-h-5 font-mono text-sm text-accent-text">
      &gt; {pending ? dict.starting : error && dict.errors[error]}
      <span className="animate-[caret-blink_1.1s_steps(1)_infinite]">_</span>
    </p>
  );

  if (roomCode) {
    return <InRoomNotice code={roomCode} dict={dict} locale={locale} />;
  }

  if (phase.kind === "race") {
    return (
      <div className="mt-8">
        <PracticeRace
          key={phase.id}
          race={phase.race}
          hasBots={settings.bots.length > 0}
          onEnd={onEnd}
          dict={dict}
          raceDict={raceDict}
          roomDict={roomDict}
          locale={locale}
        />
      </div>
    );
  }

  if (phase.kind === "results") {
    return (
      <div className="mt-8 grid gap-6">
        <RaceResults
          view={{ results: phase.results, source: phase.source }}
          userId={PRACTICE_PLAYER}
          dict={resultsDict}
          roomDict={roomDict}
          locale={locale}
        />
        <p className="font-mono text-sm text-muted">&gt; {dict.notSaved}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" autoFocus disabled={pending} onClick={start} className={primary}>
            {dict.again}
          </button>
          <button type="button" onClick={() => setPhase({ kind: "setup" })} className={secondary}>
            {dict.settings}
          </button>
        </div>
        {status}
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="grid gap-10">
        <TextSettingsSection dict={settingsDict} locale={locale} settings={settings} update={update} />
        <Section title={settingsDict.sections.race}>
          <RaceRulesFields dict={settingsDict} settings={settings} update={update} />
        </Section>
        <BotList
          dict={dict.bots}
          bots={settings.bots}
          onAdd={(level) => setSettings((current) => addBot(current, level))}
          onRemove={(index) => setSettings((current) => removeBot(current, index))}
          onLevel={(index, level) => setSettings((current) => setBotLevel(current, index, level))}
        />
      </div>

      <aside className="grid gap-3 border border-line bg-surface p-6 rounded-leaf lg:sticky lg:top-6">
        <p className="text-sm text-muted">{dict.notSaved}</p>
        <button type="button" disabled={pending} onClick={start} className={`w-full ${primary}`}>
          {dict.start}
        </button>
        {status}
      </aside>
    </div>
  );
}
