// Rate limiter: "at most `limit` calls per `windowSeconds` for one key"
// (the key is usually a session id).
//
// Fixed window: the window starts at the FIRST hit of a key. Every later hit in
// that window adds 1 to a counter. When the window ends, the counter is dropped
// and the next hit starts a new window at 1.
//
// The counting lives behind `CounterStore`, so a shared key-value store
// (INCR + EXPIRE style, added in Task 8) can replace the in-memory one.

export interface CounterStore {
  // Add 1 to the counter for `key` and return the new count for the current
  // window. The first hit of a key starts a window of `windowSeconds`.
  incr(key: string, windowSeconds: number): Promise<number>;
}

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

// How often (at most) the memory store scans for expired keys.
const SWEEP_INTERVAL_MS = 60_000;

// At most how often a FULL store sweeps for expired keys before it evicts.
const CAP_SWEEP_INTERVAL_MS = 1_000;

// Default hard cap on the number of keys the memory store holds.
const DEFAULT_MAX_KEYS = 10_000;

// In-memory store. It is per server instance: serverless instances do not
// share it, so it is only a best-effort fallback (spec 6.1).
//
// `maxKeys` is a hard cap, so a flood of new keys cannot grow memory without
// bound. When a NEW key arrives and the Map is full, expired entries are swept
// first; if it is still full, the oldest entry (Map insertion order) is evicted.
// This FAILS OPEN: an evicted key's counter restarts at 1, so a client could get
// extra calls. That is acceptable for a best-effort fallback: the alternative is
// unbounded memory, and a shared store (Task 8) is the real limiter.
export function createMemoryCounterStore(
  options: { maxKeys?: number } = {},
): CounterStore {
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  if (!Number.isInteger(maxKeys) || maxKeys < 1) {
    throw new RangeError(`"maxKeys" must be a positive integer, got ${maxKeys}`);
  }
  // A Map, not a plain object: keys such as "__proto__" or "constructor" are
  // then ordinary keys.
  const windows = new Map<string, { count: number; expiresAt: number }>();
  let lastSweep = Date.now(); // Date.now() so fake timers work in tests
  let lastCapSweep = Number.NEGATIVE_INFINITY; // the first full-store sweep is always allowed

  return {
    async incr(key, windowSeconds) {
      const now = Date.now();

      // Cleanup: at most once per SWEEP_INTERVAL_MS, delete every expired
      // entry. Without this, keys that are never seen again would stay forever.
      const sweep = () => {
        for (const [k, w] of windows) {
          if (w.expiresAt <= now) windows.delete(k);
        }
      };
      if (now - lastSweep >= SWEEP_INTERVAL_MS) {
        lastSweep = now;
        sweep();
      }

      // No JS await between read and write, so simultaneous calls cannot
      // interleave and every call gets a distinct count.
      let w = windows.get(key);
      if (!w || w.expiresAt <= now) {
        // Missing or expired: start a new window at this moment.
        // Delete first so the re-inserted key moves to the END of the Map's
        // insertion order, which is the "newest" end for eviction.
        windows.delete(key);
        if (windows.size >= maxKeys) {
          // Free expired entries before sacrificing a live one. The sweep walks
          // the whole Map, so it runs at most once per CAP_SWEEP_INTERVAL_MS:
          // a flood of new keys cannot make every request pay for a full scan.
          if (now - lastCapSweep >= CAP_SWEEP_INTERVAL_MS) {
            lastCapSweep = now;
            sweep();
          }
          if (windows.size >= maxKeys) {
            // Still full: drop the oldest entry (first key in insertion order).
            windows.delete(windows.keys().next().value as string);
          }
        }
        w = { count: 0, expiresAt: now + windowSeconds * 1000 };
        windows.set(key, w);
      }
      w.count += 1;
      return w.count;
    },
  };
}

// Default store, shared by every call that does not pass its own.
const defaultStore = createMemoryCounterStore();

export async function checkRateLimit(
  key: string,
  opts: { limit: number; windowSeconds: number },
  store: CounterStore = defaultStore,
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = opts;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`rate limit "limit" must be a positive integer, got ${limit}`);
  }
  if (!Number.isFinite(windowSeconds) || windowSeconds <= 0) {
    throw new RangeError(
      `rate limit "windowSeconds" must be a positive number, got ${windowSeconds}`,
    );
  }

  const count = await store.incr(key, windowSeconds);
  if (count <= limit) return { allowed: true, retryAfterSeconds: 0 };

  // `incr` returns only the count, not the time left in the window (a key-value
  // store cannot return that cheaply). So when denied we report the whole
  // window as a safe upper bound: the client may wait longer than needed, never
  // shorter. Rounded up so it is an integer >= 1.
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(windowSeconds)) };
}
