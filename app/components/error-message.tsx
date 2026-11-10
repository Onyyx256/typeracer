"use client";

import { localePath, type Locale } from "@/lib/i18n/config";
import { en } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";

// Error boundaries are Client Components, so they can't load the dictionary
// on the server; only the error strings are kept here.
const COPY = { fr: fr.error, en: en.error };

type ErrorMessageProps = {
  locale: Locale;
  retry: () => void;
};

export function ErrorMessage({ locale, retry }: ErrorMessageProps) {
  const copy = COPY[locale];

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 text-center sm:px-8">
      <title>{`${copy.title} · NelumboType`}</title>
      <p className="font-mono text-sm text-accent-text">&gt; 500</p>
      <h1 className="mt-2 font-display text-4xl leading-tight font-semibold">
        {copy.heading}
      </h1>
      <p className="mt-3 text-muted">{copy.lead}</p>
      <div className="mt-6 flex items-center gap-6">
        <button
          type="button"
          onClick={retry}
          className="h-11 cursor-pointer bg-primary px-6 font-medium text-on-primary transition-[filter] hover:brightness-110 rounded-leaf"
        >
          {copy.retry}
        </button>
        {/* A plain link: after a crash, a full page load is the safest way out. */}
        <a
          href={localePath(locale, "/")}
          className="font-medium text-primary-text underline-offset-4 hover:underline"
        >
          {copy.home}
        </a>
      </div>
    </main>
  );
}
