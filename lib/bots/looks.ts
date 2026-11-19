import type { Cosmetics } from "@/lib/profile/cosmetics";
import type { BotLevel } from "./levels";

/** Each level wears colours players unlock, so a bot's flower tells its level at a glance. */
export const BOT_COSMETICS: Record<BotLevel, Cosmetics> = {
  noob: { stem: "lilac", petal: "poppy" },
  beginner: { stem: "sky", petal: "sunflower" },
  intermediate: { stem: "coral", petal: "cornflower" },
  expert: { stem: "gold", petal: "violet" },
  impossible: { stem: "ink", petal: "midnight" },
};
