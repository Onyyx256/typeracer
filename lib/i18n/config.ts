import * as z from "zod";

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

/** Remembers the visitor's choice; read by proxy.ts when a URL has no locale. */
export const LOCALE_COOKIE = "locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Each language is named in itself, so a visitor can always find their own. */
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};

export const localeSchema = z.enum(LOCALES);

export function hasLocale(value: string): value is Locale {
  return localeSchema.safeParse(value).success;
}

/** Picks the best supported language from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const quality = params.find((param) => param.trim().startsWith("q="));
      return {
        // "en-US" counts as "en": only the language matters here, not the region.
        language: tag.trim().toLowerCase().split("-")[0] ?? "",
        q: quality ? Number(quality.trim().slice(2)) : 1,
      };
    })
    .filter((entry) => !Number.isNaN(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { language } of ranked) {
    if (hasLocale(language)) {
      return language;
    }
  }
  return DEFAULT_LOCALE;
}

/** "/login" in French is "/fr/login"; "/" is "/fr". */
export function localePath(locale: Locale, path: string): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** The same page in another language: swaps the first path segment. */
export function switchLocalePath(pathname: string, locale: Locale): string {
  const [, first = "", ...rest] = pathname.split("/");
  const tail = hasLocale(first) ? rest : [first, ...rest];
  return localePath(locale, `/${tail.join("/")}`.replace(/\/$/, "") || "/");
}
