"use client";

import { useId } from "react";
import { Section } from "@/app/components/room-settings-fields";
import { BOT_LEVELS, BOT_PROFILES, type BotLevel } from "@/lib/bots/levels";
import type { PracticeDictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";
import { PRACTICE_BOTS_MAX, type PracticeBot } from "@/lib/practice/settings";

/** A new bot starts in the middle of the range. */
const DEFAULT_LEVEL: BotLevel = "intermediate";

const button =
  "flex h-10 cursor-pointer items-center gap-2 border border-line px-4 text-sm font-medium transition-colors hover:border-primary-text disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line rounded-leaf";

/**
 * CONF-10: add and remove bots, each with a level (BOT-01). They're only
 * configured for now; the note says so until the bot engine exists.
 */
export function BotList({
  dict,
  bots,
  onAdd,
  onRemove,
  onLevel,
}: {
  dict: PracticeDictionary["bots"];
  bots: readonly PracticeBot[];
  onAdd: (level: BotLevel) => void;
  onRemove: (index: number) => void;
  onLevel: (index: number, level: BotLevel) => void;
}) {
  const full = bots.length >= PRACTICE_BOTS_MAX;

  return (
    <Section title={dict.heading}>
      <p className="-mt-3 text-sm text-muted">{dict.lead}</p>
      {bots.length === 0 ? (
        <p className="font-mono text-sm text-muted">&gt; {dict.empty}</p>
      ) : (
        <ul className="grid gap-2">
          {bots.map((bot, index) => (
            <BotRow
              key={index}
              dict={dict}
              name={interpolate(dict.name, { number: index + 1 })}
              level={bot.level}
              onLevel={(level) => onLevel(index, level)}
              onRemove={() => onRemove(index)}
            />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={full} onClick={() => onAdd(DEFAULT_LEVEL)} className={button}>
          <span aria-hidden="true" className="font-mono text-accent-text">
            +
          </span>
          {dict.add}
        </button>
        {full && (
          <span className="font-mono text-sm text-muted">
            {interpolate(dict.full, { max: PRACTICE_BOTS_MAX })}
          </span>
        )}
      </div>
      <p className="font-mono text-sm text-accent-text">&gt; {dict.soon}</p>
    </Section>
  );
}

function BotRow({
  dict,
  name,
  level,
  onLevel,
  onRemove,
}: {
  dict: PracticeDictionary["bots"];
  name: string;
  level: BotLevel;
  onLevel: (level: BotLevel) => void;
  onRemove: () => void;
}) {
  const id = useId();

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border border-line bg-background px-4 py-3 rounded-leaf">
      <span className="flex items-center gap-2">
        <span className="font-medium">{name}</span>
        {/* BOT-04: always marked as a bot. */}
        <span className="font-mono text-xs tracking-wide text-muted uppercase">{dict.badge}</span>
      </span>
      <span className="flex flex-1 flex-wrap items-center justify-end gap-3">
        <label htmlFor={id} className="text-sm text-muted">
          {dict.level}
        </label>
        <select
          id={id}
          value={level}
          onChange={(event) => {
            const next = BOT_LEVELS.find((candidate) => candidate === event.target.value);
            if (next) onLevel(next);
          }}
          className="h-10 cursor-pointer border border-line bg-surface px-3 text-sm transition-colors hover:border-primary-text focus-visible:border-primary-text rounded-leaf"
        >
          {BOT_LEVELS.map((option) => (
            <option key={option} value={option}>
              {dict.levels[option]} ·{" "}
              {interpolate(dict.speed, {
                min: BOT_PROFILES[option].minWpm,
                max: BOT_PROFILES[option].maxWpm,
              })}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          aria-label={interpolate(dict.remove, { name })}
          className="h-10 cursor-pointer px-3 text-sm font-medium text-danger transition-colors hover:bg-danger/10 rounded-leaf"
        >
          {dict.removeShort}
        </button>
      </span>
    </li>
  );
}
