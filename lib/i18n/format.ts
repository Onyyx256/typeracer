import type { Locale } from "./config";

export type PluralForms = { one: string; other: string };

type Values = Record<string, string | number>;

/** Fills `{name}` placeholders; unknown ones are left as is so a typo shows on screen. */
export function interpolate(template: string, values: Values = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

/** Chooses the singular or plural form by the language's own rules, then fills `{count}`. */
export function plural(
  locale: Locale,
  forms: PluralForms,
  count: number,
  values: Values = {},
): string {
  const form = new Intl.PluralRules(locale).select(count) === "one" ? "one" : "other";
  return interpolate(forms[form], { ...values, count });
}

/** 0.42 → "42 %" in French, "42%" in English. */
export function formatPercent(locale: Locale, ratio: number): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(ratio);
}
