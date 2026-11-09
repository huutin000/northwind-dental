import { afterEach, describe, expect, it, vi } from "vitest";
import { sanitizeLead, type Lead } from "@/lib/leads/schema";
import {
  createKvLeadStore,
  createMemoryLeadStore,
  getLeadStore,
  LEAD_TTL_SECONDS,
  type LeadStore,
} from "@/lib/leads/store";
import { createUpstashClient, KvError } from "@/lib/kv/upstash";
import { createFakeUpstash, LEAKY_BODY } from "../helpers/fakeUpstash";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const SID_A = "a".repeat(32);
const SID_B = "0123456789abcdef".repeat(2);
const H = 3600;

const mkLead = (i: number, over: Partial<Lead> = {}): Lead => ({
  id: `lead-${String(i).padStart(4, "0")}`,
  createdAt: new Date(Date.UTC(2026, 10, 9, 0, i)).toISOString(),
  email: `person${i}@example.com`,
  category: "other",
  ...over,
});

type Harness = { store: LeadStore; advance(seconds: number): void };

const memory = (): Harness => {
  vi.useFakeTimers();
  return { store: createMemoryLeadStore(), advance: (s) => vi.advanceTimersByTime(s * 1000) };
};
const kv = (): Harness => {
  const fake = createFakeUpstash();
  const client = createUpstashClient({ url: fake.url, token: fake.token, fetch: fake.fetch });
  return { store: createKvLeadStore(client), advance: (s) => fake.advance(s) };
};

// The same behaviour, run against both implementations.
describe.each([
  ["memory store", memory],
  ["KV store (emulator)", kv],
])("LeadStore behaviour: %s", (_name, make) => {
  it("TTL is 24 hours", () => {
    expect(LEAD_TTL_SECONDS).toBe(86400);
  });

  it("an unknown session -> [] and 0, no error", async () => {
    const { store } = make();
    expect(await store.list(SID_A)).toEqual([]);
    expect(await store.count(SID_A)).toBe(0);
  });

  it("add then list returns the lead, with optional fields intact", async () => {
    const { store } = make();
    const lead = mkLead(1, { name: "Ada", note: "Call after 5", summary: "Asked about booking.", category: "booking" });
    await store.add(SID_A, lead);
    expect(await store.list(SID_A)).toEqual([lead]);
    expect(await store.count(SID_A)).toBe(1);
  });

  it("list is newest first", async () => {
    const { store } = make();
    for (const i of [1, 2, 3]) await store.add(SID_A, mkLead(i));
    expect((await store.list(SID_A)).map((l) => l.id)).toEqual(["lead-0003", "lead-0002", "lead-0001"]);
  });

  it("session isolation: A never sees B's leads", async () => {
    const { store } = make();
    await store.add(SID_A, mkLead(1));
    await store.add(SID_B, mkLead(2));
    await store.add(SID_B, mkLead(3));
    expect((await store.list(SID_A)).map((l) => l.id)).toEqual(["lead-0001"]);
    expect((await store.list(SID_B)).map((l) => l.id)).toEqual(["lead-0003", "lead-0002"]);
    expect(await store.count(SID_A)).toBe(1);
    expect(await store.count(SID_B)).toBe(2);
  });

  it("a lead is listed at 23h59m and gone at 24h; count follows", async () => {
    const { store, advance } = make();
    await store.add(SID_A, mkLead(1));
    advance(24 * H - 60);
    expect(await store.list(SID_A)).toHaveLength(1);
    expect(await store.count(SID_A)).toBe(1);
    advance(60);
    expect(await store.list(SID_A)).toEqual([]);
    expect(await store.count(SID_A)).toBe(0);
  });

  it("each lead has its own 24h clock: the older one expires first", async () => {
    const { store, advance } = make();
    await store.add(SID_A, mkLead(1));
    advance(12 * H);
    await store.add(SID_A, mkLead(2));
    advance(12 * H); // lead 1 is now 24h old, lead 2 is 12h old
    expect((await store.list(SID_A)).map((l) => l.id)).toEqual(["lead-0002"]);
    expect(await store.count(SID_A)).toBe(1);
    advance(12 * H);
    expect(await store.list(SID_A)).toEqual([]);
  });

  it("adding the SAME lead id twice is idempotent: listed and counted once", async () => {
    const { store } = make();
    await store.add(SID_A, mkLead(1));
    await store.add(SID_A, mkLead(2));
    await store.add(SID_A, mkLead(1)); // a retry
    expect(await store.count(SID_A)).toBe(2);
    expect((await store.list(SID_A)).map((l) => l.id)).toEqual(["lead-0001", "lead-0002"]); // the retried one is newest
  });

  it("rejects an invalid lead without storing anything", async () => {
    const { store } = make();
    await expect(store.add(SID_A, mkLead(1, { category: "x" as never }))).rejects.toBeInstanceOf(RangeError);
    expect(await store.count(SID_A)).toBe(0);
  });

  it("a session can add again after everything expired", async () => {
    const { store, advance } = make();
    await store.add(SID_A, mkLead(1));
    advance(24 * H);
    await store.add(SID_A, mkLead(2));
    expect((await store.list(SID_A)).map((l) => l.id)).toEqual(["lead-0002"]);
  });
});

