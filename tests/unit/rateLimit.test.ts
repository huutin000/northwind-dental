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

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects maxKeys %s with RangeError",
    (bad) => {
      expect(() => createMemoryCounterStore({ maxKeys: bad })).toThrow(RangeError);
    },
  );

  it("evicts the oldest key when full; the others keep counting", async () => {
    const small = createMemoryCounterStore({ maxKeys: 3 });
    for (const k of ["a", "b", "c"]) expect(await small.incr(k, 60)).toBe(1);
    expect(await small.incr("d", 60)).toBe(1); // new key, store full -> evicts a
    expect(await small.incr("b", 60)).toBe(2);
    expect(await small.incr("c", 60)).toBe(2);
    expect(await small.incr("d", 60)).toBe(2);
    expect(await small.incr("a", 60)).toBe(1); // a restarted (fails open)
  });

  it("sweeps expired entries before evicting a live one", async () => {
    const small = createMemoryCounterStore({ maxKeys: 3 });
    // The expired key sits in the MIDDLE, so plain oldest-first eviction
    // would remove live1 and this test would fail.
    await small.incr("live1", 60);
    await small.incr("short", 5);
    await small.incr("live2", 60);
    vi.advanceTimersByTime(5_000); // "short" expired; below the periodic sweep interval
    expect(await small.incr("new", 60)).toBe(1); // full -> sweep frees "short"
    expect(await small.incr("live1", 60)).toBe(2);
    expect(await small.incr("live2", 60)).toBe(2);
    expect(await small.incr("new", 60)).toBe(2);
    expect(await small.incr("short", 5)).toBe(1); // it was gone
  });

  it("treats a restarted window as the newest key for eviction order", async () => {
    // Below the cap, so the cap-time sweep cannot hide a missing re-insert.
    const small = createMemoryCounterStore({ maxKeys: 3 });
    await small.incr("a", 5);
    await small.incr("b", 60);
    vi.advanceTimersByTime(5_000); // a expired
    expect(await small.incr("a", 60)).toBe(1); // restart: a must move behind b
    expect(await small.incr("c", 60)).toBe(1); // size 3, not over the cap
    expect(await small.incr("d", 60)).toBe(1); // full -> evicts b (oldest), not a
    expect(await small.incr("a", 60)).toBe(2);
    expect(await small.incr("c", 60)).toBe(2);
    expect(await small.incr("d", 60)).toBe(2);
    expect(await small.incr("b", 60)).toBe(1);
  });

  // Fill a 2-key store so "l" is the oldest live key and "s" (0.1 s window) the
  // newest. The cap-time sweep ran once, at the start instant.
  async function fullStoreWithExpiringKey() {
    const small = createMemoryCounterStore({ maxKeys: 2 });
    await small.incr("p", 60);
    await small.incr("q", 60);
    await small.incr("l", 60); // full -> sweep (nothing expired), evicts p
    await small.incr("s", 0.1); // full -> sweep skipped (same instant), evicts q
    return small;
  }

  it("runs the cap-time sweep at most once per second", async () => {
    const small = await fullStoreWithExpiringKey();
    vi.advanceTimersByTime(200); // "s" expired, but the last sweep was < 1 s ago
    expect(await small.incr("n", 60)).toBe(1); // sweep skipped -> oldest ("l") evicted
    expect(await small.incr("l", 60)).toBe(1);
  });

  it("sweeps again at the cap once a second has passed", async () => {
    const small = await fullStoreWithExpiringKey();
    vi.advanceTimersByTime(1_100); // "s" expired and a new sweep is allowed
    expect(await small.incr("n", 60)).toBe(1); // sweep frees "s"; "l" survives
    expect(await small.incr("l", 60)).toBe(2);
  });

  it("keeps only the newest maxKeys keys under a flood of new keys", async () => {
    const small = createMemoryCounterStore({ maxKeys: 5 });
    for (let i = 0; i < 50; i++) await small.incr(`k${i}`, 60);
    expect(await small.incr("k49", 60)).toBe(2);
    expect(await small.incr("k45", 60)).toBe(2);
    expect(await small.incr("k0", 60)).toBe(1);
  });
});
