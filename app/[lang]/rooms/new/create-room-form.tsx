"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import type { FormEvent } from "react";
import { ChoiceGroup, RoomSettingsFields } from "@/app/components/room-settings-fields";
import { RoomSummary } from "@/app/components/room-summary";
import { TextField } from "@/app/components/text-field";
import { localePath, type Locale } from "@/lib/i18n/config";
import { USERNAME_MAX, USERNAME_MIN } from "@/lib/auth/validation";
import type { CreateRoomDictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";
import {
  HOST_ROLES,
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

const noSubscribe = () => () => {};

/** False in the server HTML and until React has taken over the page, then true. */
function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

export function CreateRoomForm({ dict, locale, defaultName }: CreateRoomFormProps) {
  const [name, setName] = useState(defaultName);
  const [settings, setSettings] = useState<RoomSettings>(() =>
    defaultRoomSettings(locale),
  );
  const [error, setError] = useState<RoomActionError | null>(null);
  // The room the user is already in, when the server refused for that reason.
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();

  function update(changes: Partial<RoomSettings>) {
    setSettings((current) => ({ ...current, ...changes }));
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

  const elsewhere = error === "alreadyInRoom" && currentCode;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
    >
      <div className="grid gap-10">
        <RoomSettingsFields
          dict={dict}
          locale={locale}
          settings={settings}
          update={update}
          roomFields={
            <>
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
                onChange={(value) => update({ hostRole: value })}
                options={HOST_ROLES.map((role) => ({
                  value: role,
                  label: dict.role[role],
                  hint: dict.role[`${role}Hint`],
                }))}
              />
            </>
          }
        />
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
          // Disabled until the page's JavaScript runs: clicked earlier (a cold
          // cache in a private window), the browser would send the form itself
          // as a GET with every setting in the URL, and no room would be made.
          <button
            type="submit"
            disabled={pending || !hydrated}
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