describe("memory lead store: session cap", () => {
  it("evicts the oldest session when the cap is reached", async () => {
    const store = createMemoryLeadStore({ maxSessions: 2 });
    const sid = (c: string) => c.repeat(32);
    await store.add(sid("a"), mkLead(1));
    await store.add(sid("b"), mkLead(2));
    await store.add(sid("c"), mkLead(3));
    expect(await store.list(sid("a"))).toEqual([]); // oldest, evicted
    expect(await store.count(sid("b"))).toBe(1);
    expect(await store.count(sid("c"))).toBe(1);
  });

  it("an existing session can keep adding when the store is full", async () => {
    const store = createMemoryLeadStore({ maxSessions: 1 });
    await store.add(SID_A, mkLead(1));
    await store.add(SID_A, mkLead(2));
    expect(await store.count(SID_A)).toBe(2);
  });

  it("expired sessions are freed before a live one is evicted", async () => {
    vi.useFakeTimers();
    const store = createMemoryLeadStore({ maxSessions: 2 });
    await store.add("a".repeat(32), mkLead(1));
    vi.advanceTimersByTime(24 * H * 1000);
    await store.add("b".repeat(32), mkLead(2));
    await store.add("c".repeat(32), mkLead(3));
    expect(await store.count("b".repeat(32))).toBe(1); // survived: "a" had expired
  });

  it.each([[0], [-1], [1.5], [Number.NaN]])("an invalid cap (%j) -> RangeError", (cap) => {
    expect(() => createMemoryLeadStore({ maxSessions: cap })).toThrow(RangeError);
  });

  it("list returns copies, so callers cannot change stored leads", async () => {
    const store = createMemoryLeadStore();
    await store.add(SID_A, mkLead(1));
    (await store.list(SID_A))[0].email = "changed@example.com";
    expect((await store.list(SID_A))[0].email).toBe("person1@example.com");
  });
});

