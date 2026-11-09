import { afterEach, describe, expect, it, vi } from "vitest";
import { createUpstashClient, getKvClient, getKvStatus, KvError } from "@/lib/kv/upstash";
import { createFakeUpstash, LEAKY_BODY } from "../helpers/fakeUpstash";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function setup(timeoutMs?: number) {
  const fake = createFakeUpstash();
  const client = createUpstashClient({ url: fake.url, token: fake.token, fetch: fake.fetch, timeoutMs });
  return { fake, client };
}

describe("createUpstashClient: request shapes", () => {
  it("command: POST to the base URL with a JSON array body and bearer token", async () => {
    const { fake, client } = setup();
    expect(await client.command(["SET", "k", "v", "EX", 60])).toBe("OK");
    expect(await client.command(["GET", "k"])).toBe("v");
    const r = fake.requests[0];
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/");
    expect(r.headers["authorization"]).toBe(`Bearer ${fake.token}`);
    expect(r.headers["content-type"]).toBe("application/json");
    expect(r.body).toEqual(["SET", "k", "v", "EX", 60]);
  });

  it("pipeline: POST /pipeline, results in command order", async () => {
    const { fake, client } = setup();
    expect(await client.pipeline([["SET", "a", "1"], ["GET", "a"]])).toEqual(["OK", "1"]);
    expect(fake.requests[0].path).toBe("/pipeline");
    expect(fake.requests[0].body).toEqual([["SET", "a", "1"], ["GET", "a"]]);
  });

  it("transaction: POST /multi-exec", async () => {
    const { fake, client } = setup();
    expect(await client.transaction([["INCR", "n"], ["INCR", "n"]])).toEqual([1, 2]);
    expect(fake.requests[0].path).toBe("/multi-exec");
    expect(fake.requests[0].method).toBe("POST");
  });

  it("a trailing slash on the URL does not double the slash", async () => {
    const fake = createFakeUpstash();
    const client = createUpstashClient({ url: `${fake.url}/`, token: fake.token, fetch: fake.fetch });
    await client.pipeline([["GET", "a"]]);
    expect(fake.requests[0].path).toBe("/pipeline");
  });
});

describe("createUpstashClient: failures map to KvError without leaking", () => {
  const secretArg = "lead-data-ada@example.com";

  async function failure(fn: () => Promise<unknown>): Promise<KvError> {
    try {
      await fn();
    } catch (e) {
      return e as KvError;
    }
    throw new Error("expected a rejection");
  }

  function expectClean(err: KvError, fake: ReturnType<typeof createFakeUpstash>) {
    expect(err).toBeInstanceOf(KvError);
    expect(err).toBeInstanceOf(Error);
    for (const secret of [fake.token, fake.url, "kv-test", LEAKY_BODY, secretArg, "boom-detail"]) {
      expect(err.message).not.toContain(secret);
    }
  }

  it("HTTP 500 -> upstream 'kv http 500'", async () => {
    const { fake, client } = setup();
    fake.fail({ kind: "http", status: 500 });
    const err = await failure(() => client.command(["SET", "k", secretArg]));
    expect(err.kind).toBe("upstream");
    expect(err.message).toBe("kv http 500");
    expectClean(err, fake);
  });

  it("wrong token (401) -> upstream", async () => {
    const fake = createFakeUpstash();
    const client = createUpstashClient({ url: fake.url, token: "wrong", fetch: fake.fetch });
    const err = await failure(() => client.command(["GET", "k"]));
    expect(err.kind).toBe("upstream");
    expect(err.message).toBe("kv http 401");
    expect(err.message).not.toContain("wrong");
  });

  it("timeout -> kind timeout", async () => {
    const { fake, client } = setup(20);
    fake.fail({ kind: "hang" });
    const err = await failure(() => client.command(["SET", "k", secretArg]));
    expect(err.kind).toBe("timeout");
    expect(err.message).toBe("kv timeout");
    expectClean(err, fake);
  });

  it("{error} reply to a command -> upstream 'kv error reply'", async () => {
    const { fake, client } = setup();
    fake.fail({ kind: "error-reply", message: "ERR boom-detail" });
    const err = await failure(() => client.command(["GET", "k"]));
    expect(err.kind).toBe("upstream");
    expect(err.message).toBe("kv error reply");
    expectClean(err, fake);
  });

  it("{error} inside a pipeline or transaction array -> upstream", async () => {
    const { fake, client } = setup();
    fake.fail({ kind: "error-reply", message: "ERR boom-detail" });
    const e1 = await failure(() => client.pipeline([["GET", "a"], ["GET", "b"]]));
    const e2 = await failure(() => client.transaction([["GET", "a"], ["GET", "b"]]));
    for (const e of [e1, e2]) {
      expect(e.kind).toBe("upstream");
      expect(e.message).toBe("kv error reply");
      expectClean(e, fake);
    }
  });

  it("a pipeline answer with the wrong number of results -> upstream", async () => {
    const { fake, client } = setup();
    fake.fail({ kind: "short" });
    const err = await failure(() => client.pipeline([["GET", "a"], ["GET", "b"]]));
    expect(err.kind).toBe("upstream");
  });

  it("invalid JSON -> upstream, body not in the message", async () => {
    const { fake, client } = setup();
    fake.fail({ kind: "invalid-json" });
    const err = await failure(() => client.command(["GET", "k"]));
    expect(err.kind).toBe("upstream");
    expectClean(err, fake);
  });

  it("network error -> upstream", async () => {
    const { fake, client } = setup();
    fake.fail({ kind: "network" });
    const err = await failure(() => client.command(["GET", "k"]));
    expect(err.kind).toBe("upstream");
    expectClean(err, fake);
  });

  it("an unexpected reply shape (not an object) -> upstream", async () => {
    const client = createUpstashClient({
      url: "https://kv-x.invalid",
      token: "t",
      fetch: async () => Response.json(42),
    });
    expect((await failure(() => client.command(["GET", "k"]))).kind).toBe("upstream");
  });
});

