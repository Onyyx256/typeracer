"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { RoomSummary, formatSeconds } from "@/app/components/room-summary";
import { TextField } from "@/app/components/text-field";
import {
  LOCALES,
  LOCALE_NAMES,
  localePath,
  type Locale,
} from "@/lib/i18n/config";
import { USERNAME_MAX, USERNAME_MIN } from "@/lib/auth/validation";
import type { CreateRoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate, plural } from "@/lib/i18n/format";
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
import { isNameError } from "@/lib/rooms/names";
import { createRoomAction, type RoomActionError } from "../actions";

type CreateRoomFormProps = {
  dict: CreateRoomDictionary;
  locale: Locale;
  /** The account's display name, the default name in the room. */
  defaultName: string;
};

const NAME_LIMITS = { min: USERNAME_MIN, max: USERNAME_MAX };

export function CreateRoomForm({ dict, locale, defaultName }: CreateRoomFormProps) {
  const [name, setName] = useState(defaultName);
  const [settings, setSettings] = useState<RoomSettings>(() =>
    defaultRoomSettings(locale),
  );
  const [error, setError] = useState<RoomActionError | null>(null);
  // The room the user is already in, when the server refused for that reason.
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function submit(leaveCurrent: boolean) {
    if (!roomSettingsSchema.safeParse(settings).success) {
      setError("invalid");
      return;
    }
    setError(null);
    startTransition(async () => {
      // On success the action redirects to the new room.
      const result = await createRoomAction({ lang: locale, settings, name, leaveCurrent });
      setError(result.error);
      setCurrentCode(result.error === "alreadyInRoom" ? (result.currentCode ?? null) : null);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(false);
  }

  const french = settings.language === "fr";
  const random = settings.textType === "random";
  const elsewhere = error === "alreadyInRoom" && currentCode;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
    >
      <div className="grid gap-10">
        <Section title={dict.sections.room}>
          <div className="max-w-sm">
            <TextField
              label={dict.name.label}
              name="name"
              value={name}
              onChange={(value) => {
                setName(value);
                setError(null);
              }}
              autoComplete="nickname"
              maxLength={USERNAME_MAX}
              hint={interpolate(dict.name.hint, NAME_LIMITS)}
              error={isNameError(error) ? interpolate(dict.errors[error], NAME_LIMITS) : undefined}
            />
          </div>
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
        <div className="mt-4">
          <RoomSummary dict={dict} locale={locale} settings={settings} />
        </div>
        {elsewhere ? (
          // SALLE-06: one room at a time, so offer to go back or leave it.
          <div className="mt-6 grid gap-2">
            <p className="text-sm">{interpolate(dict.elsewhere, { code: currentCode })}</p>
            <Link
              href={localePath(locale, `/rooms/${currentCode}`)}
              className="flex h-11 items-center justify-center border border-line px-6 font-medium transition-colors hover:border-primary-text rounded-leaf"
            >
              {interpolate(dict.goBack, { code: currentCode })}
            </Link>
            <button
              type="button"
              disabled={pending}
              onClick={() => submit(true)}
              className="h-11 w-full cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 disabled:cursor-wait disabled:opacity-70 rounded-leaf"
            >
              {dict.leaveAndCreate}
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="mt-6 h-11 w-full cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 disabled:cursor-wait disabled:opacity-70 rounded-leaf"
          >
            {dict.submit}
          </button>
        )}
        <p role="status" className="mt-3 min-h-5 font-mono text-sm text-accent-text">
          {(pending || (error && !elsewhere)) && (
            <>
              &gt; {pending ? dict.submitting : error && interpolate(dict.errors[error], NAME_LIMITS)}
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