describe("KV lead store: Redis commands", () => {
  function setup() {
    const fake = createFakeUpstash();
    const client = createUpstashClient({ url: fake.url, token: fake.token, fetch: fake.fetch });
    return { fake, client, store: createKvLeadStore(client) };
  }

  it("add: one multi-exec with SET ... EX 86400, RPUSH, LTRIM (cap 20), EXPIRE on the index", async () => {
    const { fake, store } = setup();
    const lead = mkLead(1, { name: "Ada" });
    await store.add(SID_A, lead);
    expect(fake.requests).toHaveLength(1);
    const r = fake.requests[0];
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/multi-exec");
    expect(r.headers["authorization"]).toBe(`Bearer ${fake.token}`);
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.body).toEqual([
      ["SET", `lead:${SID_A}:lead-0001`, JSON.stringify(lead), "EX", "86400"],
      ["RPUSH", `leads:${SID_A}`, "lead-0001"],
      ["LTRIM", `leads:${SID_A}`, "-20", "-1"],
      ["EXPIRE", `leads:${SID_A}`, "86400"],
    ]);
  });

  it("every lead key carries a real 24h TTL, and so does the index", async () => {
    const { fake, store } = setup();
    await store.add(SID_A, mkLead(1));
    await store.add(SID_A, mkLead(2));
    expect(fake.ttlOf(`lead:${SID_A}:lead-0001`)).toBe(86400);
    expect(fake.ttlOf(`lead:${SID_A}:lead-0002`)).toBe(86400);
    expect(fake.ttlOf(`leads:${SID_A}`)).toBe(86400);
  });

  it("list: LRANGE then one MGET (2 requests); an empty index skips MGET", async () => {
    const { fake, store } = setup();
    await store.list(SID_A);
    expect(fake.requests.map((r) => r.body)).toEqual([["LRANGE", `leads:${SID_A}`, "0", "-1"]]);
    expect(fake.requests[0].path).toBe("/");
    await store.add(SID_A, mkLead(1));
    await store.add(SID_A, mkLead(2));
    fake.requests.length = 0;
    await store.list(SID_A);
    expect(fake.requests).toHaveLength(2);
    expect(fake.requests[1].body).toEqual([
      "MGET",
      `lead:${SID_A}:lead-0001`,
      `lead:${SID_A}:lead-0002`,
    ]);
  });

  it("count uses the same two requests as list", async () => {
    const { fake, store } = setup();
    await store.add(SID_A, mkLead(1));
    fake.requests.length = 0;
    expect(await store.count(SID_A)).toBe(1);
    expect(fake.requests).toHaveLength(2);
  });

  it("list drops index entries whose lead key expired", async () => {
    const { fake, store } = setup();
    await store.add(SID_A, mkLead(1));
    fake.advance(86400 - 10);
    await store.add(SID_A, mkLead(2)); // refreshes the index TTL
    fake.advance(20); // lead 1 is gone, the index still lists it
    expect((await store.list(SID_A)).map((l) => l.id)).toEqual(["lead-0002"]);
  });

  describe("ids are validated before any request", () => {
    const badSessions = ["../x", "a:b", "a".repeat(31), "a".repeat(33), "A".repeat(32), `${"a".repeat(31)} `, "", `${"a".repeat(30)}*1`];

    it.each(badSessions.map((s) => [JSON.stringify(s), s]))("session id %s", async (_l, sid) => {
      const { fake, store } = setup();
      await expect(store.add(sid, mkLead(1))).rejects.toMatchObject({ name: "KvError", kind: "config" });
      await expect(store.list(sid)).rejects.toBeInstanceOf(KvError);
      await expect(store.count(sid)).rejects.toBeInstanceOf(KvError);
      expect(fake.requests).toHaveLength(0);
    });

    it.each(["short", "a:b:c-valid", "../../etc", "has space 1", "x".repeat(65), "bad*id12", ""])(
      "lead id %j",
      async (id) => {
        const { fake, store } = setup();
        await expect(store.add(SID_A, mkLead(1, { id }))).rejects.toBeInstanceOf(RangeError);
        expect(fake.requests).toHaveLength(0);
      },
    );

    it("accepts a UUID-style lead id", async () => {
      const { store } = setup();
      const id = "3b241101-e2bb-4255-8caf-4136c566a962";
      await store.add(SID_A, mkLead(1, { id }));
      expect((await store.list(SID_A))[0].id).toBe(id);
    });

    it("the error message does not echo the id", async () => {
      const { store } = setup();
      const err = await store.list("../SECRET:id").catch((e: Error) => e);
      expect((err as Error).message).not.toContain("SECRET");
    });
  });

  describe("stored data is never trusted", () => {
    it("skips malformed JSON, wrong shapes and a mismatched id; keeps the good ones", async () => {
      const { fake, client, store } = setup();
      await store.add(SID_A, mkLead(1));
      const rows: [string, string][] = [
        ["lead-bad-json", "{not json"],
        ["lead-not-obj", "[1,2]"],
        ["lead-no-mail", JSON.stringify({ id: "lead-no-mail", createdAt: "x", category: "other" })],
        ["lead-bad-cat", JSON.stringify({ ...mkLead(9), id: "lead-bad-cat", category: "hacker" })],
        ["lead-bad-name", JSON.stringify({ ...mkLead(9), id: "lead-bad-name", name: 5 })],
        ["lead-wrong-id", JSON.stringify(mkLead(8))], // JSON id differs from the key id
      ];
      for (const [id, json] of rows) {
        fake.seed(`lead:${SID_A}:${id}`, json, 60);
        await client.command(["RPUSH", `leads:${SID_A}`, id]);
      }
      await store.add(SID_A, mkLead(2));
      expect((await store.list(SID_A)).map((l) => l.id)).toEqual(["lead-0002", "lead-0001"]);
      expect(await store.count(SID_A)).toBe(2);
    });

    it("an invalid id in the index is skipped and never used to build a key", async () => {
      const { fake, client, store } = setup();
      await store.add(SID_A, mkLead(1));
      await client.command(["RPUSH", `leads:${SID_A}`, `../other:${SID_B}:lead-0002`]);
      fake.requests.length = 0;
      expect((await store.list(SID_A)).map((l) => l.id)).toEqual(["lead-0001"]);
      const mget = fake.requests[1].body as string[];
      expect(mget).toEqual(["MGET", `lead:${SID_A}:lead-0001`]);
    });
  });

  describe("failures surface as KvError without leaking", () => {
    it.each([
      ["HTTP 500", { kind: "http", status: 500 }],
      ["{error} reply", { kind: "error-reply", message: "ERR detail" }],
      ["invalid JSON", { kind: "invalid-json" }],
      ["network error", { kind: "network" }],
    ] as const)("add, list and count: %s", async (_l, failure) => {
      const { fake, store } = setup();
      fake.fail(failure);
      const lead = mkLead(1, { email: "leak-me@example.com", name: "LeakName", note: "LeakNote" });
      const errs = [
        await store.add(SID_A, lead).catch((e: Error) => e),
        await store.list(SID_A).catch((e: Error) => e),
        await store.count(SID_A).catch((e: Error) => e),
      ];
      for (const e of errs) {
        expect(e).toBeInstanceOf(KvError);
        const m = (e as Error).message;
        for (const s of ["leak-me", "LeakName", "LeakNote", fake.token, fake.url, "kv-test", LEAKY_BODY, SID_A, "detail"]) {
          expect(m).not.toContain(s);
        }
      }
    });

    it("add: a partial transaction reply -> KvError", async () => {
      const { fake, store } = setup();
      fake.fail({ kind: "short" });
      await expect(store.add(SID_A, mkLead(1))).rejects.toBeInstanceOf(KvError);
    });

    it("timeout", async () => {
      const fake = createFakeUpstash();
      const client = createUpstashClient({ url: fake.url, token: fake.token, fetch: fake.fetch, timeoutMs: 20 });
      fake.fail({ kind: "hang" });
      await expect(createKvLeadStore(client).add(SID_A, mkLead(1))).rejects.toMatchObject({ kind: "timeout" });
    });

    it("a wrong token fails", async () => {
      const fake = createFakeUpstash();
      const client = createUpstashClient({ url: fake.url, token: "nope", fetch: fake.fetch });
      await expect(createKvLeadStore(client).list(SID_A)).rejects.toBeInstanceOf(KvError);
    });

    it("an MGET answer of the wrong shape -> KvError", async () => {
      const client = {
        command: async (args: (string | number)[]) => (args[0] === "LRANGE" ? ["lead-0001"] : "not-an-array"),
        pipeline: async () => [],
        transaction: async () => [],
      };
      await expect(createKvLeadStore(client).list(SID_A)).rejects.toBeInstanceOf(KvError);
    });
  });
});

