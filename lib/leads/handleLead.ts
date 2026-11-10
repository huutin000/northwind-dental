// Lead creation and listing. Order for create:
//   1. validate the body and check that the form alone fits the stored size (no slot used on failure)
//   2. rate limit with the atomic counter (3 leads per session per 24 h)
//   3. redact the history, THEN cut it; categorise it (the form fields never go to the model)
//   4. save; any store error gives one fixed 503 text
// LOGGING: the only log is one throttled warning when the lead store fails (kind only).
// Never a URL, token, key, id or any visitor text: leads hold contact details.

import type { ChatMessage, ChatProvider } from "@/lib/ai/provider";
import type { checkRateLimit } from "@/lib/guard/rateLimit";
import { redactPII } from "@/lib/guard/redactPII";
import { KvError } from "@/lib/kv/upstash";
import { categorize } from "./categorize";
import { MAX_HISTORY_ITEMS, parseLeadInput, sanitizeLead, type Lead } from "./schema";
import type { LeadStore } from "./store";

export type LeadResult =
  | { status: 201; body: { lead: Lead } }
  | { status: 400 | 429 | 503; body: { error: string } };

export const LEAD_RATE_LIMIT = { limit: 3, windowSeconds: 86400 };
const MAX_HISTORY_CHARS = 500;

const LIMIT_ERROR = "You have reached the limit of 3 requests for this demo. Please try again tomorrow.";
const TOO_BIG_ERROR = "Please shorten your message and try again.";
const SAVE_ERROR = "Sorry, we could not save your request. Please try again.";

// Same 3-line helper as lib/chat/handleChat.ts (not exported there).
const truncate = (text: string, max: number): string => text.slice(0, max).replace(/[\uD800-\uDBFF]$/, "");

const LOG_INTERVAL_MS = 60_000;
let lastWarnAt = Number.NEGATIVE_INFINITY;

/** For tests: forget the last warning time. */
export function resetLeadLogThrottle(): void {
  lastWarnAt = Number.NEGATIVE_INFINITY;
}

/** At most one `[kv] lead store failure: <kind>` per minute per process. Never throws. */
function warnStoreFailure(e: unknown): void {
  try {
    const now = Date.now(); // Date.now() so fake timers work
    if (now - lastWarnAt < LOG_INTERVAL_MS) return;
    lastWarnAt = now;
    console.warn(`[kv] lead store failure: ${e instanceof KvError ? e.kind : "unexpected"}`);
  } catch {
    // Logging must never change the response.
  }
}

export async function handleCreateLead(
  input: { body: unknown; sessionId: string },
  deps: {
    provider: ChatProvider | null;
    store: LeadStore;
    limiter: typeof checkRateLimit;
    now?: () => Date;
    newId?: () => string;
  },
): Promise<LeadResult> {
  const parsed = parseLeadInput(input.body);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  const { email, name, note } = parsed.value;

  // Size check BEFORE the limiter: if the form alone cannot be stored (JSON escapes and
  // multi-byte letters can make it bigger than the byte cap), say so and use no slot.
  // The draft uses "booking", the longest category, so the check is an upper bound for the final lead.
  const fields = { email, ...(name !== undefined && { name }), ...(note !== undefined && { note }) };
  try {
    sanitizeLead({ id: "x".repeat(36), createdAt: new Date(0).toISOString(), category: "booking", ...fields });
  } catch {
    return { status: 400, body: { error: TOO_BIG_ERROR } };
  }

  let lead: Lead;
  try {
    const limit = await deps.limiter(`lead:${input.sessionId}`, LEAD_RATE_LIMIT);
    if (!limit.allowed) return { status: 429, body: { error: LIMIT_ERROR } };

    // Redact first, truncate second: cutting first could split an email in half.
    const history: ChatMessage[] = parsed.value.history
      .slice(-MAX_HISTORY_ITEMS)
      .map(({ role, content }) => ({ role, content: truncate(redactPII(content), MAX_HISTORY_CHARS) }));
    const { category, summary } = await categorize(history, deps.provider);

    lead = {
      id: (deps.newId ?? (() => crypto.randomUUID()))(),
      createdAt: (deps.now ?? (() => new Date()))().toISOString(),
      email,
      category,
    };
    if (name !== undefined) lead.name = name;
    if (note !== undefined) lead.note = note;
    if (summary !== undefined) {
      lead.summary = summary;
      try {
        sanitizeLead(lead);
      } catch {
        delete lead.summary; // the summary made it too big: keep the lead without it
      }
    }
  } catch {
    return { status: 503, body: { error: SAVE_ERROR } };
  }

  try {
    // A used slot is not given back if this fails: the visitor may retry, up to the limit.
    await deps.store.add(input.sessionId, lead);
    return { status: 201, body: { lead } };
  } catch (e) {
    warnStoreFailure(e);
    return { status: 503, body: { error: SAVE_ERROR } };
  }
}

/** A broken store must not break reading: any error gives an empty list. */
export async function handleListLeads(
  sessionId: string | null,
  deps: { store: LeadStore },
): Promise<{ status: 200; body: { leads: Lead[] } }> {
  if (sessionId === null) return { status: 200, body: { leads: [] } };
  try {
    return { status: 200, body: { leads: await deps.store.list(sessionId) } };
  } catch (e) {
    warnStoreFailure(e);
    return { status: 200, body: { leads: [] } };
  }
}
