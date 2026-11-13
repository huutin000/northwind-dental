import { expect, test } from "@playwright/test";

// Security headers set in next.config.ts for every route. The values are asserted exactly.
// Referrer-Policy must stay strict-origin-when-cross-origin: with "no-referrer" a same-origin
// fetch POST may carry `Origin: null`, which the request guard rejects with 403.
// No Content-Security-Policy and no Strict-Transport-Security here on purpose (see README).

const EXPECTED = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
} as const;

const TARGETS = [
  { name: "a page (/)", path: "/", status: 200 },
  { name: "an API response (GET /api/leads)", path: "/api/leads", status: 200 },
  { name: "the 404 page", path: "/no-such-page-security-headers", status: 404 },
];

for (const target of TARGETS) {
  test(`security headers are set on ${target.name}`, async ({ request }) => {
    const res = await request.get(target.path);
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
