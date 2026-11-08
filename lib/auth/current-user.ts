import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/dictionaries";
import { getSessionUserId } from "./session";
import { findProfile } from "./users";

/**
 * Whoever holds a valid session: a signed-in user or a guest (AUTH-02), or
 * null. Cached per request so the header and the page share one lookup.
 */
export const getViewer = cache(async () => {
  const userId = await getSessionUserId();
  return userId ? findProfile(userId) : null;
});

/** The signed-in user, or null for a visitor without a session and for a guest (AUTH-03). */
export const getCurrentUser = cache(async () => {
  const viewer = await getViewer();
  return viewer && !viewer.isGuest ? viewer : null;
});

/** The signed-in user; anyone else is sent to the login page instead. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(localePath(await getLocale(), "/login"));
  }
  return user;
}
