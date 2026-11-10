import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Live e2e config: the OWNER runs it by hand with a real Groq key. Never in CI.
// It never touches the key-value store (the four variables are emptied for the server).
// GROQ_API_KEY and GROQ_MODEL are read from the invoking shell; their values are never printed.

if (!process.env.GROQ_API_KEY?.trim()) {
  throw new Error(
    "GROQ_API_KEY is not set in this shell. The @live tests call the real Groq API; set GROQ_API_KEY (and optionally GROQ_MODEL) first.",
  );
}
if (!existsSync(join(__dirname, ".next", "BUILD_ID"))) {
  throw new Error("No production build found (.next/BUILD_ID is missing). Run `npm run build` first.");
}

// BLANK is a single space ON PURPOSE, not an empty string. `lib/kv/upstash.ts getKvConfig()` trims every
// value, so a space means "no key-value store". Unlike "", a non-empty value survives shells and spawn
// chains that drop empty variables, and @next/env's expand step copies env-file values only for keys that
// are missing from process.env, so a local env file cannot bring real values back. No value is printed.
const BLANK = " ";

const PORT = 3401;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/live.spec.ts",
  grep: /@live/,
  fullyParallel: false,
  workers: 1, // spare the Groq quota and the per-session chat limit
  forbidOnly: true,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      AI_MODE: "groq",
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      GROQ_MODEL: process.env.GROQ_MODEL ?? "",
      SESSION_SECRET: "e2e-fake-session-secret-not-a-real-secret-0001",
      UPSTASH_REDIS_REST_URL: BLANK,
      UPSTASH_REDIS_REST_TOKEN: BLANK,
      KV_REST_API_URL: BLANK,
      KV_REST_API_TOKEN: BLANK,
      KV_LIVE_TEST: "",
    },
  },
});
