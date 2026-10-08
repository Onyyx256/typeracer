import "server-only";
import { hash } from "@node-rs/argon2";

// Argon2id (the library default) with OWASP's recommended minimum parameters.
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}
