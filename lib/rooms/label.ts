import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import { interpolate } from "@/lib/i18n/format";
import type { Visibility } from "./settings";

export type CurrentRoom = { code: string; visibility: Visibility };

/** A private room's code lets no one in, so it is named without it. */
export function roomLabel(names: Dictionary["roomNames"], room: CurrentRoom): string {
  return room.visibility === "private" ? names.private : interpolate(names.code, { code: room.code });
}
