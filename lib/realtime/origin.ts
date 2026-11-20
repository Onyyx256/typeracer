/**
 * A page from another site could open a socket in the visitor's name, since
 * the browser sends the session cookie with it. Browsers always send Origin
 * then; a request without one is not a cross-site page.
 */
export function isSameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  if (!host) {
    return false;
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
