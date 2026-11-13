import type { NextConfig } from "next";

// Security headers for every route. Not set here on purpose:
//  - Strict-Transport-Security: Vercel sets it.
//  - Content-Security-Policy: a nonce-based CSP forces dynamic rendering; see README "Limitations".
// Referrer-Policy must NOT be "no-referrer": a same-origin fetch POST may then send `Origin: null`,
// which lib/guard/requestGuard.ts rejects with 403. Pinned by tests/e2e/headers.spec.ts.
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
