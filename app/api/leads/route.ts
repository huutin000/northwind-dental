// POST /api/leads and GET /api/leads: thin layer over handleLead.ts.
// Nothing is logged: leads hold contact details.

import { getProvider } from "@/lib/ai";
import { checkRateLimit } from "@/lib/guard/rateLimit";
import { checkJsonPost } from "@/lib/guard/requestGuard";
import { getCounterStore } from "@/lib/kv/counterStore";
import { handleCreateLead, handleListLeads, LEAD_RATE_LIMIT } from "@/lib/leads/handleLead";
import { getLeadStore } from "@/lib/leads/store";
import { getOrCreateSession, readSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Seconds. Worst case of POST is about 8.1 s (0.8 counter + 0.8 EXPIRE repair + 4.5 categorise
// + 2.0 save); GET about 4 s (two store requests). See lib/leads/store.ts.
export const maxDuration = 10;

const MAX_BODY_CHARS = 32 * 1024;

const fail500 = () =>
  Response.json(
    { error: "Something went wrong. Please try again." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );

export async function POST(req: Request): Promise<Response> {
  try {
    // CSRF guard first: a rejected request gets no cookie and reaches nothing else.
    const guard = checkJsonPost(req);
    if (!guard.ok) {
      return Response.json({ error: guard.error }, { status: guard.status, headers: { "Cache-Control": "no-store" } });
    }

    // Always get the session next, so the cookie is also set on a 400.
    const { sessionId, setCookie } = getOrCreateSession(req);

    const respond = (body: unknown, status: number, extra: Record<string, string> = {}) => {
      const headers = new Headers({ "Cache-Control": "no-store", ...extra });
      if (setCookie) headers.append("Set-Cookie", setCookie);
      return Response.json(body, { status, headers });
    };
    const invalid = () => respond({ error: "Invalid request." }, 400);

    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_CHARS) return invalid();
    const text = await req.text();
    if (text.length > MAX_BODY_CHARS) return invalid();

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return invalid();
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) return invalid();

    const result = await handleCreateLead(
      { body, sessionId },
      {
        provider: getProvider(),
        store: getLeadStore(),
        limiter: (key, opts) => checkRateLimit(key, opts, getCounterStore()),
      },
    );
    const extra: Record<string, string> =
      result.status === 429 ? { "Retry-After": String(LEAD_RATE_LIMIT.windowSeconds) } : {};
    return respond(result.body, result.status, extra);
  } catch {
    return fail500(); // for example SESSION_SECRET missing in production; no details
  }
}

export async function GET(req: Request): Promise<Response> {
  try {
    // readSession never creates a session: no valid cookie means no leads.
    const result = await handleListLeads(readSession(req), { store: getLeadStore() });
    return Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return fail500();
  }
}
