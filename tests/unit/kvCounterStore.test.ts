import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFallbackCounterStore,
  createKvCounterStore,
  getCounterStore,
} from "@/lib/kv/counterStore";
import { createUpstashClient, KvError, type KvClient } from "@/lib/kv/upstash";
import { createMemoryCounterStore, type CounterStore } from "@/lib/guard/rateLimit";
import { createFakeUpstash } from "../helpers/fakeUpstash";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup(timeoutMs?: number) {
  const fake = createFakeUpstash();
  const client = createUpstashClient({ url: fake.url, token: fake.token, fetch: fake.fetch, timeoutMs });
  return { fake, client, store: createKvCounterStore(client) };
}

const quietWarn = () => vi.spyOn(console, "warn").mockImplementation(() => {});

describe("createKvCounterStore", () => {
  it("first call returns 1 and sets the TTL; second returns 2 without extending it", async () => {
    const { fake, store } = setup();
    expect(await store.incr("chat:abc", 600)).toBe(1);
    expect(fake.ttlOf("chat:abc")).toBe(600);
    fake.advance(100);
    expect(await store.incr("chat:abc", 600)).toBe(2);
    expect(fake.ttlOf("chat:abc")).toBe(500); // not reset to 600
  });

  it("the window expires and the counter restarts at 1", async () => {
    const { fake, store } = setup();
    await store.incr("k", 60);
    await store.incr("k", 60);
    fake.advance(59);
    expect(await store.incr("k", 60)).toBe(3);
    fake.advance(2); // now past the original window
    expect(await store.incr("k", 60)).toBe(1);
    expect(fake.ttlOf("k")).toBe(60);
  });

  it("sends ONE atomic multi-exec of THREE commands: SET NX, INCR, TTL; no EXPIRE normally", async () => {
    const { fake, store } = setup();
    await store.incr("chat:abc", 600);
    await store.incr("chat:abc", 600);
    expect(fake.requests).toHaveLength(2); // one request per call
    expect(fake.requests[0].path).toBe("/multi-exec");
    expect(fake.requests[0].body).toEqual([
      ["SET", "chat:abc", "0", "EX", "600", "NX"],
      ["INCR", "chat:abc"],
      ["TTL", "chat:abc"],
    ]);
    expect(JSON.stringify(fake.requests)).not.toContain("EXPIRE");
  });

  it("rounds a fractional window up to whole seconds", async () => {
    const { fake, store } = setup();
    await store.incr("a", 0.5);
    await store.incr("b", 600.2);
    expect((fake.requests[0].body as string[][])[0]).toEqual(["SET", "a", "0", "EX", "1", "NX"]);
    expect((fake.requests[1].body as string[][])[0]).toEqual(["SET", "b", "0", "EX", "601", "NX"]);
  });

  it("5 simultaneous calls get 1..5", async () => {
    const { store } = setup();
    const counts = await Promise.all([1, 2, 3, 4, 5].map(() => store.incr("k", 60)));
    expect([...counts].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  describe("a key without a TTL is repaired", () => {
    it("a key written without EX: next incr sets the window, then it expires and restarts at 1", async () => {
      const { fake, store } = setup();
      fake.seed("k", "5"); // no expiry at all
      expect(await store.incr("k", 60)).toBe(6);
      // The repair is ONE extra plain command (not another transaction).
      expect(fake.requests).toHaveLength(2);
      expect(fake.requests[1].path).toBe("/");
      expect(fake.requests[1].body).toEqual(["EXPIRE", "k", "60"]);
      expect(fake.ttlOf("k")).toBe(60);
      expect(await store.incr("k", 60)).toBe(7); // counting continues, repair not repeated
      expect(fake.requests).toHaveLength(3);
      fake.advance(61);
      expect(await store.incr("k", 60)).toBe(1); // never stuck
    });

    it("SET then PERSIST (expiry removed) is repaired too", async () => {
      const { fake, client, store } = setup();
      await store.incr("k", 60);
      await client.command(["PERSIST", "k"]);
      expect(fake.ttlOf("k")).toBe(-1);
      expect(await store.incr("k", 60)).toBe(2);
      expect(fake.ttlOf("k")).toBe(60);
    });

    it("the repair rounds a fractional window up", async () => {
      const { fake, store } = setup();
      fake.seed("k", "0");
      await store.incr("k", 59.1);
      expect(fake.requests[1].body).toEqual(["EXPIRE", "k", "60"]);
    });

    const stub = (ttl: unknown, command = vi.fn<KvClient["command"]>(async () => 1)): { client: KvClient; command: typeof command } => ({
      command,
      client: { command, pipeline: async () => [], transaction: async () => ["OK", 3, ttl] },
    });

    it.each([[-2], [300], [0]])("TTL %j: nothing extra is sent", async (ttl) => {
      const { client, command } = stub(ttl);
      expect(await createKvCounterStore(client).incr("k", 60)).toBe(3);
      expect(command).not.toHaveBeenCalled();
    });

    it("TTL -1 sends exactly one EXPIRE", async () => {
      const { client, command } = stub(-1);
      await createKvCounterStore(client).incr("k", 60);
      expect(command).toHaveBeenCalledTimes(1);
      expect(command).toHaveBeenCalledWith(["EXPIRE", "k", "60"]);
    });

    it("an EXPIRE failure surfaces as KvError", async () => {
      const { client } = stub(
        -1,
        vi.fn<KvClient["command"]>(async () => {
          throw new KvError("timeout", "kv timeout");
        }),
      );
      await expect(createKvCounterStore(client).incr("k", 60)).rejects.toMatchObject({ name: "KvError", kind: "timeout" });
    });

    it.each([["x"], [null], [1.5], [undefined]])("a bad TTL reply (%j) -> KvError upstream", async (ttl) => {
      await expect(createKvCounterStore(stub(ttl).client).incr("k", 60)).rejects.toMatchObject({ kind: "upstream" });
    });
  });

  it.each([[0], [-1], [1.5], ["3"], [null], [Number.NaN]])(
    "a bad INCR result (%j) -> KvError upstream",
    async (bad) => {
      const client: KvClient = {
        command: async () => null,
        pipeline: async () => [],
        transaction: async () => ["OK", bad, 60],
      };
      await expect(createKvCounterStore(client).incr("k", 60)).rejects.toMatchObject({
        name: "KvError",
        kind: "upstream",
      });
    },
  );

  it("a transaction result that is too short -> KvError upstream", async () => {
    const client: KvClient = { command: async () => null, pipeline: async () => [], transaction: async () => ["OK"] };
    await expect(createKvCounterStore(client).incr("k", 60)).rejects.toBeInstanceOf(KvError);
  });

  it("a KV failure is thrown as KvError (the fallback is a separate wrapper)", async () => {
    const { fake, store } = setup();
    fake.fail({ kind: "http", status: 500 });
    await expect(store.incr("k", 60)).rejects.toBeInstanceOf(KvError);
  });
});

describe("createFallbackCounterStore", () => {
  it("KV HTTP 500 -> memory counter is used and counting continues", async () => {
    quietWarn();
    const { fake, store } = setup();
    fake.fail({ kind: "http", status: 500 });
    const fb = createFallbackCounterStore(store, createMemoryCounterStore());
    expect(await fb.incr("k", 60)).toBe(1);
    expect(await fb.incr("k", 60)).toBe(2);
    expect(await fb.incr("k", 60)).toBe(3);
  });

  it("KV timeout -> memory counter", async () => {
    quietWarn();
    const { fake, store } = setup(20);
    fake.fail({ kind: "hang" });
    const fb = createFallbackCounterStore(store, createMemoryCounterStore());
    expect(await fb.incr("k", 60)).toBe(1);
    expect(await fb.incr("k", 60)).toBe(2);
  });

  it("any error, even a non-KvError, is absorbed", async () => {
    quietWarn();
    const boom: CounterStore = {
      incr: async () => {
        throw new TypeError("anything");
      },
    };
    await expect(createFallbackCounterStore(boom, createMemoryCounterStore()).incr("k", 60)).resolves.toBe(1);
  });

  it("while the primary works, the fallback is not used", async () => {
    const { store } = setup();
    const memory = createMemoryCounterStore();
    const spy = vi.spyOn(memory, "incr");
    const fb = createFallbackCounterStore(store, memory);
    expect(await fb.incr("k", 60)).toBe(1);
    expect(spy).not.toHaveBeenCalled();
  });

  describe("circuit breaker", () => {
    function breaker(timeoutMs?: number) {
      const s = setup(timeoutMs);
      const clock = { t: 0 };
      const fb = createFallbackCounterStore(s.store, createMemoryCounterStore(), { now: () => clock.t });
      return { ...s, fb, clock };
    }

    it("opens on the first failure; while open the primary is not called and memory keeps counting", async () => {
      quietWarn();
      const { fake, fb, clock } = breaker();
      fake.fail({ kind: "http", status: 500 });
      expect(await fb.incr("k", 60)).toBe(1);
      expect(fake.requests).toHaveLength(1);
      expect(await fb.incr("k", 60)).toBe(2);
      clock.t = 29_999;
      expect(await fb.incr("k", 60)).toBe(3);
      expect(fake.requests).toHaveLength(1); // primary skipped
    });

    it("retries after 30 s; a failure re-opens it; a success closes it", async () => {
      quietWarn();
      const { fake, fb, clock } = breaker();
      fake.fail({ kind: "http", status: 500 });
      await fb.incr("k", 60);
      clock.t = 30_000;
      expect(await fb.incr("k", 60)).toBe(2); // retried (request 2), failed, memory
      expect(fake.requests).toHaveLength(2);
      await fb.incr("k", 60); // re-opened: no new request
      expect(fake.requests).toHaveLength(2);

      fake.clearFailure();
      clock.t = 60_000;
      expect(await fb.incr("k", 60)).toBe(1); // KV answered (a fresh KV counter)
      expect(fake.requests).toHaveLength(3);
      expect(await fb.incr("k", 60)).toBe(2); // closed: KV is used every time
      expect(fake.requests).toHaveLength(4);
    });

    it("breakerMs is configurable", async () => {
      quietWarn();
      const { fake, store } = setup();
      const clock = { t: 0 };
      const fb = createFallbackCounterStore(store, createMemoryCounterStore(), { breakerMs: 1000, now: () => clock.t });
      fake.fail({ kind: "http", status: 500 });
      await fb.incr("k", 60);
      clock.t = 999;
      await fb.incr("k", 60);
      expect(fake.requests).toHaveLength(1);
      clock.t = 1000;
      await fb.incr("k", 60);
      expect(fake.requests).toHaveLength(2);
    });

    it("a black-holed primary costs the short timeout once, not on every call", async () => {
      quietWarn();
      const { fake, fb } = breaker(20);
      fake.fail({ kind: "hang" });
      const started = Date.now();
      expect(await fb.incr("k", 60)).toBe(1);
      expect(Date.now() - started).toBeGreaterThanOrEqual(15);
      const second = Date.now();
      for (let i = 2; i <= 6; i++) expect(await fb.incr("k", 60)).toBe(i);
      expect(Date.now() - second).toBeLessThan(15);
      expect(fake.requests).toHaveLength(1);
    });
  });

  describe("throttled warning", () => {
    function withClock(primary: CounterStore) {
      const clock = { t: 0 };
      return { clock, fb: createFallbackCounterStore(primary, createMemoryCounterStore(), { now: () => clock.t }) };
    }
    const failing = (e: unknown): CounterStore => ({
      incr: async () => {
        throw e;
      },
    });

    it.each([
      [new KvError("upstream", "kv http 500"), "upstream"],
      [new KvError("timeout", "kv timeout"), "timeout"],
      [new KvError("config", "invalid"), "config"],
      [new TypeError("whatever"), "unexpected"],
      ["a string", "unexpected"],
    ])("format: %j -> [kv] counter fallback: %s", async (err, kind) => {
      const warn = quietWarn();
      await withClock(failing(err)).fb.incr("k", 60);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(`[kv] counter fallback: ${kind}`);
    });

    it("at most one per 60 s (fake clock), even while failures keep happening", async () => {
      const warn = quietWarn();
      const { fb, clock } = withClock(failing(new KvError("upstream", "x")));
      await fb.incr("k", 60); // t=0: warn
      await fb.incr("k", 60); // breaker open
      clock.t = 30_000;
      await fb.incr("k", 60); // retry fails, within 60 s: no warn
      expect(warn).toHaveBeenCalledTimes(1);
      clock.t = 59_999;
      await fb.incr("k", 60);
      expect(warn).toHaveBeenCalledTimes(1);
      clock.t = 90_000; // breaker retry; 90 s since the first warn
      await fb.incr("k", 60);
      expect(warn).toHaveBeenCalledTimes(2);
    });

    it("never contains the token, URL, key or error text", async () => {
      const warn = quietWarn();
      const { fake, store } = setup();
      fake.fail({ kind: "http", status: 500 });
      await createFallbackCounterStore(store, createMemoryCounterStore()).incr("chat:0123456789abcdef", 60);
      const logged = JSON.stringify(warn.mock.calls);
      for (const s of [fake.token, fake.url, "kv-test", "chat:", "0123456789abcdef", "kv http", "secret-upstream"]) {
        expect(logged).not.toContain(s);
      }
      expect(warn.mock.calls).toEqual([["[kv] counter fallback: upstream"]]);
    });

    it("no warning when the primary succeeds", async () => {
      const warn = quietWarn();
      const { store } = setup();
      await createFallbackCounterStore(store, createMemoryCounterStore()).incr("k", 60);
      expect(warn).not.toHaveBeenCalled();
    });

    it("a throwing console.warn does not change the result", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {
        throw new Error("console is broken");
      });
      const { fb } = withClock(failing(new KvError("upstream", "x")));
      await expect(fb.incr("k", 60)).resolves.toBe(1);
      await expect(fb.incr("k", 60)).resolves.toBe(2);
    });

    it("nothing else is logged", async () => {
      const others = (["log", "info", "error", "debug"] as const).map((m) => vi.spyOn(console, m));
      quietWarn();
      await withClock(failing(new KvError("upstream", "x"))).fb.incr("k", 60);
      for (const s of others) expect(s).not.toHaveBeenCalled();
    });
  });
});

describe("getCounterStore", () => {
  let n = 0;
  // A distinct token per test: the store is a singleton per KV pair.
  const env = (token = `tok-counter-${++n}`) => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://kv-up.invalid");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", token);
  };

  it("not configured: a per-instance memory store that counts, and no warning", async () => {
    const warn = quietWarn();
    const key = `chat:no-kv-${Math.random()}`;
    expect(await getCounterStore().incr(key, 60)).toBe(1);
    expect(await getCounterStore().incr(key, 60)).toBe(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it("configured: uses the KV result", async () => {
    env();
    const f = vi.fn<typeof fetch>(async () => Response.json([{ result: "OK" }, { result: 7 }, { result: 600 }]));
    vi.stubGlobal("fetch", f);
    expect(await getCounterStore().incr("k", 60)).toBe(7);
    expect(f).toHaveBeenCalledTimes(1);
    expect(String(f.mock.calls[0][0])).toBe("https://kv-up.invalid/multi-exec");
  });

  it("is a singleton per KV pair and rebuilt when the pair changes", () => {
    env("tok-single-1");
    const a = getCounterStore();
    expect(getCounterStore()).toBe(a);
    env("tok-single-2");
    expect(getCounterStore()).not.toBe(a);
  });

  it("the breaker state survives between calls: KV down is tried once, then skipped", async () => {
    quietWarn();
    env();
    const f = vi.fn<typeof fetch>(async () => new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", f);
    const key = `chat:kv-down-${Math.random()}`;
    expect(await getCounterStore().incr(key, 60)).toBe(1);
    expect(await getCounterStore().incr(key, 60)).toBe(2);
    expect(await getCounterStore().incr(key, 60)).toBe(3);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("the counter client times out after 800 ms", async () => {
    quietWarn();
    vi.useFakeTimers();
    env();
    vi.stubGlobal("fetch", (...a: unknown[]) =>
      new Promise((_r, reject) =>
        (a[1] as RequestInit).signal?.addEventListener("abort", () => reject(new Error("aborted"))),
      ),
    );
    let result: number | undefined;
    const p = getCounterStore()
      .incr(`chat:slow-${Math.random()}`, 60)
      .then((v) => (result = v));
    await vi.advanceTimersByTimeAsync(799);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(result).toBe(1); // answered by the memory fallback
  });

  it("invalid configuration: memory counter, one warning 'config' per 60 s", async () => {
    const warn = quietWarn();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-01-01T00:00:00Z"));
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://kv-up.invalid"); // token missing
    const key = `chat:invalid-${Math.random()}`;
    expect(await getCounterStore().incr(key, 60)).toBe(1);
    expect(await getCounterStore().incr(key, 60)).toBe(2);
    expect(warn.mock.calls).toEqual([["[kv] counter fallback: config"]]);
    vi.setSystemTime(new Date("2031-01-01T00:01:00Z"));
    await getCounterStore().incr(key, 60);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("kv-up");
  });
});
