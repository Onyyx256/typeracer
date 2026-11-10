import type { Locale } from "./config";

export type PluralForms = { one: string; other: string };

type Values = Record<string, string | number>;

/** Unknown placeholders are left as is, so a typo shows on screen. */
export function interpolate(template: string, values: Values = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

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
export function formatPercent(locale: Locale, ratio: number, decimals = 0): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(ratio);
}

export function formatNumber(locale: Locale, value: number, decimals = 0): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
