// Lead storage with a 24-hour TTL, keyed by session id. Two implementations
// behind one interface: memory (per instance, for local use) and Upstash Redis.

import { getKvStatus, KvError, type KvClient } from "@/lib/kv/upstash";
import { LEAD_ID, sanitizeLead, type Lead } from "./schema";

export const LEAD_TTL_SECONDS = 86400;

// Each lead store request gives up after 2 s (the rate-limit counter keeps its own 800 ms).
// The limit is PER REQUEST: `list` sends two in a row (LRANGE, MGET), so GET can take about 4 s.
// POST worst case: counter 0.8 s + an EXPIRE repair 0.8 s + categorise 4.5 s + save 2 s = about 8.1 s.
export const LEAD_STORE_TIMEOUT_MS = 2000;

export interface LeadStore {
  /**
   * Save a lead for a session. It disappears 24 hours later. The lead is validated
   * first (RangeError if invalid). Adding the same lead id again is idempotent.
   */
  add(sessionId: string, lead: Lead): Promise<void>;
  /** The session's non-expired leads, NEWEST FIRST. Unknown session -> []. */
  list(sessionId: string): Promise<Lead[]>;
  /** Number of non-expired leads of the session. */
  count(sessionId: string): Promise<number>;
}

// ---------------------------------------------------------------- memory

const DEFAULT_MAX_SESSIONS = 5000;

// A Map, Date.now() based (fake timers work). Expired leads are pruned whenever
// a session is touched. `maxSessions` is a hard cap: when a NEW session arrives
// and the Map is full, expired sessions are swept first, then the oldest session
// (Map insertion order) is evicted. That drops its leads early: acceptable for
// a per-instance store whose job is local use and tests.
export function createMemoryLeadStore(options: { maxSessions?: number } = {}): LeadStore {
  const maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
  if (!Number.isInteger(maxSessions) || maxSessions < 1) {
    throw new RangeError(`"maxSessions" must be a positive integer, got ${maxSessions}`);
  }
  type Entry = { lead: Lead; expiresAt: number };
  const sessions = new Map<string, Entry[]>();

  // Remove expired entries of one session and return what is left (oldest first).
  const live = (sessionId: string, now: number): Entry[] => {
    const entries = sessions.get(sessionId);
    if (!entries) return [];
    const kept = entries.filter((e) => e.expiresAt > now);
    if (kept.length === 0) sessions.delete(sessionId);
    else if (kept.length !== entries.length) sessions.set(sessionId, kept);
    return kept;
  };

  return {
    async add(sessionId, input) {
      const lead = sanitizeLead(input);
      const now = Date.now();
      // Same id again (a retry): drop the old copy, the new one becomes the newest.
      const kept = live(sessionId, now).filter((e) => e.lead.id !== lead.id);
      if (!sessions.has(sessionId) && sessions.size >= maxSessions) {
        for (const id of [...sessions.keys()]) live(id, now); // sweep expired sessions
        if (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value as string);
      }
      sessions.set(sessionId, [...kept, { lead, expiresAt: now + LEAD_TTL_SECONDS * 1000 }]);
    },
    async list(sessionId) {
      // Newest first; copies, so callers cannot change what is stored.
      return live(sessionId, Date.now())
        .map((e) => ({ ...e.lead }))
        .reverse();
    },
    async count(sessionId) {
      return live(sessionId, Date.now()).length;
    },
  };
}

// ---------------------------------------------------------------- Upstash

// Ids go into Redis key names, so they are checked BEFORE a key is built. A
// crafted id (with ":" or "../" or spaces) can then never reach another key.
const SESSION_ID = /^[0-9a-f]{32}$/; // what lib/session.ts issues

// The index list keeps at most this many ids per session (newest). A real session
// is limited far lower (Task 9); this only bounds what one list call reads.
export const LEAD_INDEX_MAX = 20;

const leadKey = (sessionId: string, leadId: string) => `lead:${sessionId}:${leadId}`;
const indexKey = (sessionId: string) => `leads:${sessionId}`;

function checkSession(sessionId: string): void {
  // Fixed message: the bad id itself is never echoed.
  if (!SESSION_ID.test(sessionId)) throw new KvError("config", "invalid session id");
}

