// Test helper (no tests inside): an in-memory emulator of the Upstash REST API
// as a fake `fetch`. Supports POST /, /pipeline and /multi-exec and the
// commands this project uses. It has its own virtual clock for key expiry,
// checks the bearer token, can be told to fail in several ways, and records
// every request so tests can assert exact shapes. It never touches the network.

export type RecordedRequest = {
  method: string;
  href: string;
  path: string;
  headers: Record<string, string>; // lower-case names
  body: unknown; // parsed JSON body
};

export type Failure =
  | { kind: "http"; status: number } // non-2xx with a body that must never leak
  | { kind: "error-reply"; message: string } // 200 with {"error": ...} (last item in a pipeline)
  | { kind: "hang" } // never answers until the request is aborted
  | { kind: "invalid-json" } // 200 with a body that is not JSON
  | { kind: "network" } // fetch itself rejects
  | { kind: "short" }; // pipeline answers with one result too few

export const LEAKY_BODY = "secret-upstream-body-text";

type Entry = { value: string | string[]; expiresAt: number | null };

class CommandError extends Error {}

export function createFakeUpstash(opts: { url?: string; token?: string } = {}) {
  const url = opts.url ?? "https://kv-test.invalid";
  const token = opts.token ?? "fake-token-abc123";
  let nowMs = 1_700_000_000_000; // virtual clock
  const data = new Map<string, Entry>();
  const requests: RecordedRequest[] = [];
  let failure: { f: Failure; remaining: number } | null = null;

  const live = (key: string): Entry | undefined => {
    const e = data.get(key);
    if (e && e.expiresAt !== null && e.expiresAt <= nowMs) {
      data.delete(key);
      return undefined;
    }
    return e;
  };

  const str = (key: string): string | null => {
    const e = live(key);
    if (!e) return null;
    if (typeof e.value !== "string") throw new CommandError("WRONGTYPE");
    return e.value;
  };

  function exec(cmd: unknown): unknown {
    if (!Array.isArray(cmd) || cmd.length === 0) throw new CommandError("ERR empty command");
    const [name, ...a] = cmd.map((x) => (typeof x === "number" ? String(x) : x)) as string[];
    switch (name.toUpperCase()) {
      case "SET": {
        let ex: number | null = null;
        let nx = false;
        for (let i = 2; i < a.length; i++) {
          const o = a[i].toUpperCase();
          if (o === "EX") ex = Number(a[++i]);
          else if (o === "NX") nx = true;
          else throw new CommandError("ERR syntax error");
        }
        if (nx && live(a[0])) return null;
        data.set(a[0], { value: a[1], expiresAt: ex === null ? null : nowMs + ex * 1000 });
        return "OK";
      }
      case "GET":
        return str(a[0]);
      case "MGET":
        return a.map((k) => {
          const e = live(k);
          return e && typeof e.value === "string" ? e.value : null;
        });
      case "RPUSH": {
        let e = live(a[0]);
        if (!e) data.set(a[0], (e = { value: [], expiresAt: null }));
        if (typeof e.value === "string") throw new CommandError("WRONGTYPE");
        e.value.push(...a.slice(1));
        return e.value.length;
      }
      case "LRANGE": {
        const e = live(a[0]);
        if (!e) return [];
        if (typeof e.value === "string") throw new CommandError("WRONGTYPE");
        const len = e.value.length;
        let s = Number(a[1]);
        let t = Number(a[2]);
        if (s < 0) s = Math.max(0, len + s);
        if (t < 0) t = len + t;
        return e.value.slice(s, t + 1);
      }
      case "EXPIRE": {
        const e = live(a[0]);
        if (!e) return 0;
        e.expiresAt = nowMs + Number(a[1]) * 1000;
        return 1;
      }
      case "INCR": {
        const e = live(a[0]);
        const cur = e ? Number(e.value) : 0;
        if (!Number.isInteger(cur)) throw new CommandError("ERR value is not an integer");
        data.set(a[0], { value: String(cur + 1), expiresAt: e ? e.expiresAt : null });
        return cur + 1;
      }
      case "DEL":
        return a.filter((k) => live(k) && data.delete(k)).length;
      case "LTRIM": {
        // Keep only elements start..stop (Redis semantics); an empty result deletes the key.
        const e = live(a[0]);
        if (!e) return "OK";
        if (typeof e.value === "string") throw new CommandError("WRONGTYPE");
        const len = e.value.length;
        let s = Number(a[1]);
        let t = Number(a[2]);
        if (s < 0) s = Math.max(0, len + s);
        if (t < 0) t = len + t;
        e.value = e.value.slice(s, t + 1);
        if (e.value.length === 0) data.delete(a[0]);
        return "OK";
      }
      case "PERSIST": {
        const e = live(a[0]);
        if (!e || e.expiresAt === null) return 0;
        e.expiresAt = null;
        return 1;
      }
      case "TTL": {
        const e = live(a[0]);
        if (!e) return -2;
        return e.expiresAt === null ? -1 : Math.ceil((e.expiresAt - nowMs) / 1000);
      }
      default:
        throw new CommandError("ERR unknown command");
    }
  }

  const reply = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

  const fakeFetch: typeof fetch = async (input, init) => {
    const href = String(input);
    const path = new URL(href).pathname;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    let body: unknown;
    try {
      body = JSON.parse(String(init?.body));
    } catch {
      body = undefined;
    }
    requests.push({ method: init?.method ?? "GET", href, path, headers, body });

    // Forced failure (consumed one request at a time).
    let f: Failure | null = null;
    if (failure && failure.remaining > 0) {
      failure.remaining -= 1;
      f = failure.f;
    }
    if (f?.kind === "network") throw new TypeError("fetch failed");
    if (f?.kind === "hang") {
      return new Promise<Response>((_, reject) => {
        const abort = () => reject(new DOMException("aborted", "AbortError"));
        if (init?.signal?.aborted) abort();
        init?.signal?.addEventListener("abort", abort);
      });
    }
    if (f?.kind === "http") return reply({ error: LEAKY_BODY }, f.status);
    if (f?.kind === "invalid-json") return new Response(`<html>${LEAKY_BODY}</html>`, { status: 200 });

    if (headers["authorization"] !== `Bearer ${token}`) return reply({ error: "Unauthorized" }, 401);

    if (path === "/" || path === "") {
      if (f?.kind === "error-reply") return reply({ error: f.message });
      try {
        return reply({ result: exec(body) });
      } catch (e) {
        return reply({ error: (e as Error).message }, 400);
      }
    }
    if (path === "/pipeline" || path === "/multi-exec") {
      if (!Array.isArray(body)) return reply({ error: "ERR bad body" }, 400);
      // Both run synchronously, so the whole batch is atomic here.
      const out: unknown[] = body.map((c) => {
        try {
          return { result: exec(c) };
        } catch (e) {
          return { error: (e as Error).message };
        }
      });
      if (f?.kind === "error-reply") out[out.length - 1] = { error: f.message };
      if (f?.kind === "short") out.pop();
      return reply(out);
    }
    return reply({ error: "not found" }, 404);
  };

  return {
    url,
    token,
    fetch: fakeFetch,
    requests,
    /** Move the virtual clock forward. */
    advance(seconds: number) {
      nowMs += seconds * 1000;
    },
    /** Fail the next `times` requests (default: all of them) until `clearFailure()`. */
    fail(f: Failure, times = Number.POSITIVE_INFINITY) {
      failure = { f, remaining: times };
    },
    clearFailure() {
      failure = null;
    },
    /** Seconds left on a key (-1 no TTL, -2 missing), straight from the emulator. */
    ttlOf: (key: string) => exec(["TTL", key]) as number,
    keys: () => [...data.keys()].filter((k) => live(k)),
    /** Seed or overwrite a string key directly (for malformed-data tests). */
    seed(key: string, value: string, ttlSeconds?: number) {
      data.set(key, { value, expiresAt: ttlSeconds === undefined ? null : nowMs + ttlSeconds * 1000 });
    },
  };
}
