import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL } from "./e2e/database";

// End-to-end tests (TEST-02): a production build of the app, on its own
// port and against the typeracer_test database, so a dev server on 3000
// and its data are left alone.
//   bun run test:e2e

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  // Not *.test.ts or *.spec.ts: `bun test` would pick those up as unit tests.
  testMatch: "**/*.e2e.ts",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The custom server (Next + Socket.IO), as in production, so live updates are tested too.
    command: "bun run build && bun run start",
    url: `${baseURL}/en`,
    env: { PORT: String(PORT), DATABASE_URL: E2E_DATABASE_URL },
    // Never reuse whatever is on the port: it could be using another database.
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
