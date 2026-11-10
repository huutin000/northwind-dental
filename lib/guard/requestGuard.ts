// CSRF guard for the JSON POST routes. A cross-site page can send a "simple" POST
// (text/plain body, no preflight) with the visitor's cookies, so the routes accept
// only a request that looks like our own fetch() call. Pure function, no I/O.
//   1. Content-Type must be exactly application/json (parameters such as charset ignored)
//   2. Sec-Fetch-Site, when sent, must be same-origin or none
//   3. Origin, when sent, must have the same host:port as the Host header
//      (or the first X-Forwarded-Host value behind a proxy)
// A missing Sec-Fetch-Site or Origin passes (curl, tests, old browsers).

export type GuardResult = { ok: true } | { ok: false; status: 403 | 415; error: string };

const UNSUPPORTED: GuardResult = { ok: false, status: 415, error: "Unsupported content type." };
const FORBIDDEN: GuardResult = { ok: false, status: 403, error: "Request not allowed." };

export function checkJsonPost(req: Request): GuardResult {
  const mediaType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") return { ...UNSUPPORTED };

  const site = req.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") return { ...FORBIDDEN };

  const origin = req.headers.get("origin");
  if (origin !== null) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return { ...FORBIDDEN }; // "null", empty or unparsable
    }
    const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0].trim();
    const expected = forwarded || req.headers.get("host");
    if (!originHost || originHost !== expected) return { ...FORBIDDEN };
  }
  return { ok: true };
}
