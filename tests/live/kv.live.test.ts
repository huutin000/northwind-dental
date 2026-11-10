// OPT-IN live test against the real Upstash database. It is NOT part of `npm test`
// (the default config excludes tests/live). The OWNER runs it:
//
//   KV_LIVE_TEST=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run --config vitest.live.config.mts
//
// Without KV_LIVE_TEST=1 the suite is skipped. With KV_LIVE_TEST=1 but no valid
// Upstash variables it FAILS (it never skips silently).
//
// Keys: counter and scratch keys use a random `qa-live-<hex>:` prefix; lead tests
// use a fake session id `deadbeefdeadbeef` + 16 random hex characters (32 hex in all).
// These namespaces are test-only, so beforeAll/afterAll sweep them with SCAN (see sweep())
// to also remove leftovers of an interrupted run. Before any DEL, only keys that really
// start with one of the exact prefixes below are kept. Nothing else is ever deleted.
//
// Output: durations and request counts only. Never the URL, token, keys, ids or lead data.

import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getKvStatus, type KvClient } from "@/lib/kv/upstash";
import { createKvCounterStore } from "@/lib/kv/counterStore";
import { createKvLeadStore, LEAD_INDEX_MAX } from "@/lib/leads/store";

const enabled = process.env.KV_LIVE_TEST === "1";
const status = getKvStatus();

// The only three namespaces the sweep may touch (SCAN patterns, and the exact prefixes
// that every found key must still have before it is deleted).
const FAKE_SESSION_PREFIX = "deadbeefdeadbeef";
const SWEEP_PREFIXES = ["qa-live-", `lead:${FAKE_SESSION_PREFIX}`, `leads:${FAKE_SESSION_PREFIX}`];
const SWEEP_PATTERNS = SWEEP_PREFIXES.map((p) => `${p}*`);
const SWEEP_MAX_LOOPS = 50;
const DEL_CHUNK = 100;

