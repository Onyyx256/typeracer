import { randomUUID } from "node:crypto";

/** Same rule as the unit tests (test/setup.ts): only a database whose name ends in _test. */
export const E2E_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://typeracer:typeracer@localhost:5432/typeracer_test";

if (!new URL(E2E_DATABASE_URL).pathname.endsWith("_test")) {
  throw new Error("TEST_DATABASE_URL must point at a database whose name ends in _test.");
}

/**
 * Every username and nickname the e2e tests type starts with this, so the
 * teardown deletes exactly their rows.
 */
export const E2E_PREFIX = "e2e_";

/** A valid name nobody else has, e.g. "e2e_3f9a1c2b". */
export function e2eName(): string {
  return `${E2E_PREFIX}${randomUUID().slice(0, 8)}`;
}
