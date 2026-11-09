// Rate-limit counters on the key-value store, plus the fallback to memory.

import { createMemoryCounterStore, type CounterStore } from "@/lib/guard/rateLimit";
import { getKvClient, getKvConfig, KvError, type KvClient } from "./upstash";

// The counter must never slow the chat down much, so its client gives up fast.
const COUNTER_TIMEOUT_MS = 800;
const DEFAULT_BREAKER_MS = 30_000;
const WARN_INTERVAL_MS = 60_000;

// Fixed-window counter in ONE atomic MULTI/EXEC round trip of three commands:
//   SET key 0 EX <window> NX   creates the key with the TTL only if it is missing
//   INCR key                   adds 1 and returns the count
//   TTL key                    -1 means the key exists WITHOUT an expiry
// The TTL is set once, by the first hit; later hits do not extend it.
// Repair: a key without expiry would count forever, so on TTL -1 one extra plain
// EXPIRE gives it the window. (EXPIRE ... NX is deliberately not used: its support
// is unverified.) If the repair fails the error is thrown like any KV failure.
export function createKvCounterStore(client: KvClient): CounterStore {
  return {
    async incr(key, windowSeconds) {
      const window = String(Math.ceil(windowSeconds));
      const results = await client.transaction([
        ["SET", key, "0", "EX", window, "NX"],
        ["INCR", key],
        ["TTL", key],
      ]);
      const count = results[1];
      const ttl = results[2];
      if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
        throw new KvError("upstream", "kv bad counter");
      }
      if (typeof ttl !== "number" || !Number.isInteger(ttl)) throw new KvError("upstream", "kv bad counter");
      if (ttl === -1) await client.command(["EXPIRE", key, window]);
      return count;
    },
  };
}

// The one warning this module may write: `[kv] counter fallback: <kind>`, at most
// once per 60 s. It carries only the error kind, never a URL, token, key or text,
// and a broken console can never change the result.
function createWarner(now: () => number): (error: unknown) => void {
  let last = Number.NEGATIVE_INFINITY;
  return (error) => {
    const t = now();
    if (t - last < WARN_INTERVAL_MS) return;
    last = t;
    const kind = error instanceof KvError ? error.kind : "unexpected";
    try {
      console.warn(`[kv] counter fallback: ${kind}`);
    } catch {
      // ignore
    }
  };
}

// Try `primary`; on ANY error use `fallback`. Never throws.
// Circuit breaker: after a failure the primary is skipped for `breakerMs`, so a
// dead or black-holed KV costs one short timeout, not one per message. After that
// window the primary is tried once more: success closes the breaker, failure
// re-opens it for another window.
export function createFallbackCounterStore(
  primary: CounterStore,
  fallback: CounterStore,
  options: { breakerMs?: number; now?: () => number } = {},
): CounterStore {
  const breakerMs = options.breakerMs ?? DEFAULT_BREAKER_MS;
  const now = options.now ?? (() => Date.now());
  const warn = createWarner(now);
  let openUntil = Number.NEGATIVE_INFINITY;
  return {
    async incr(key, windowSeconds) {
      if (now() >= openUntil) {
        try {
          return await primary.incr(key, windowSeconds);
        } catch (e) {
          openUntil = now() + breakerMs;
          warn(e);
        }
      }
      return fallback.incr(key, windowSeconds);
    },
  };
}

// Per-instance memory counters, used when no KV is configured or it is down.
// Best effort (spec 6.1): serverless instances do not share it, so the limit
// is looser while the KV is unavailable.
const memoryCounters = createMemoryCounterStore();

// One KV store per configuration, so the breaker state survives between requests.
// It is rebuilt only when the url/token pair changes. The cached values are never
// logged or exported.
let cached: { url: string; token: string; store: CounterStore } | null = null;
const warnInvalid = createWarner(() => Date.now());

export function getCounterStore(): CounterStore {
  const cfg = getKvConfig();
  if (cfg.state === "none") return memoryCounters;
  if (cfg.state === "invalid") {
    // Misconfigured: the chat keeps working on memory counters.
    warnInvalid(new KvError("config", "kv misconfigured"));
    return memoryCounters;
  }
  if (cached && cached.url === cfg.url && cached.token === cfg.token) return cached.store;
  const client = getKvClient({ timeoutMs: COUNTER_TIMEOUT_MS });
  if (!client) return memoryCounters; // cannot happen: cfg is ok
  const store = createFallbackCounterStore(createKvCounterStore(client), memoryCounters);
  cached = { url: cfg.url, token: cfg.token, store };
  return store;
}