if (enabled && status.state !== "ok") {
  describe("live Upstash", () => {
    it("needs valid Upstash variables", () => {
      throw new Error("KV_LIVE_TEST=1 but no valid Upstash variables were found");
    });
  });
} else {
  describe.skipIf(!enabled)("live Upstash (opt-in)", () => {
    const kv: KvClient = status.state === "ok" ? status.client : (null as never);
    const prefix = `qa-live-${randomBytes(6).toString("hex")}:`;
    const tracked = new Set<string>();

    // Register a key BEFORE the request that creates it, so a failure in the
    // middle of a test still gets cleaned up.
    const track = (k: string) => {
      tracked.add(k);
      return k;
    };
    const newSession = () => `${FAKE_SESSION_PREFIX}${randomBytes(8).toString("hex")}`; // 32 hex chars
    const ttlOf = async (k: string) => (await kv.command(["TTL", k])) as number;

    // Count requests by wrapping fetch (the client looks it up at call time).
    const realFetch = globalThis.fetch;
    let requests = 0;

    async function timed(phase: string, fn: () => Promise<void>) {
      const r0 = requests;
      const t0 = Date.now();
      try {
        await fn();
      } finally {
        console.log(`[live] ${phase} took ${Date.now() - t0} ms (${requests - r0} requests)`);
      }
    }

    // One DEL per chunk of 100 keys; a failing chunk never blocks the others and
    // nothing is rethrown (an error could carry details).
    async function del(keys: string[]) {
      for (let i = 0; i < keys.length; i += DEL_CHUNK) {
        try {
          await kv.command(["DEL", ...keys.slice(i, i + DEL_CHUNK)]);
        } catch {
          console.log("[live] cleanup: one DEL failed");
        }
      }
    }

    async function cleanup() {
      const keys = [...tracked];
      tracked.clear();
      try {
        if (keys.length > 0) await del(keys);
      } finally {
        // nothing else to release
      }
    }

    // SCAN (never KEYS) for exactly the three test-only patterns, COUNT 100, until the
    // cursor is "0" (at most 50 loops each), then DEL only what was found.
    async function sweep() {
      const found = new Set<string>();
      try {
        for (const pattern of SWEEP_PATTERNS) {
          let cursor = "0";
          for (let i = 0; i < SWEEP_MAX_LOOPS; i++) {
            const reply = (await kv.command(["SCAN", cursor, "MATCH", pattern, "COUNT", 100])) as [string, string[]];
            cursor = String(reply[0]);
            for (const k of reply[1]) found.add(k);
            if (cursor === "0") break;
          }
        }
      } catch {
        console.log("[live] sweep: SCAN failed");
      }
      // SCAN MATCH is only a hint: delete a key only if it really has an exact test prefix.
      const safe = [...found].filter((k) => SWEEP_PREFIXES.some((p) => k.startsWith(p)));
      if (safe.length > 0) await del(safe);
      console.log(`[live] sweep removed ${safe.length} leftover keys`);
    }

    beforeAll(async () => {
      globalThis.fetch = ((...a: Parameters<typeof fetch>) => {
        requests++;
        return realFetch(...a);
      }) as typeof fetch;

      // Round trip time, so latency can be told apart from logic errors. PING is not charged.
      const times: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = Date.now();
        await kv.command(["PING"]);
        times.push(Date.now() - t0);
      }
      times.sort((a, b) => a - b);
      console.log(`[live] round trip median ${times[2]} ms over ${times.length} pings`);

      await sweep();
    });

    afterEach(cleanup);

    afterAll(async () => {
      try {
        await cleanup();
        await sweep();
      } finally {
        globalThis.fetch = realFetch;
      }
    });

    it("SET ... EX sets a value with a TTL", () =>
      timed("SET EX", async () => {
        const k = track(prefix + "set");
        expect(await kv.command(["SET", k, "v", "EX", 60])).toBe("OK");
        const [value, ttl] = (await kv.pipeline([["GET", k], ["TTL", k]])) as [string, number];
        expect(value).toBe("v");
        expect(ttl).toBeGreaterThanOrEqual(1);
        expect(ttl).toBeLessThanOrEqual(60);
      }));

    it("counter store: 1, 2, 3 in one window; the TTL is set once and not extended", () =>
      timed("counter", async () => {
        const k = track(prefix + "counter");
        const store = createKvCounterStore(kv);
        expect(await store.incr(k, 60)).toBe(1);
        const ttl1 = await ttlOf(k);
        expect(ttl1).toBeGreaterThanOrEqual(1);
        expect(ttl1).toBeLessThanOrEqual(60);
        expect(await store.incr(k, 60)).toBe(2);
        expect(await store.incr(k, 60)).toBe(3);
        expect(await ttlOf(k)).toBeLessThanOrEqual(ttl1); // never reset upwards
      }));

    it("counter store repairs a key that has no expiry", () =>
      timed("repair", async () => {
        const k = track(prefix + "no-expiry");
        await kv.command(["SET", k, "5"]); // raw SET: no EX
        expect(await ttlOf(k)).toBe(-1);
        expect(await createKvCounterStore(kv).incr(k, 60)).toBe(6);
        const ttl = await ttlOf(k);
        expect(ttl).toBeGreaterThanOrEqual(1);
        expect(ttl).toBeLessThanOrEqual(60);
      }));

    it("lead store: add, list (newest first), count, idempotent retry, real 24h TTLs", () =>
      timed("lead store", async () => {
        const sid = newSession();
        const ids = ["live-lead-0001", "live-lead-0002"];
        const keys = [...ids.map((id) => `lead:${sid}:${id}`), `leads:${sid}`];
        keys.forEach(track);
        const store = createKvLeadStore(kv);
        expect(await store.list(sid)).toEqual([]);

        const mk = (id: string, i: number) => ({
          id,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
          email: `live${i}@example.com`,
          category: "other" as const,
        });
        await store.add(sid, mk(ids[0], 1));
        await store.add(sid, mk(ids[1], 2));
        await store.add(sid, mk(ids[1], 2)); // a retry of the same lead

        expect((await store.list(sid)).map((l) => l.id)).toEqual([ids[1], ids[0]]);
        expect(await store.count(sid)).toBe(2);

        // One request for all three TTLs.
        const ttls = (await kv.pipeline(keys.map((k) => ["TTL", k]))) as number[];
        for (const ttl of ttls) {
          expect(ttl).toBeGreaterThan(86000);
          expect(ttl).toBeLessThanOrEqual(86400);
        }
      }));

    it("lead store: the index is capped by LTRIM", () =>
      timed("LTRIM cap", async () => {
        const sid = newSession();
        const index = track(`leads:${sid}`);
        const newId = "live-cap-new-1";
        track(`lead:${sid}:${newId}`);
        // 25 fake ids seeded in ONE request (they have no lead keys; only the index matters).
        const seeded = Array.from({ length: LEAD_INDEX_MAX + 5 }, (_, i) => `live-seed-${String(i + 1).padStart(2, "0")}`);
        expect(await kv.command(["RPUSH", index, ...seeded])).toBe(seeded.length);

        // ONE add: its transaction pushes the new id and runs LTRIM -20 -1.
        await createKvLeadStore(kv).add(sid, {
          id: newId,
          createdAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
          email: "cap@example.com",
          category: "other",
        });

        const [len, last, first] = (await kv.pipeline([
          ["LLEN", index],
          ["LRANGE", index, "-1", "-1"],
          ["LRANGE", index, "0", "0"],
        ])) as [number, string[], string[]];
        expect(len).toBe(LEAD_INDEX_MAX);
        expect(last).toEqual([newId]);
        // 26 ids pushed, the last 20 kept: seeds 1..6 are gone, seed 7 is the oldest left.
        expect(first).toEqual(["live-seed-07"]);
      }));
  });
}
