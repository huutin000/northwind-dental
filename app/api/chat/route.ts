// POST /api/chat: thin layer. Session cookie, body parsing, then handleChat.
// Nothing is logged: message text must never reach a log.

import { handleChat, RATE_LIMIT } from "@/lib/chat/handleChat";
import { getProvider } from "@/lib/ai";
import { checkRateLimit } from "@/lib/guard/rateLimit";
import { getCounterStore } from "@/lib/kv/counterStore";
import { getOrCreateSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 32 * 1024; // 32 KB; a real chat request is far smaller

export async function POST(req: Request): Promise<Response> {
  try {
    // Always get the session first, so the cookie is also set on a 400.
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
    const { message, history } = body as Record<string, unknown>;

    // Rate-limit counters: shared KV when configured, memory fallback when it is down.
    const result = await handleChat(
      { message, history, sessionId },
      {
        provider: getProvider(),
        limiter: (key, opts) => checkRateLimit(key, opts, getCounterStore()),
      },
    );
    // The limiter result is not available here, so Retry-After is the whole window.
    const extra: Record<string, string> =
      result.status === 429 ? { "Retry-After": String(RATE_LIMIT.windowSeconds) } : {};
    return respond(result.body, result.status, extra);
  } catch {
    // Unexpected error (for example SESSION_SECRET missing in production). No details.
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