describe("KV lead store: index cap, duplicates, retries", () => {
  function setup() {
    const fake = createFakeUpstash();
    const client = createUpstashClient({ url: fake.url, token: fake.token, fetch: fake.fetch });
    return { fake, client, store: createKvLeadStore(client) };
  }

  it("LTRIM keeps only the last 20 ids; list shows the newest 20", async () => {
    const { client, store } = setup();
    for (let i = 1; i <= 25; i++) await store.add(SID_A, mkLead(i));
    const index = (await client.command(["LRANGE", `leads:${SID_A}`, "0", "-1"])) as string[];
    expect(index).toHaveLength(20);
    const listed = (await store.list(SID_A)).map((l) => l.id);
    expect(listed).toHaveLength(20);
    expect(listed[0]).toBe("lead-0025");
    expect(listed[19]).toBe("lead-0006");
  });

  it("duplicate ids in the index never appear twice; newest position wins", async () => {
    const { fake, client, store } = setup();
    await store.add(SID_A, mkLead(1));
    await store.add(SID_A, mkLead(2));
    await client.command(["RPUSH", `leads:${SID_A}`, "lead-0001"]); // duplicate of the oldest
    fake.requests.length = 0;
    expect((await store.list(SID_A)).map((l) => l.id)).toEqual(["lead-0001", "lead-0002"]);
    expect(fake.requests[1].body).toEqual(["MGET", `lead:${SID_A}:lead-0002`, `lead:${SID_A}:lead-0001`]);
    expect(await store.count(SID_A)).toBe(2);
  });

  it("retry after a timeout (the first add DID reach the server) leaves count 1", async () => {
    const fake = createFakeUpstash();
    let first = true;
    const flaky: typeof fetch = async (input, init) => {
      const res = await fake.fetch(input, init); // the server executes the request
      if (!first) return res;
      first = false;
      // ...but the client never sees the answer and times out.
      return new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
      );
    };
    const client = createUpstashClient({ url: fake.url, token: fake.token, fetch: flaky, timeoutMs: 20 });
    const store = createKvLeadStore(client);
    await expect(store.add(SID_A, mkLead(1))).rejects.toMatchObject({ kind: "timeout" });
    await store.add(SID_A, mkLead(1)); // the visitor retries
    expect(await store.count(SID_A)).toBe(1);
    expect((await store.list(SID_A)).map((l) => l.id)).toEqual(["lead-0001"]);
  });
});

