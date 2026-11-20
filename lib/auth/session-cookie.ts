export const SESSION_COOKIE = "session";

const SIGNED_IN_PATHS = ["/stats", "/account", "/rooms/new"];

/**
 * Pages that call requireUser. The proxy sends a visitor with no session
 * cookie straight to the login page: a redirect from the page itself comes
 * after a 200 and a meta refresh, which costs seconds on a phone.
 */
export function needsSignIn(path: string): boolean {
  return SIGNED_IN_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
