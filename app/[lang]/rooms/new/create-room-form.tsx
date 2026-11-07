"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";
import { TextField } from "@/app/components/text-field";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";
import type { CreateRoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { plural } from "@/lib/i18n/format";
import {
  CAPACITY_MAX,
  CAPACITY_MIN,
  CHARSET_MAX,
  COMPLEXITIES,
  ERROR_MODES,
  HOST_ROLES,
  LENGTH_MAX,
  LENGTH_MIN,
  LENGTH_STEP,
  TEXT_TYPES,
  TIME_LIMITS,
  VISIBILITIES,
  defaultRoomSettings,
  roomSettingsSchema,
  type RoomSettings,
} from "@/lib/rooms/settings";

type Notice = "soon" | "invalid";

/** 30 → "30 s", 120 → "2 min": the same in both languages. */
function formatSeconds(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : `${seconds / 60} min`;
}

type CreateRoomFormProps = {
  dict: CreateRoomDictionary;
  locale: Locale;
};

export function CreateRoomForm({ dict, locale }: CreateRoomFormProps) {
  const [settings, setSettings] = useState<RoomSettings>(() =>
    defaultRoomSettings(locale),
  );
  const [notice, setNotice] = useState<Notice | null>(null);

  function update<K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = roomSettingsSchema.safeParse(settings);
    // The server action that creates the room is the next step.
    setNotice(parsed.success ? "soon" : "invalid");
  }

  const french = settings.language === "fr";
  const random = settings.textType === "random";
  const enabledCharacters = (
    ["punctuation", "numbers", "capitals", "accents"] as const
  ).filter((key) => settings[key] && (key !== "accents" || french));

  // Same grouping as the form, one labelled row per setting.
  const summary: { title: string; rows: [string, string][] }[] = [
    {
      title: dict.sections.room,
      rows: [
        [dict.role.legend, dict.role[settings.hostRole]],
        [dict.visibility.legend, dict.visibility[settings.visibility]],
        [
          dict.capacity.label,
          plural(locale, dict.capacity.value, settings.capacity),
        ],
      ],
    },
    {
      title: dict.sections.text,
      rows: [
        [dict.language, LOCALE_NAMES[settings.language]],
        [dict.textType.legend, dict.textType[settings.textType]],
        [dict.length.label, plural(locale, dict.length.value, settings.length)],
        [dict.complexity.legend, dict.complexity[settings.complexity]],
        [
          dict.characters.legend,
          enabledCharacters.length > 0
            ? enabledCharacters.map((key) => dict.characters[key]).join(", ")
            : dict.summary.lettersOnly,
        ],
      ],
    },
    {
      title: dict.sections.race,
      rows: [
        [
          dict.timeLimit.legend,
          settings.timeLimit === 0
            ? dict.timeLimit.none
            : formatSeconds(settings.timeLimit),
        ],
        [dict.errorMode.legend, dict.errorMode[settings.errorMode]],
        [
          dict.bonuses.label,
          settings.bonuses ? dict.summary.on : dict.summary.off,
        ],
      ],
    },
  ];

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
    >
      <div className="grid gap-10">
        <Section title={dict.sections.room}>
          <ChoiceGroup
            legend={dict.role.legend}
            name="hostRole"
            value={settings.hostRole}
            onChange={(value) => update("hostRole", value)}
            options={HOST_ROLES.map((role) => ({
              value: role,
              label: dict.role[role],
              hint: dict.role[`${role}Hint`],
            }))}
          />
          <ChoiceGroup
            legend={dict.visibility.legend}
            name="visibility"
            value={settings.visibility}
            onChange={(value) => update("visibility", value)}
            options={VISIBILITIES.map((visibility) => ({
              value: visibility,
              label: dict.visibility[visibility],
              hint: dict.visibility[`${visibility}Hint`],
            }))}
          />
          <RangeField
            label={dict.capacity.label}
            hint={dict.capacity.hint}
            min={CAPACITY_MIN}
            max={CAPACITY_MAX}
            value={settings.capacity}
            onChange={(value) => update("capacity", value)}
            format={(count) => plural(locale, dict.capacity.value, count)}
          />
        </Section>

        <Section title={dict.sections.text}>
          <ChoiceGroup
            legend={dict.language}
            name="language"
            value={settings.language}
            onChange={(value) => update("language", value)}
            options={LOCALES.map((language) => ({
              value: language,
              label: LOCALE_NAMES[language],
              lang: language,
            }))}
          />
          <ChoiceGroup
            legend={dict.textType.legend}
            name="textType"
            value={settings.textType}
            onChange={(value) => update("textType", value)}
            options={TEXT_TYPES.map((type) => ({
              value: type,
              label: dict.textType[type],
              hint: dict.textType[`${type}Hint`],
            }))}
          />
          <RangeField
            label={dict.length.label}
            min={LENGTH_MIN}
            max={LENGTH_MAX}
            step={LENGTH_STEP}
            value={settings.length}
            onChange={(value) => update("length", value)}
            format={(count) => plural(locale, dict.length.value, count)}
          />
          <ChoiceGroup
            legend={dict.complexity.legend}
            name="complexity"
            value={settings.complexity}
            onChange={(value) => update("complexity", value)}
            options={COMPLEXITIES.map((complexity) => ({
              value: complexity,
              label: dict.complexity[complexity],
              hint: dict.complexity[`${complexity}Hint`],
            }))}
          />
          <fieldset>
            <legend className="text-sm font-medium">
              {dict.characters.legend}
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Toggle
                label={dict.characters.punctuation}
                checked={settings.punctuation}
                onChange={(value) => update("punctuation", value)}
              />
              <Toggle
                label={dict.characters.numbers}
                checked={settings.numbers}
                onChange={(value) => update("numbers", value)}
              />
              <Toggle
                label={dict.characters.capitals}
                checked={settings.capitals}
                onChange={(value) => update("capitals", value)}
              />
              {/* Only French text has accents, so the switch is off for English. */}
              <Toggle
                label={dict.characters.accents}
                hint={french ? undefined : dict.characters.accentsHint}
                checked={settings.accents && french}
                disabled={!french}
                onChange={(value) => update("accents", value)}
              />
            </div>
          </fieldset>
          {random ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={dict.charset.include}
                name="includeChars"
                value={settings.includeChars}
                onChange={(value) => update("includeChars", value)}
                autoComplete="off"
                maxLength={CHARSET_MAX}
                hint={dict.charset.hint}
              />
              <TextField
                label={dict.charset.exclude}
                name="excludeChars"
                value={settings.excludeChars}
                onChange={(value) => update("excludeChars", value)}
                autoComplete="off"
                maxLength={CHARSET_MAX}
                hint={dict.charset.hint}
              />
            </div>
          ) : (
            <p className="font-mono text-sm text-muted">
              &gt; {dict.charset.coherentNote}
            </p>
          )}
        </Section>

        <Section title={dict.sections.race}>
          <ChoiceGroup
            legend={dict.timeLimit.legend}
            name="timeLimit"
            value={String(settings.timeLimit)}
            onChange={(value) => {
              const seconds = TIME_LIMITS.find((limit) => String(limit) === value);
              if (seconds !== undefined) update("timeLimit", seconds);
            }}
            compact
            options={TIME_LIMITS.map((seconds) => ({
              value: String(seconds),
              label: seconds === 0 ? dict.timeLimit.none : formatSeconds(seconds),
            }))}
          />
          <ChoiceGroup
            legend={dict.errorMode.legend}
            name="errorMode"
            value={settings.errorMode}
            onChange={(value) => update("errorMode", value)}
            options={ERROR_MODES.map((mode) => ({
              value: mode,
              label: dict.errorMode[mode],
              hint: dict.errorMode[`${mode}Hint`],
            }))}
          />
          <Toggle
            label={dict.bonuses.label}
            hint={dict.bonuses.hint}
            checked={settings.bonuses}
            onChange={(value) => update("bonuses", value)}
          />
          <p className="font-mono text-sm text-muted">&gt; {dict.botsNote}</p>
        </Section>
      </div>

      <aside className="border border-line bg-surface p-6 rounded-leaf lg:sticky lg:top-6">
        <h2 className="font-display text-xl font-semibold">
          {dict.summary.heading}
        </h2>
        <div className="mt-4 grid gap-5">
          {summary.map((group) => (
            <section key={group.title}>
              <h3 className="font-mono text-xs tracking-wide text-accent-text uppercase">
                <span aria-hidden="true">&gt; </span>
                {group.title}
              </h3>
              <dl className="mt-1 divide-y divide-line text-sm">
                {group.rows.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-4 py-1.5"
                  >
                    <dt className="text-muted">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <button
          type="submit"
          className="mt-6 h-11 w-full cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 rounded-leaf"
        >
          {dict.submit}
        </button>
        <p role="status" className="mt-3 min-h-5 font-mono text-sm text-accent-text">
          {notice && (
            <>
              &gt; {dict[notice]}
              <span className="animate-[caret-blink_1.1s_steps(1)_infinite]">
                _
              </span>
            </>
          )}
        </p>
      </aside>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6">
      <h2 className="flex items-center gap-4 font-display text-2xl font-semibold">
        {title}
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </h2>
      {children}
    </section>
  );
}

type Option<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  lang?: string;
};

/** Radio buttons drawn as cards; real inputs, so arrows and Tab work as usual. */
function ChoiceGroup<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
  compact = false,
}: {
  legend: string;
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  /** Short labels without hints, laid out as a row of chips. */
  compact?: boolean;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div
        className={`mt-2 grid gap-2 ${
          compact
            ? "grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]"
            : "sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]"
        }`}
      >
        {options.map((option) => (
          <label
            key={option.value}
            lang={option.lang}
            className={`group cursor-pointer border border-line bg-background transition-colors rounded-leaf hover:border-primary-text has-checked:border-primary-text has-checked:bg-surface has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-text ${
              compact ? "px-3 py-2 text-center" : "px-4 py-3"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="flex items-center gap-2 font-medium">
              {!compact && (
                <span
                  aria-hidden="true"
                  className="font-mono text-accent-text opacity-0 transition-opacity group-has-checked:opacity-100"
                >
                  &gt;
                </span>
              )}
              {option.label}
            </span>
            {option.hint && (
              <span className="mt-1 block text-sm text-muted">
                {option.hint}
              </span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RangeField({
  label,
  hint,
  min,
  max,
  step = 1,
  value,
  onChange,
  format,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
}) {
  const id = useId();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <output htmlFor={id} className="font-mono text-sm text-accent-text">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={format(value)}
        className="mt-2 w-full cursor-pointer accent-primary"
      />
      <div
        className="flex justify-between font-mono text-xs text-muted"
        aria-hidden="true"
      >
        <span>{min}</span>
        {hint && <span className="text-center">{hint}</span>}
        <span>{max}</span>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 border border-line bg-background px-4 py-3 rounded-leaf has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-text ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      {/* The track and knob are drawn from the hidden checkbox's state. */}
      <span
        aria-hidden="true"
        className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-primary after:absolute after:top-1 after:left-1 after:size-4 after:rounded-full after:bg-background after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}
