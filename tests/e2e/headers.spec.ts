import { expect, test } from "@playwright/test";

// Security headers set in next.config.ts for every route. The values are asserted exactly.
// Referrer-Policy must stay strict-origin-when-cross-origin, not "no-referrer" (the request guard rejects
// `Origin: null`; see the comment in next.config.ts for what was observed and what is only inferred).
// No Content-Security-Policy and no Strict-Transport-Security here on purpose (see README).

const EXPECTED = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
} as const;

// The API target is POST /api/chat with Content-Type text/plain: the request guard answers 415 before any session,
// limiter or provider is touched, so the check needs no cookie and no AI.
const TARGETS = [
  { name: "a page (/)", method: "GET", path: "/", status: 200 },
  { name: "an API response (POST /api/chat, 415 from the guard)", method: "POST", path: "/api/chat", status: 415 },
  { name: "the 404 page", method: "GET", path: "/no-such-page-security-headers", status: 404 },
];

for (const target of TARGETS) {
  test(`security headers are set on ${target.name}`, async ({ request }) => {
    const res =
      target.method === "POST"
        ? await request.post(target.path, { headers: { "Content-Type": "text/plain" }, data: "{}" })
        : await request.get(target.path);
    expect(res.status()).toBe(target.status);
    const headers = res.headers();
    for (const [name, value] of Object.entries(EXPECTED)) {
      expect(headers[name], name).toBe(value);
    }
    // Deliberately not set by the app: Vercel sets HSTS, and a CSP needs a nonce (dynamic rendering).
    expect(headers["content-security-policy"]).toBeUndefined();
    expect(headers["strict-transport-security"]).toBeUndefined();
  });
}
