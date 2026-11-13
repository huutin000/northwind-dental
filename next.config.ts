import type { NextConfig } from "next";

// Security headers for every route. Not set here on purpose:
//  - Strict-Transport-Security: Vercel sets it.
//  - Content-Security-Policy: a nonce-based CSP forces dynamic rendering; see README "Limitations".
// Referrer-Policy: keep strict-origin-when-cross-origin, do not use "no-referrer". lib/guard/requestGuard.ts
// rejects `Origin: null`. Observed: with no-referrer, Chromium's default-mode fetch still sent the real Origin.
// Per the Fetch spec `Origin: null` could appear for non-cors requests (form submit, navigation); that is an
// inference, not verified in this project or in Firefox/Safari. tests/e2e/headers.spec.ts guards the value.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
