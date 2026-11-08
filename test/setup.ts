import { mock } from "bun:test";

// `server-only` throws unless the module is bundled for React Server
// Components, which `bun test` never does. The guard protects the browser
// bundle, not tests, so it is replaced with an empty module here.
mock.module("server-only", () => ({}));

/** The database the tests write to; never the dev one (it would lose its rooms). */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://typeracer:typeracer@localhost:5432/typeracer_test";

if (!new URL(TEST_DATABASE_URL).pathname.endsWith("_test")) {
  throw new Error("TEST_DATABASE_URL must point at a database whose name ends in _test.");
}

// Set before anything calls getDb(), which connects on first use. Overrides
// the DATABASE_URL that Bun may have read from .env.local.
process.env.DATABASE_URL = TEST_DATABASE_URL;
