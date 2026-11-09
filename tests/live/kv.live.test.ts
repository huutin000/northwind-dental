// OPT-IN live test against the real Upstash database. It is NOT part of `npm test`
// (the default config excludes tests/live). The OWNER runs it:
//
//   KV_LIVE_TEST=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run --config vitest.live.config.mts
//
// Without KV_LIVE_TEST=1 the suite is skipped. With KV_LIVE_TEST=1 but no valid
// Upstash variables it FAILS (it never skips silently). Every key it creates has a
// random `qa-live-<hex>:` prefix (or a random fake session id) and is deleted in
// afterAll. It prints no URL or token.

import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getKvStatus } from "@/lib/kv/upstash";
import { createKvCounterStore } from "@/lib/kv/counterStore";
import { createKvLeadStore, LEAD_INDEX_MAX } from "@/lib/leads/store";

const enabled = process.env.KV_LIVE_TEST === "1";
const status = getKvStatus();

if (enabled && status.state !== "ok") {
  describe("live Upstash", () => {
    it("needs valid Upstash variables", () => {
      throw new Error("KV_LIVE_TEST=1 but no valid Upstash variables were found");
    });
  });
} else {
  describe.skipIf(!enabled)("live Upstash (opt-in)", () => {
    const kv = status.state === "ok" ? status.client : null!;
    const prefix = `qa-live-${randomBytes(6).toString("hex")}:`;
    const created: string[] = [];
    const key = (name: string) => {
      const k = prefix + name;
      created.push(k);
      return k;
    };
    const ttlOf = async (k: string) => (await kv.command(["TTL", k])) as number;

    afterAll(async () => {
      for (let i = 0; i < created.length; i += 50) await kv.command(["DEL", ...created.slice(i, i + 50)]);
    });

    it("SET ... EX sets a value with a TTL", async () => {
      const k = key("set");
      expect(await kv.command(["SET", k, "v", "EX", 60])).toBe("OK");
      expect(await kv.command(["GET", k])).toBe("v");
      const ttl = await ttlOf(k);
      expect(ttl).toBeGreaterThanOrEqual(1);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it("counter store: 1, 2, 3 in one window; the TTL is set once and not extended", async () => {
      const k = key("counter");
      const store = createKvCounterStore(kv);
      expect(await store.incr(k, 60)).toBe(1);
      const ttl1 = await ttlOf(k);
      expect(ttl1).toBeGreaterThanOrEqual(1);
      expect(ttl1).toBeLessThanOrEqual(60);
      expect(await store.incr(k, 60)).toBe(2);
      expect(await store.incr(k, 60)).toBe(3);
      expect(await ttlOf(k)).toBeLessThanOrEqual(ttl1); // never reset upwards
    });

    it("counter store repairs a key that has no expiry", async () => {
      const k = key("no-expiry");
      await kv.command(["SET", k, "5"]); // raw SET: no EX
      expect(await ttlOf(k)).toBe(-1);
      expect(await createKvCounterStore(kv).incr(k, 60)).toBe(6);
      const ttl = await ttlOf(k);
      expect(ttl).toBeGreaterThanOrEqual(1);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it("lead store: add, list (newest first), count, idempotent retry, real 24h TTLs", async () => {
      const sid = randomBytes(16).toString("hex"); // fake 32-hex session id
      const ids = ["live-lead-0001", "live-lead-0002"];
      created.push(`leads:${sid}`, ...ids.map((id) => `lead:${sid}:${id}`));
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

      for (const k of [...ids.map((id) => `lead:${sid}:${id}`), `leads:${sid}`]) {
        const ttl = await ttlOf(k);
        expect(ttl).toBeGreaterThan(86000);
        expect(ttl).toBeLessThanOrEqual(86400);
      }
    });

    it("lead store: the index is capped by LTRIM", async () => {
      const sid = randomBytes(16).toString("hex");
      const total = LEAD_INDEX_MAX + 5;
      const idOf = (i: number) => `live-cap-${String(i).padStart(4, "0")}`;
      created.push(`leads:${sid}`);
      for (let i = 1; i <= total; i++) created.push(`lead:${sid}:${idOf(i)}`);
      const store = createKvLeadStore(kv);
      for (let i = 1; i <= total; i++) {
        await store.add(sid, {
          id: idOf(i),
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
          email: `cap${i}@example.com`,
          category: "other",
        });
      }
      const index = (await kv.command(["LRANGE", `leads:${sid}`, "0", "-1"])) as string[];
      expect(index).toHaveLength(LEAD_INDEX_MAX);
      const listed = await store.list(sid);
      expect(listed).toHaveLength(LEAD_INDEX_MAX);
      expect(listed[0].id).toBe(idOf(total));
    });
  });
}
