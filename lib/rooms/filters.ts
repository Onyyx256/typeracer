import * as z from "zod";
import { localeSchema } from "@/lib/i18n/config";
import { COMPLEXITIES } from "./settings";

/**
 * The room browser's filters (JOIN-02), read from the URL so a filtered list
 * can be shared, survives the live refresh and works without JavaScript.
 * A missing or unknown value means "any": a hand-edited URL never errors.
 */
export const roomFiltersSchema = z.object({
  lang: localeSchema.optional().catch(undefined),
  complexity: z.enum(COMPLEXITIES).optional().catch(undefined),
});

export type RoomFilters = z.infer<typeof roomFiltersSchema>;

export const FILTER_KEYS = ["lang", "complexity"] as const satisfies readonly (keyof RoomFilters)[];

type SearchParams = Record<string, string | string[] | undefined>;

/** Validates the page's search params (TECH-07); a repeated key keeps its first value. */
export function parseRoomFilters(searchParams: SearchParams): RoomFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  return roomFiltersSchema.parse({
    lang: first(searchParams.lang),
    complexity: first(searchParams.complexity),
  });
}

/** The query string for `filters` with one key changed; `undefined` clears it. */
export function filterQuery(
  filters: RoomFilters,
  key: keyof RoomFilters,
  value: string | undefined,
): string {
  const params = new URLSearchParams();
  for (const name of FILTER_KEYS) {
    const current = name === key ? value : filters[name];
    if (current) {
      params.set(name, current);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
