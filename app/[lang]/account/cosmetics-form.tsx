"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GrowingStem } from "@/app/components/growing-stem";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import { plural } from "@/lib/i18n/format";
import {
  PETALS,
  STEMS,
  cosmeticClasses,
  isUnlocked,
  type Cosmetics,
  type PlayerProgress,
  type Unlock,
} from "@/lib/profile/cosmetics";
import { updateCosmeticsAction, type AccountError } from "./actions";
import { primaryButton } from "./styles";

type Copy = Dictionary["accountPage"]["cosmetics"];

function unlockText(unlock: Unlock, dict: Copy, locale: Locale): string {
  return unlock ? plural(locale, dict.unlock[unlock.kind], unlock.at, { count: unlock.at }) : "";
}

/** The two colour pickers, with a live preview on the race bed. */
export function CosmeticsForm({
  current,
  progress,
  dict,
  errors,
  locale,
}: {
  current: Cosmetics;
  progress: PlayerProgress;
  dict: Copy;
  errors: Dictionary["accountPage"]["errors"];
  locale: Locale;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Cosmetics>(current);
  const [error, setError] = useState<AccountError | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const changed = choice.stem !== current.stem || choice.petal !== current.petal;

  function pick(next: Partial<Cosmetics>) {
    setChoice({ ...choice, ...next });
    setError(null);
    setSaved(false);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateCosmeticsAction(choice);
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={save} className="grid gap-6 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
      <div
        role="img"
        aria-label={`${dict.preview}: ${dict.stems[choice.stem]}, ${dict.petals[choice.petal]}`}
        className={`grid w-36 justify-items-center bg-panel p-4 rounded-leaf sm:w-auto ${cosmeticClasses(choice)}`}
      >
        <GrowingStem progress={1} zoomed className="h-48 w-auto" />
      </div>

      <div className="grid gap-5">
        <Picker
          legend={dict.stem}
          name="stem"
          options={STEMS}
          selected={choice.stem}
          names={dict.stems}
          swatch={(id) => (
            <span className={`stem-${id} block h-6 w-2.5 rounded-full bg-stem ring-1 ring-line`} />
          )}
          onPick={(stem) => pick({ stem })}
          progress={progress}
          dict={dict}
          locale={locale}
        />
        <Picker
          legend={dict.petal}
          name="petal"
          options={PETALS}
          selected={choice.petal}
          names={dict.petals}
          swatch={(id) => (
            <span className={`petal-${id} block size-6 rounded-full border-2 border-petal-line bg-petal`} />
          )}
          onPick={(petal) => pick({ petal })}
          progress={progress}
          dict={dict}
          locale={locale}
        />

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className={primaryButton} disabled={pending || !changed}>
            {dict.save}
          </button>
          <p role="status" className="font-mono text-sm text-accent-text">
            {error ? (
              <span className="text-danger">&gt; {errors[error]}</span>
            ) : (
              saved && <>&gt; {dict.saved}</>
            )}
          </p>
        </div>
      </div>
    </form>
  );
}

function Picker<Id extends string>({
  legend,
  name,
  options,
  selected,
  names,
  swatch,
  onPick,
  progress,
  dict,
  locale,
}: {
  legend: string;
  name: string;
  options: readonly { id: Id; unlock: Unlock }[];
  selected: Id;
  names: Record<Id, string>;
  swatch: (id: Id) => React.ReactNode;
  onPick: (id: Id) => void;
  progress: PlayerProgress;
  dict: Copy;
  locale: Locale;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
        {options.map(({ id, unlock }) => {
          const open = isUnlocked(unlock, progress);
          return (
            <label
              key={id}
              className={`flex min-h-14 items-center gap-2.5 border px-3 py-2 transition-colors rounded-leaf has-checked:border-primary-text has-checked:bg-surface has-focus-visible:outline-2 has-focus-visible:outline-accent-text ${
                open ? "cursor-pointer border-line hover:border-primary-text" : "cursor-not-allowed border-dashed border-line opacity-60"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={id}
                checked={selected === id}
                disabled={!open}
                onChange={() => onPick(id)}
                className="sr-only"
              />
              {swatch(id)}
              <span className="grid text-sm leading-tight">
                <span className="font-medium">{names[id]}</span>
                {!open && (
                  <span className="font-mono text-[0.7rem] text-muted">
                    <span className="sr-only">{dict.locked}, </span>
                    {unlockText(unlock, dict, locale)}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