describe("createUpstashClient: timeout and timer", () => {
  it("default timeout is 3000 ms", async () => {
    vi.useFakeTimers();
    const { fake, client } = setup();
    fake.fail({ kind: "hang" });
    const p = expect(client.command(["GET", "k"])).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(2999);
    expect(vi.getTimerCount()).toBe(1); // still waiting
    await vi.advanceTimersByTimeAsync(1);
    await p;
  });

  it("the timer is cleared after success and after failure", async () => {
    vi.useFakeTimers();
    const { fake, client } = setup();
    await client.command(["GET", "k"]);
    expect(vi.getTimerCount()).toBe(0);
    fake.fail({ kind: "http", status: 500 });
    await expect(client.command(["GET", "k"])).rejects.toBeInstanceOf(KvError);
    expect(vi.getTimerCount()).toBe(0);
  });
});


// Changed from the first version: "an http:// URL in the first pair -> null" and
// "half pair" tests now follow the new rule (scan both pairs, use the FIRST pair
// that is complete AND https); whitespace-only values and getKvStatus are new.
describe("getKvStatus / getKvClient: environment selection (read at call time)", () => {
  const UP = { UPSTASH_REDIS_REST_URL: "https://kv-up.invalid", UPSTASH_REDIS_REST_TOKEN: "tok-up" };
  const KV = { KV_REST_API_URL: "https://kv-alt.invalid", KV_REST_API_TOKEN: "tok-kv" };
  const set = (o: Record<string, string>) => Object.entries(o).forEach(([k, v]) => vi.stubEnv(k, v));

  function stubFetch() {
    const f = vi.fn<typeof fetch>(async () => Response.json({ result: "OK" }));
    vi.stubGlobal("fetch", f);
    return f;
  }

  // Which pair does the client from getKvStatus() talk to?
  async function used(): Promise<{ href: string; auth: string } | string> {
    const f = stubFetch();
    const status = getKvStatus();
    if (status.state !== "ok") return status.state;
    await status.client.command(["GET", "k"]);
    const [href, init] = f.mock.calls[0];
    return { href: String(href), auth: new Headers(init?.headers).get("authorization")! };
  }

  it("nothing set (the test setup removed them) -> none, getKvClient null", () => {
    expect(getKvStatus()).toEqual({ state: "none" });
    expect(getKvClient()).toBeNull();
  });

  it("UPSTASH pair alone -> ok", async () => {
    set(UP);
    expect(await used()).toEqual({ href: "https://kv-up.invalid", auth: "Bearer tok-up" });
  });

  it("KV_REST_API pair alone -> ok", async () => {
    set(KV);
    expect(await used()).toEqual({ href: "https://kv-alt.invalid", auth: "Bearer tok-kv" });
  });

  it("both pairs set -> UPSTASH wins", async () => {
    set(UP);
    set(KV);
    expect(await used()).toMatchObject({ href: "https://kv-up.invalid" });
  });

  it("half pairs -> invalid (and never mixed across pairs)", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://kv-up.invalid");
    expect(getKvStatus()).toEqual({ state: "invalid" });
    expect(getKvClient()).toBeNull();
    vi.stubEnv("KV_REST_API_TOKEN", "tok-kv"); // URL from one pair, token from the other
    expect(getKvStatus()).toEqual({ state: "invalid" });
  });

  it("a URL with an empty token -> invalid", () => {
    set({ UPSTASH_REDIS_REST_URL: "https://kv-up.invalid", UPSTASH_REDIS_REST_TOKEN: "" });
    expect(getKvStatus()).toEqual({ state: "invalid" });
  });

  it("half UPSTASH pair falls through to a complete KV pair", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://kv-up.invalid");
    set(KV);
    expect(await used()).toMatchObject({ href: "https://kv-alt.invalid" });
  });

  it("an http:// URL alone -> invalid", () => {
    set({ UPSTASH_REDIS_REST_URL: "http://kv-up.invalid", UPSTASH_REDIS_REST_TOKEN: "t" });
    expect(getKvStatus()).toEqual({ state: "invalid" });
    expect(getKvClient()).toBeNull();
  });

  it("an http:// URL in the first pair with a valid second pair -> the second pair", async () => {
    set({ UPSTASH_REDIS_REST_URL: "http://kv-up.invalid", UPSTASH_REDIS_REST_TOKEN: "t" });
    set(KV);
    expect(await used()).toMatchObject({ href: "https://kv-alt.invalid", auth: "Bearer tok-kv" });
  });

  it("all four set but empty strings -> none", () => {
    set({ UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "", KV_REST_API_URL: "", KV_REST_API_TOKEN: "" });
    expect(getKvStatus()).toEqual({ state: "none" });
  });

  it("whitespace-only values count as empty: none when all blank, invalid when mixed with a real value", () => {
    set({ UPSTASH_REDIS_REST_URL: "   ", UPSTASH_REDIS_REST_TOKEN: " \t " });
    expect(getKvStatus()).toEqual({ state: "none" });
    vi.stubEnv("KV_REST_API_URL", "https://kv-alt.invalid");
    vi.stubEnv("KV_REST_API_TOKEN", "  ");
    expect(getKvStatus()).toEqual({ state: "invalid" });
  });

  it("a trailing slash is normalised", async () => {
    set({ UPSTASH_REDIS_REST_URL: "https://kv-up.invalid/", UPSTASH_REDIS_REST_TOKEN: "t" });
    expect(await used()).toMatchObject({ href: "https://kv-up.invalid" });
  });

  it("is read at call time, not at import time", () => {
    expect(getKvStatus().state).toBe("none");
    set(UP);
    expect(getKvStatus().state).toBe("ok");
    vi.unstubAllEnvs();
    expect(getKvStatus().state).toBe("none");
  });

  it("getKvClient({ timeoutMs }) sets the client timeout", async () => {
    set(UP);
    vi.stubGlobal("fetch", (...a: unknown[]) =>
      new Promise((_r, reject) =>
        (a[1] as RequestInit).signal?.addEventListener("abort", () => reject(new Error("aborted"))),
      ),
    );
    await expect(getKvClient({ timeoutMs: 20 })!.command(["GET", "k"])).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("test setup", () => {
  it("the key-value variables are stripped, so npm test cannot reach a real database", () => {
    for (const n of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) {
      expect(process.env[n]).toBeUndefined();
    }
    expect(getKvClient()).toBeNull();
  });
});
