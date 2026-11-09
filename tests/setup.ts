// Runs before every test file of the DEFAULT config (`npm test`). It always removes
// the key-value credentials, so no unit test can reach the real database even when
// the developer's shell has them set. Tests that need them use vi.stubEnv with
// fake `.invalid` hosts. The opt-in live test uses its own config
// (vitest.live.config.mts), which has no such setup file.
for (const name of [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
]) {
  delete process.env[name];
}
