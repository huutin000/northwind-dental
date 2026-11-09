// Config for the opt-in LIVE test only (tests/live). Unlike vitest.config.mts it has
// NO setup file that deletes the key-value variables. See tests/live/kv.live.test.ts.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    include: ["tests/live/**/*.test.ts"],
  },
});
