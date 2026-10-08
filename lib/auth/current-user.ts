import "server-only";
import { cache } from "react";
import { getSessionUserId } from "./session";
import { findProfile } from "./users";

/** The signed-in user, or null. Cached per request so the header and the page share one lookup. */
export const getCurrentUser = cache(async () => {
  const userId = await getSessionUserId();
  return userId ? findProfile(userId) : null;
});
