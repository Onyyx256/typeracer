"use client";

import { usePathname } from "next/navigation";
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_NAMES,
  switchLocalePath,
  type Locale,
} from "@/lib/i18n/config";

type LanguageSwitchProps = {
  current: Locale;
  label: string;
};

/** Saves the choice so a URL without a locale (e.g. "/") opens in this language next time. */
function remember(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

export function LanguageSwitch({ current, label }: LanguageSwitchProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={label}
      className="flex h-10 items-center gap-0.5 rounded-full border border-line p-1 font-mono text-xs"
    >
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          // A plain link on purpose: a full page load re-renders the root layout on
          // the server, so the inline theme script in <head> isn't re-rendered by
          // React on the client (which React warns about).
          <a
            key={locale}
            href={switchLocalePath(pathname, locale)}
            hrefLang={locale}
            lang={locale}
            title={LOCALE_NAMES[locale]}
            aria-current={active ? "true" : undefined}
            onClick={(event) => {
              remember(locale);
              // Keeps search params such as the room browser's filters. Read at
              // click time: useSearchParams would make the whole header wait for
              // the request instead of being prerendered.
              event.currentTarget.search = window.location.search;
            }}
            className={`grid h-full min-w-8 place-items-center rounded-full px-2 font-medium uppercase transition-colors ${
              active
                ? "bg-accent text-on-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {locale}
          </a>
        );
      })}
    </nav>
  );
}
