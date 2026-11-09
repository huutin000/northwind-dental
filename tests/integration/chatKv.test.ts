import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { createFakeUpstash } from "../helpers/fakeUpstash";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const post = (cookie?: string) =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ message: "What time do you open?", history: [] }),
  });

// The counter store is a singleton per KV pair (its breaker state lives in it),
// so every test uses its own token.
let n = 0;
function env() {
  vi.stubEnv("AI_MODE", "mock");
  vi.stubEnv("SESSION_SECRET", "route-test-secret-0123456789");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://kv-test.invalid");
  const token = `fake-token-${++n}`;
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", token);
  return token;
}

describe("POST /api/chat with the key-value rate limiter", () => {
  it("counts through the KV store: one multi-exec (SET NX, INCR, TTL) per message, key chat:<session>", async () => {
    const fake = createFakeUpstash({ token: env() });
    vi.stubGlobal("fetch", fake.fetch);
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0].path).toBe("/multi-exec");
    const body = fake.requests[0].body as string[][];
    expect(body[0].slice(0, 2)).toEqual(["SET", expect.stringMatching(/^chat:[0-9a-f]{32}$/)]);
    expect(body[0].slice(2)).toEqual(["0", "EX", "600", "NX"]);
    expect(body.map((c) => c[0])).toEqual(["SET", "INCR", "TTL"]);
  });

  it("the 21st message of a session is denied (429) using the KV counter", async () => {
    const fake = createFakeUpstash({ token: env() });
    vi.stubGlobal("fetch", fake.fetch);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = await POST(post());
    const cookie = first.headers.get("set-cookie")!.split(";")[0];
    for (let i = 0; i < 19; i++) expect((await POST(post(cookie))).status).toBe(200);
    expect((await POST(post(cookie))).status).toBe(429);
  });

  it.each([
    ["HTTP 500", () => new Response("down", { status: 500 })],
    ["network error", () => Promise.reject(new TypeError("fetch failed"))],
    ["{error} reply", () => Response.json([{ error: "ERR x" }])],
  ])("the chat still answers 200 when the KV fails: %s", async (_l, impl) => {
    env();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => impl()));
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect((await res.json()).source).toBe("ai");
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
    for (const c of warn.mock.calls) expect(c).toEqual(["[kv] counter fallback: " + (c[0] as string).split(": ")[1]]);
  });
});
