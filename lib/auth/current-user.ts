import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/dictionaries";
import { getSessionUserId } from "./session";
import { findProfile } from "./users";

/** A signed-in user or a guest. Cached per request so the header and the page share one lookup. */
export const getViewer = cache(async () => {
  const userId = await getSessionUserId();
  return userId ? findProfile(userId) : null;
});

/** Null for a guest too. */
export const getCurrentUser = cache(async () => {
  const viewer = await getViewer();
  return viewer && !viewer.isGuest ? viewer : null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(localePath(await getLocale(), "/login"));
  }
  return user;
}
