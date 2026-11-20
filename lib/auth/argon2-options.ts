/**
 * Argon2id (the library default) with OWASP's recommended minimum parameters.
 * Apart from password.ts so the seed script, which runs outside Next, uses
 * the same ones.
 */
export const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};