describe("sanitizeLead and write validation", () => {
  const valid = () => ({ ...mkLead(1), name: "Ada", note: "Note", summary: "Sum" });
  const reject = (over: Record<string, unknown>) =>
    expect(() => sanitizeLead({ ...valid(), ...over })).toThrow(RangeError);

  it("returns a NEW object with only the known fields, in a fixed order", () => {
    const input = { ...valid(), extra: "x", nested: { a: 1 } };
    const out = sanitizeLead(input);
    expect(out).not.toBe(input);
    expect(Object.keys(out)).toEqual(["id", "createdAt", "email", "category", "name", "note", "summary"]);
    expect(Object.keys(sanitizeLead(mkLead(1)))).toEqual(["id", "createdAt", "email", "category"]);
  });

  it("bounds: email 254/255, name 80/81, note 500/501, summary 400/401", () => {
    const ok = (o: Record<string, unknown>) => expect(() => sanitizeLead({ ...valid(), ...o })).not.toThrow();
    ok({ email: "e".repeat(254) });
    reject({ email: "e".repeat(255) });
    ok({ name: "n".repeat(80) });
    reject({ name: "n".repeat(81) });
    ok({ note: "x".repeat(500) });
    reject({ note: "x".repeat(501) });
    ok({ summary: "s".repeat(400) });
    reject({ summary: "s".repeat(401) });
  });

  it("types: non-string id (checked before the regex), email, createdAt, name, note, summary", () => {
    reject({ id: 12345678 });
    reject({ id: "short" });
    reject({ id: "bad id with spaces" });
    reject({ email: 5 });
    reject({ createdAt: 1700000000000 });
    reject({ name: 5 });
    reject({ note: null });
    reject({ summary: ["x"] });
  });

  it("category must be exactly booking | pricing | other", () => {
    for (const c of ["booking", "pricing", "other"]) expect(sanitizeLead({ ...valid(), category: c }).category).toBe(c);
    reject({ category: "Booking" });
    reject({ category: "hacker" });
    reject({ category: undefined });
  });

  it("createdAt must parse to a valid date", () => {
    reject({ createdAt: "not a date" });
    reject({ createdAt: "" });
  });

  it("the JSON is capped at 4096 UTF-8 bytes (escapes and multi-byte characters count)", () => {
    // Control characters are 1 character each but 6 bytes in JSON ("\u0001"): within every
    // per-field length limit, yet over the byte cap together.
    reject({ note: "\u0001".repeat(500), summary: "\u0001".repeat(400) });
    // Multi-byte characters stay inside the cap at the per-field limits (3 bytes each).
    expect(() =>
      sanitizeLead({ ...valid(), name: "€".repeat(80), note: "€".repeat(500), summary: "€".repeat(400) }),
    ).not.toThrow();
  });

  it("huge or nested values are rejected", () => {
    reject({ name: { a: 1 } });
    reject({ note: "x".repeat(1_000_000) });
    reject({ summary: { toString: () => "x" } });
  });

  it.each([[null], ["lead"], [42], [[]], [undefined]])("a non-object (%j) is rejected", (v) => {
    expect(() => sanitizeLead(v)).toThrow(RangeError);
  });

  it("__proto__ and constructor keys are dropped and nothing is polluted", () => {
    const evil = JSON.parse(
      `{"id":"lead-0001","createdAt":"2026-01-01T00:00:00Z","email":"a@b.co","category":"other","__proto__":{"polluted":true},"constructor":{"x":1}}`,
    );
    const out = sanitizeLead(evil);
    expect(Object.keys(out)).toEqual(["id", "createdAt", "email", "category"]);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(JSON.stringify(out)).not.toMatch(/polluted|constructor|__proto__/);
  });

  it("the error message is fixed and never echoes the data", () => {
    try {
      sanitizeLead({ ...valid(), email: "SECRET@example.com", note: "S".repeat(600) });
      throw new Error("expected a RangeError");
    } catch (e) {
      expect(e).toBeInstanceOf(RangeError);
      expect((e as Error).message).not.toMatch(/SECRET|Ada|lead-0001/);
    }
  });

  it("KV: the stored JSON holds only the known fields; an invalid lead sends no request", async () => {
    const fake = createFakeUpstash();
    const client = createUpstashClient({ url: fake.url, token: fake.token, fetch: fake.fetch });
    const store = createKvLeadStore(client);
    await store.add(SID_A, { ...valid(), extra: "x", __admin: true } as Lead);
    const setCmd = (fake.requests[0].body as string[][])[0];
    expect(Object.keys(JSON.parse(setCmd[2]))).toEqual([
      "id",
      "createdAt",
      "email",
      "category",
      "name",
      "note",
      "summary",
    ]);
    fake.requests.length = 0;
    await expect(store.add(SID_A, { ...valid(), summary: "s".repeat(401) })).rejects.toBeInstanceOf(RangeError);
    expect(fake.requests).toHaveLength(0);
  });

  it("memory: extra fields are not stored", async () => {
    const store = createMemoryLeadStore();
    await store.add(SID_A, { ...valid(), extra: "x" } as Lead);
    expect(Object.keys((await store.list(SID_A))[0])).not.toContain("extra");
  });
});

