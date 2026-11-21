"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type * as z from "zod";

const noSubscribe = () => () => {};

const parsed = new Map<string, { raw: string; value: unknown }>();

function readDraft<T>(key: string, schema: z.ZodType<T>): T | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  // useSyncExternalStore needs the same object back while the stored text is unchanged.
  const cached = parsed.get(key);
  if (cached?.raw === raw) return cached.value as T | null;
  let value: T | null = null;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    if (result.success) value = result.data;
  } catch {}
  parsed.set(key, { raw, value });
  return value;
}

/**
 * Form state kept in this tab's sessionStorage, so it survives the full page
 * load of a language switch. The server HTML and the hydration render use
 * `initial`; the saved draft takes over right after.
 */
export function useSessionDraft<T>(
  key: string,
  schema: z.ZodType<T>,
  initial: T,
): [T, (next: T) => void] {
  const stored = useSyncExternalStore(noSubscribe, () => readDraft(key, schema), () => null);
  const [edited, setEdited] = useState<T | null>(null);

  useEffect(() => {
    if (edited === null) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(edited));
    } catch {}
  }, [key, edited]);

  return [edited ?? stored ?? initial, setEdited];
}
