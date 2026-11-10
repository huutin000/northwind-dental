import { afterEach, describe, expect, it, vi } from "vitest";
import { getLeadStore, LEAD_STORE_TIMEOUT_MS } from "@/lib/leads/store";
import { maxDuration } from "@/app/api/leads/route";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("lead store client timeout", () => {
  it("is 2000 ms", () => {
    expect(LEAD_STORE_TIMEOUT_MS).toBe(2000);
  });

  it("a hanging KV request is given up after about 2 s (list and add)", async () => {
    vi.useFakeTimers();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://kv-timeout.invalid");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token-timeout");
    // A fetch that never answers and only ends when it is aborted.
    const hang = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          init?.signal?.addEventListener("abort", () => rej(new Error("aborted")));
        }),
    );
    vi.stubGlobal("fetch", hang);
    const sid = "0123456789abcdef0123456789abcdef";

    let settled = false;
    const p = getLeadStore().list(sid).catch((e: unknown) => {
      settled = true;
      return e;
    });
    await vi.advanceTimersByTimeAsync(1999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toMatchObject({ kind: "timeout" });

    const add = getLeadStore()
      .add(sid, { id: "lead-timeout-1", createdAt: new Date(0).toISOString(), email: "a@b.co", category: "other" })
      .catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await add).toMatchObject({ kind: "timeout" });
  });
});

describe("leads route time budget", () => {
  it("maxDuration is 10", () => {
    expect(maxDuration).toBe(10);
  });
});
