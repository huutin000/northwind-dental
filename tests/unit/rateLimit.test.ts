import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  createMemoryCounterStore,
  type CounterStore,
} from "@/lib/guard/rateLimit";

const opts = { limit: 3, windowSeconds: 60 };

// Every test gets its own store so tests never share counters.
// Fake timers make "time passing" instant and exact.
let store: CounterStore;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  store = createMemoryCounterStore();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows the first 3 calls and denies the 4th with retryAfterSeconds > 0", async () => {
    for (let i = 0; i < 3; i++) {
      expect(await checkRateLimit("a", opts, store)).toEqual({
        allowed: true,
        retryAfterSeconds: 0,
      });
    }
    const denied = await checkRateLimit("a", opts, store);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    expect(Number.isInteger(denied.retryAfterSeconds)).toBe(true);
  });

  it("does not let two different keys affect each other", async () => {
    for (let i = 0; i < 4; i++) await checkRateLimit("a", opts, store);
    expect((await checkRateLimit("b", opts, store)).allowed).toBe(true);
  });

  it("allows the key again after the window passes", async () => {
    for (let i = 0; i < 4; i++) await checkRateLimit("a", opts, store);
    vi.advanceTimersByTime(60_000);
    expect((await checkRateLimit("a", opts, store)).allowed).toBe(true);
  });

  it("denies just before the window ends and allows exactly at the end", async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit("a", opts, store);
    vi.advanceTimersByTime(59_999);
    expect((await checkRateLimit("a", opts, store)).allowed).toBe(false);
    vi.advanceTimersByTime(1);
    expect((await checkRateLimit("a", opts, store)).allowed).toBe(true);
  });

  it("keeps denying until expiry, and denied calls do not extend the window", async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit("a", opts, store);
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(10_000);
      expect((await checkRateLimit("a", opts, store)).allowed).toBe(false);
    }
    // 50s passed; the window started at the first hit, so 10s more ends it.
    vi.advanceTimersByTime(10_000);
    expect((await checkRateLimit("a", opts, store)).allowed).toBe(true);
  });

  it("allows exactly 3 of 5 simultaneous calls", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => checkRateLimit("a", opts, store)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
  });

  it("treats __proto__ and constructor as ordinary keys", async () => {
    for (const key of ["__proto__", "constructor"]) {
      for (let i = 0; i < 3; i++) {
        expect((await checkRateLimit(key, opts, store)).allowed).toBe(true);
      }
      expect((await checkRateLimit(key, opts, store)).allowed).toBe(false);
    }
  });

  it("uses a custom store and leaves the default store untouched", async () => {
    const calls: Array<[string, number]> = [];
    const fake: CounterStore = {
      incr: async (key, windowSeconds) => {
        calls.push([key, windowSeconds]);
        return 99;
      },
    };
    const result = await checkRateLimit("custom-key", opts, fake);
    expect(result.allowed).toBe(false);
    expect(calls).toEqual([["custom-key", 60]]);

    // Same key on the default store must start fresh at count 1.
    expect((await checkRateLimit("custom-key", { limit: 1, windowSeconds: 60 })).allowed).toBe(true);
  });

  it("uses the shared default store when none is passed", async () => {
    const o = { limit: 1, windowSeconds: 60 };
    expect((await checkRateLimit("default-shared", o)).allowed).toBe(true);
    expect((await checkRateLimit("default-shared", o)).allowed).toBe(false);
  });

  it("keeps stores from createMemoryCounterStore independent", async () => {
    const other = createMemoryCounterStore();
    for (let i = 0; i < 4; i++) await checkRateLimit("a", opts, store);
    expect((await checkRateLimit("a", opts, other)).allowed).toBe(true);
  });

  it.each([
    ["limit 0", { limit: 0, windowSeconds: 60 }],
    ["limit 1.5", { limit: 1.5, windowSeconds: 60 }],
    ["limit -1", { limit: -1, windowSeconds: 60 }],
    ["windowSeconds 0", { limit: 3, windowSeconds: 0 }],
    ["windowSeconds NaN", { limit: 3, windowSeconds: Number.NaN }],
  ])("rejects invalid options (%s) with RangeError", async (_name, bad) => {
    await expect(checkRateLimit("a", bad, store)).rejects.toThrow(RangeError);
  });
});

describe("createMemoryCounterStore", () => {
  it("counts up inside a window and restarts at 1 after it", async () => {
    expect(await store.incr("k", 10)).toBe(1);
    expect(await store.incr("k", 10)).toBe(2);
    vi.advanceTimersByTime(10_000);
    expect(await store.incr("k", 10)).toBe(1);
  });

  it("removes thousands of expired keys instead of keeping them", async () => {
    for (let i = 0; i < 2000; i++) await store.incr(`old-${i}`, 10);

    // Move far past the window (and past any sweep interval), then touch a
    // different key. The store's size is private, so we watch Map deletions.
    vi.advanceTimersByTime(10 * 60_000);
    const del = vi.spyOn(Map.prototype, "delete");
    await store.incr("fresh", 10);
    expect(del.mock.calls.length).toBeGreaterThanOrEqual(2000);

    // Behaviour is still right: an old key starts a fresh window.
    expect(await store.incr("old-0", 10)).toBe(1);
  });
});