describe("getLeadStore", () => {
  it("not configured: a shared memory store", async () => {
    const sid = Math.random().toString(16).slice(2).padEnd(32, "0").slice(0, 32);
    await getLeadStore().add(sid, mkLead(1));
    expect(await getLeadStore().count(sid)).toBe(1);
  });

  it("configured: talks to the KV store (and its failures are thrown)", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://kv-up.invalid");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    const f = vi.fn<typeof fetch>(async () => new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", f);
    await expect(getLeadStore().add(SID_A, mkLead(1))).rejects.toBeInstanceOf(KvError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("configured: the lead client keeps the default 3000 ms timeout (not the counter's 800)", async () => {
    vi.useFakeTimers();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://kv-up.invalid");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    vi.stubGlobal(
      "fetch",
      (...a: unknown[]) =>
        new Promise((_r, reject) =>
          (a[1] as RequestInit).signal?.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    const p = expect(getLeadStore().list(SID_A)).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(2999);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await p;
  });

  it.each([
    ["half pair", { UPSTASH_REDIS_REST_URL: "https://kv-up.invalid" }],
    ["http URL", { KV_REST_API_URL: "http://kv-up.invalid", KV_REST_API_TOKEN: "t" }],
  ])("invalid configuration (%s): add, list and count reject with KvError config", async (_l, env) => {
    Object.entries(env).forEach(([k, v]) => vi.stubEnv(k, v));
    const f = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", f);
    const store = getLeadStore();
    for (const call of [() => store.add(SID_A, mkLead(1)), () => store.list(SID_A), () => store.count(SID_A)]) {
      await expect(call()).rejects.toMatchObject({ name: "KvError", kind: "config", message: "kv misconfigured" });
    }
    expect(f).not.toHaveBeenCalled();
  });
});
