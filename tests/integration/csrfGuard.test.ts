import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Wrap the three factories the routes call AFTER the guard. If a rejected request
// reaches the provider, the store or the limiter, one of these spies is called.
vi.mock("@/lib/ai", async (orig) => {
  const m = await orig<typeof import("@/lib/ai")>();
  return { ...m, getProvider: vi.fn(m.getProvider) };
});
vi.mock("@/lib/leads/store", async (orig) => {
  const m = await orig<typeof import("@/lib/leads/store")>();
  return { ...m, getLeadStore: vi.fn(m.getLeadStore) };
});
vi.mock("@/lib/kv/counterStore", async (orig) => {
  const m = await orig<typeof import("@/lib/kv/counterStore")>();
  return { ...m, getCounterStore: vi.fn(m.getCounterStore) };
});

import { getProvider } from "@/lib/ai";
import { getLeadStore } from "@/lib/leads/store";
import { getCounterStore } from "@/lib/kv/counterStore";
import { POST as chatPost } from "@/app/api/chat/route";
import { POST as leadPost } from "@/app/api/leads/route";

beforeEach(() => {
  vi.stubEnv("AI_MODE", "off");
  vi.stubEnv("SESSION_SECRET", "route-test-secret-0123456789");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(getProvider).mockClear();
  vi.mocked(getLeadStore).mockClear();
  vi.mocked(getCounterStore).mockClear();
});

const routes = [
  ["/api/chat", chatPost, { message: "What time do you open?", history: [] }],
  ["/api/leads", leadPost, { email: "visitor@clinic-mail.org" }],
] as const;

function request(path: string, body: unknown, headers: Record<string, string>) {
  return new Request("http://localhost:3000" + path, { method: "POST", headers, body: JSON.stringify(body) });
}

describe.each(routes)("CSRF guard on POST %s", (path, handler, body) => {
  const json = { "content-type": "application/json" };

  it.each([
    ["text/plain", { "content-type": "text/plain" }, 415, "Unsupported content type."],
    ["no content type", {}, 415, "Unsupported content type."],
    ["form post", { "content-type": "application/x-www-form-urlencoded" }, 415, "Unsupported content type."],
    ["cross-site", { ...json, "sec-fetch-site": "cross-site" }, 403, "Request not allowed."],
    ["same-site", { ...json, "sec-fetch-site": "same-site" }, 403, "Request not allowed."],
    ["foreign Origin", { ...json, host: "localhost:3000", origin: "https://evil.example" }, 403, "Request not allowed."],
    ["Origin null", { ...json, host: "localhost:3000", origin: "null" }, 403, "Request not allowed."],
    [
      "the reproduced attack",
      { "content-type": "text/plain", origin: "https://evil.example", "sec-fetch-site": "cross-site" },
      415,
      "Unsupported content type.",
    ],
  ])("%s -> rejected, no cookie, nothing else called", async (_n, headers, status, error) => {
    const res = await handler(request(path, body, headers));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(getProvider).not.toHaveBeenCalled();
    expect(getLeadStore).not.toHaveBeenCalled();
    expect(getCounterStore).not.toHaveBeenCalled();
  });

  it("a normal same-origin JSON request still works", async () => {
    const res = await handler(
      request(path, body, {
        "content-type": "application/json; charset=utf-8",
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
      }),
    );
    expect(res.status).toBe(path === "/api/leads" ? 201 : 200);
    expect(res.headers.get("set-cookie")).toContain("nd_session=");
    expect(getCounterStore).toHaveBeenCalled();
  });
});
