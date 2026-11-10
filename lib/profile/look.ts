import type { Cosmetics } from "./cosmetics";

export type PlayerLook = {
  /** Null without a photo: the avatar shows their initial instead. */
  avatarUrl: string | null;
  cosmetics: Cosmetics;
};

/** Guests and bots get the default look. */
export type PlayerLooks = Record<string, PlayerLook>;

/** The version in the query changes with each new photo, so caches never serve an old one. */
export function avatarPath(userId: string, updatedAt: Date): string {
  return `/api/avatars/${userId}?v=${updatedAt.getTime()}`;
}
