import { USERNAME_MAX, USERNAME_MIN, nicknameSchema } from "./validation";

const FALLBACK_USERNAME = "player";
const SUFFIX_DIGITS = 4;

/**
 * A username in the signup rules made from a provider login. The first try
 * is the login itself; later tries add a random suffix, since the login may
 * already be taken by someone who signed up with a password.
 */
export function usernameCandidate(login: string, attempt: number, random: () => number): string {
  let base = login.replace(/[^A-Za-z0-9._-]/g, "");
  if (base.length < USERNAME_MIN) {
    base = FALLBACK_USERNAME;
  }
  if (attempt === 0) {
    return base.slice(0, USERNAME_MAX);
  }
  const suffix = String(Math.floor(random() * 10 ** SUFFIX_DIGITS)).padStart(SUFFIX_DIGITS, "0");
  return `${base.slice(0, USERNAME_MAX - SUFFIX_DIGITS - 1)}_${suffix}`;
}

/** The provider's display name when it fits the nickname rules, else the username. */
export function displayNameFor(name: string | null, username: string): string {
  const parsed = nicknameSchema.safeParse(name ?? "");
  return parsed.success ? parsed.data : username;
}
