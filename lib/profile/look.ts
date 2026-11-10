import type { Cosmetics } from "./cosmetics";

/** How a player is drawn: their photo (AUTH-04) and flower colours. */
export type PlayerLook = {
  /** Null without a photo: the avatar shows their initial instead. */
  avatarUrl: string | null;
  cosmetics: Cosmetics;
};

/** Players by user id; anyone missing (guests, bots) gets the default look. */
export type PlayerLooks = Record<string, PlayerLook>;

/** The version in the query changes with each new photo, so caches never serve an old one. */
export function avatarPath(userId: string, updatedAt: Date): string {
  return `/api/avatars/${userId}?v=${updatedAt.getTime()}`;
}