const CATEGORIES: readonly string[] = ["booking", "pricing", "other"];
const optString = (v: unknown) => v === undefined || typeof v === "string";

// Parse one stored value. The store is not trusted: anything that is not
// exactly a Lead (or whose id differs from its key) gives null and is skipped.
function parseStored(json: unknown, expectedId: string): Lead | null {
  if (typeof json !== "string") return null;
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (o.id !== expectedId) return null;
  if (typeof o.createdAt !== "string" || typeof o.email !== "string") return null;
  if (typeof o.category !== "string" || !CATEGORIES.includes(o.category)) return null;
  if (!optString(o.name) || !optString(o.note) || !optString(o.summary)) return null;
  const lead: Lead = {
    id: o.id,
    createdAt: o.createdAt,
    email: o.email,
    category: o.category as Lead["category"],
  };
  if (o.name !== undefined) lead.name = o.name as string;
  if (o.note !== undefined) lead.note = o.note as string;
  if (o.summary !== undefined) lead.summary = o.summary as string;
  return lead;
}

// Each lead is its own key with its own 24h TTL (`lead:<sid>:<id>`); the list
// `leads:<sid>` is only an index of ids, kept in add order. Failures are NOT
// swallowed: they throw KvError (the caller decides what the visitor sees).
export function createKvLeadStore(client: KvClient): LeadStore {
  const ttl = String(LEAD_TTL_SECONDS);

  async function list(sessionId: string): Promise<Lead[]> {
    checkSession(sessionId);
    const ids = await client.command(["LRANGE", indexKey(sessionId), "0", "-1"]);
    if (!Array.isArray(ids)) throw new KvError("upstream", "kv bad reply");
    // Skip index entries that are not well-formed ids (never build keys from them)
    // and duplicates (a retried add pushes the id again): walking from the newest
    // end keeps the newest occurrence. Reversed back to oldest-first afterwards.
    const seen = new Set<string>();
    const newestFirst: string[] = [];
    for (let i = ids.length - 1; i >= 0; i--) {
      const id: unknown = ids[i];
      if (typeof id !== "string" || !LEAD_ID.test(id) || seen.has(id)) continue;
      seen.add(id);
      newestFirst.push(id);
    }
    const valid = newestFirst.reverse();
    if (valid.length === 0) return [];

    const values = await client.command(["MGET", ...valid.map((id) => leadKey(sessionId, id))]);
    if (!Array.isArray(values) || values.length !== valid.length) throw new KvError("upstream", "kv bad reply");

    const leads: Lead[] = [];
    valid.forEach((id, i) => {
      const lead = parseStored(values[i], id); // null (expired or bad) -> skipped
      if (lead) leads.push(lead);
    });
    return leads.reverse(); // newest first
  }

  return {
    async add(sessionId, input) {
      checkSession(sessionId);
      const lead = sanitizeLead(input); // RangeError before any request; also checks the id
      // One atomic request: the lead (own 24h TTL), its index entry, the index cap, the index TTL.
      await client.transaction([
        ["SET", leadKey(sessionId, lead.id), JSON.stringify(lead), "EX", ttl],
        ["RPUSH", indexKey(sessionId), lead.id],
        ["LTRIM", indexKey(sessionId), String(-LEAD_INDEX_MAX), "-1"],
        ["EXPIRE", indexKey(sessionId), ttl],
      ]);
    },
    list,
    async count(sessionId) {
      return (await list(sessionId)).length;
    },
  };
}

// ---------------------------------------------------------------- default

const memoryLeads = createMemoryLeadStore();

// A store for a broken KV configuration: every call fails loudly, so the caller can
// say "could not save, please try again" instead of silently using per-instance memory.
const misconfigured: LeadStore = {
  add: () => Promise.reject(new KvError("config", "kv misconfigured")),
  list: () => Promise.reject(new KvError("config", "kv misconfigured")),
  count: () => Promise.reject(new KvError("config", "kv misconfigured")),
};

// KV configured -> KV store; nothing configured -> per-instance memory;
// something configured but unusable -> the failing store above.
export function getLeadStore(): LeadStore {
  const status = getKvStatus({ timeoutMs: LEAD_STORE_TIMEOUT_MS });
  if (status.state === "ok") return createKvLeadStore(status.client);
  return status.state === "none" ? memoryLeads : misconfigured;
}
