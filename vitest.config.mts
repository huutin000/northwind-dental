import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Same mapping as tsconfig.json: "@/*" -> "./*" (the project root).
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // The live (real network) test has its own config: vitest.live.config.mts.
    exclude: [...configDefaults.exclude, "tests/live/**"],
    // Strips the key-value credentials from process.env before each test file.
    setupFiles: ["tests/setup.ts"],
  },
});
