import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { hasLocale, type Locale } from "./config";
import { en } from "./dictionaries/en";
import { fr, type Dictionary } from "./dictionaries/fr";

const dictionaries: Record<Locale, Dictionary> = { fr, en };

/** The locale of the current route (the `[lang]` segment). Server Components only. */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!hasLocale(value)) {
    notFound();
  }
  return value;
}

/** Every UI string in the current route's language. Server Components only. */
export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}
