import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id (the library default) with OWASP's recommended minimum parameters.
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

// Verified against when the username does not exist, so a miss costs the same
// time as a wrong password and response time does not reveal which names exist.
const decoyHash = hashPassword("decoy");

/** `passwordHash` is null for an unknown user or an OAuth-only account. */
export async function verifyPassword(
  passwordHash: string | null,
  password: string,
): Promise<boolean> {
  const matches = await verify(passwordHash ?? (await decoyHash), password);
  return passwordHash !== null && matches;
}
