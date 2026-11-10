import * as z from "zod";

/**
 * The colours are CSS classes in app/globals.css (`.stem-<id>`,
 * `.petal-<id>`), so each one can have its own value in the dark theme.
 */

export type PlayerProgress = {
  races: number;
  wins: number;
  bestWpm: number;
};

/** `null` means free. */
export type Unlock = { kind: keyof PlayerProgress; at: number } | null;

type Cosmetic<Id extends string> = { id: Id; unlock: Unlock };

export const STEMS = [
  { id: "classic", unlock: null },
  { id: "fern", unlock: null },
  { id: "sky", unlock: { kind: "races", at: 5 } },
  { id: "coral", unlock: { kind: "races", at: 15 } },
  { id: "lilac", unlock: { kind: "wins", at: 1 } },
  { id: "gold", unlock: { kind: "bestWpm", at: 60 } },
  { id: "ink", unlock: { kind: "races", at: 50 } },
] as const satisfies readonly Cosmetic<string>[];

export const PETALS = [
  { id: "classic", unlock: null },
  { id: "snow", unlock: null },
  { id: "sunflower", unlock: { kind: "races", at: 5 } },
  { id: "cornflower", unlock: { kind: "bestWpm", at: 40 } },
  { id: "poppy", unlock: { kind: "wins", at: 1 } },
  { id: "violet", unlock: { kind: "wins", at: 10 } },
  { id: "midnight", unlock: { kind: "bestWpm", at: 80 } },
] as const satisfies readonly Cosmetic<string>[];

export type StemId = (typeof STEMS)[number]["id"];
export type PetalId = (typeof PETALS)[number]["id"];

export const DEFAULT_STEM: StemId = "classic";
export const DEFAULT_PETAL: PetalId = "classic";

const stemIds = STEMS.map((stem) => stem.id) as [StemId, ...StemId[]];
const petalIds = PETALS.map((petal) => petal.id) as [PetalId, ...PetalId[]];

export const stemSchema = z.enum(stemIds);
export const petalSchema = z.enum(petalIds);

export const cosmeticsSchema = z.object({ stem: stemSchema, petal: petalSchema });

export type Cosmetics = z.infer<typeof cosmeticsSchema>;

export const DEFAULT_COSMETICS: Cosmetics = { stem: DEFAULT_STEM, petal: DEFAULT_PETAL };

/** Falls back to the default if that colour no longer exists. */
export function readCosmetics(stem: string, petal: string): Cosmetics {
  return {
    stem: stemSchema.catch(DEFAULT_STEM).parse(stem),
    petal: petalSchema.catch(DEFAULT_PETAL).parse(petal),
  };
}

export function isUnlocked(unlock: Unlock, progress: PlayerProgress): boolean {
  return unlock === null || progress[unlock.kind] >= unlock.at;
}

function unlockOf(list: readonly Cosmetic<string>[], id: string): Unlock {
  return list.find((item) => item.id === id)?.unlock ?? null;
}

export function canWear(choice: Cosmetics, progress: PlayerProgress): boolean {
  return (
    isUnlocked(unlockOf(STEMS, choice.stem), progress) &&
    isUnlocked(unlockOf(PETALS, choice.petal), progress)
  );
}

export function cosmeticClasses({ stem, petal }: Cosmetics): string {
  return [stem === DEFAULT_STEM ? "" : `stem-${stem}`, petal === DEFAULT_PETAL ? "" : `petal-${petal}`]
    .filter(Boolean)
    .join(" ");
}
