// Minimal Upstash Redis REST client over plain `fetch` (no dependency).
//
// Wire format (official docs): POST to the base URL with a JSON array body
// such as ["SET","k","v","EX",60]; POST <base>/pipeline and <base>/multi-exec take
// an array of such arrays (multi-exec is atomic, pipeline is not). A success is
// {"result": ...}, a failure is {"error": "..."}; batch calls return an array of those.
//
// Errors are always `KvError` with a short FIXED message. The URL, token, request
// values, response body and the Redis error text never appear in a message.

export class KvError extends Error {
  constructor(
    public kind: "config" | "timeout" | "upstream",
    message: string,
  ) {
    super(message);
    this.name = "KvError";
    Object.setPrototypeOf(this, KvError.prototype);
  }
}

export type KvArg = string | number;

export type KvClient = {
  /** One command. Resolves to its result. */
  command(args: KvArg[]): Promise<unknown>;
  /** Several commands in one request, NOT atomic. Results in command order. */
  pipeline(commands: KvArg[][]): Promise<unknown[]>;
  /** Several commands in one request, atomic (MULTI/EXEC). Results in command order. */
  transaction(commands: KvArg[][]): Promise<unknown[]>;
};

const DEFAULT_TIMEOUT_MS = 3000;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// One reply item is {"result": x} or {"error": "..."}.
function unwrap(item: unknown): unknown {
  if (!isObject(item) || "error" in item || !("result" in item)) {
    throw new KvError("upstream", "kv error reply");
  }
  return item.result;
}

export function createUpstashClient(opts: {
  url: string;
  token: string;
  timeoutMs?: number;
  /** Test seam. Defaults to the global `fetch`, looked up at call time. */
  fetch?: typeof fetch;
}): KvClient {
  const base = opts.url.replace(/\/+$/, "");
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch: typeof fetch = opts.fetch ?? ((input, init) => globalThis.fetch(input, init));

  // POST `body` to base + path and return the parsed JSON reply.
  async function send(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(base + path, {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new KvError("upstream", `kv http ${res.status}`);
      try {
        return await res.json();
      } catch {
        if (controller.signal.aborted) throw new KvError("timeout", "kv timeout");
        throw new KvError("upstream", "kv invalid response");
      }
    } catch (e) {
      if (controller.signal.aborted) throw new KvError("timeout", "kv timeout");
      if (e instanceof KvError) throw e;
      throw new KvError("upstream", "kv network error");
    } finally {
      clearTimeout(timer); // always, so no timer outlives the request
    }
  }

  async function batch(path: string, commands: KvArg[][]): Promise<unknown[]> {
    const reply = await send(path, commands);
    if (!Array.isArray(reply) || reply.length !== commands.length) {
      throw new KvError("upstream", "kv bad reply");
    }
    return reply.map(unwrap);
  }

  return {
    async command(args) {
      return unwrap(await send("", args));
    },
    pipeline: (commands) => batch("/pipeline", commands),
    transaction: (commands) => batch("/multi-exec", commands),
  };
}

export type KvStatus = { state: "none" } | { state: "ok"; client: KvClient } | { state: "invalid" };

type KvConfig = { state: "none" } | { state: "invalid" } | { state: "ok"; url: string; token: string };

// Reads the environment at CALL time (not import time). Values are trimmed, so
// whitespace-only counts as empty. The pairs are scanned in order (UPSTASH_*, then
// KV_REST_API_*) and the FIRST pair that is complete AND has an https:// URL wins.
//   none    = none of the four variables has a value
//   invalid = some variable has a value but no usable pair exists
// Internal: also used by lib/kv/counterStore.ts to cache one store per pair.
// The result holds the token, so never log it or put it in a message.
export function getKvConfig(): KvConfig {
  const read = (name: string) => process.env[name]?.trim() ?? "";
  const pairs: [string, string][] = [
    [read("UPSTASH_REDIS_REST_URL"), read("UPSTASH_REDIS_REST_TOKEN")],
    [read("KV_REST_API_URL"), read("KV_REST_API_TOKEN")],
  ];
  for (const [url, token] of pairs) {
    if (url && token && url.startsWith("https://")) return { state: "ok", url, token };
  }
  const anySet = pairs.some(([url, token]) => url || token);
  return { state: anySet ? "invalid" : "none" };
}

export function getKvStatus(options: { timeoutMs?: number } = {}): KvStatus {
  const cfg = getKvConfig();
  if (cfg.state !== "ok") return { state: cfg.state };
  return { state: "ok", client: createUpstashClient({ url: cfg.url, token: cfg.token, timeoutMs: options.timeoutMs }) };
}

// The client, or null when the configuration is missing or invalid.
export function getKvClient(options: { timeoutMs?: number } = {}): KvClient | null {
  const status = getKvStatus(options);
  return status.state === "ok" ? status.client : null;
}
