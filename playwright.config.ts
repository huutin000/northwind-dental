import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Default e2e config. Runs the EXISTING production build (`npm run build` first) with
// mock AI and NO key-value store, whatever the developer's shell or local env file holds.
//
// Why the empty strings work: `next start` loads the local env files with @next/env, which
// never overwrites a variable that is already defined in the parent environment. An empty
// string counts as defined, so a local env file cannot bring the real values back, and
// `getKvConfig()` trims values, so an empty string means "no KV" (per-instance memory).

if (!existsSync(join(__dirname, ".next", "BUILD_ID"))) {
  throw new Error("No production build found (.next/BUILD_ID is missing). Run `npm run build` first.");
}

// BLANK is a single space ON PURPOSE, not an empty string. `lib/kv/upstash.ts getKvConfig()` trims every
// value, so a space means "no key-value store". Unlike "", a non-empty value survives shells and spawn
// chains that drop empty variables, and @next/env's expand step copies env-file values only for keys that
// are missing from process.env, so a local env file cannot bring real values back. No value is printed.
const BLANK = " ";

const PORT = 3400;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  grepInvert: /@live/,
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", testIgnore: /mobile\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      // Only the UI flows (and the phone-only test) run on a phone; the sweep sets its own viewports and the API tests have no UI.
      testMatch: /(chat|lead|mobile)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      AI_MODE: "mock",
      SESSION_SECRET: "e2e-fake-session-secret-not-a-real-secret-0001",
      GROQ_API_KEY: BLANK,
      GROQ_MODEL: BLANK,
      // All four key-value variables are emptied: the e2e run must never reach a real database.
      UPSTASH_REDIS_REST_URL: BLANK,
      UPSTASH_REDIS_REST_TOKEN: BLANK,
      KV_REST_API_URL: BLANK,
      KV_REST_API_TOKEN: BLANK,
      KV_LIVE_TEST: "",
    },
  },
});
