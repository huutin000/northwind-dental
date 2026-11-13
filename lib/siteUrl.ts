// Base URL of the site, used as `metadataBase` in app/layout.tsx so that relative
// metadata URLs (og:image, icons) become absolute in the HTML.
//
// Source: VERCEL_PROJECT_PRODUCTION_URL, set by Vercel at build and run time. It is
// the production host name WITHOUT a scheme (for example "my-site.com") and is set
// in preview deployments too, so previews point their og:image at production.
// See https://vercel.com/docs/environment-variables/system-environment-variables
// (checked 2026-11-13). Outside Vercel the variable is absent: fall back to
// http://localhost:3000 for local runs. A value that is not a plain host name
// (scheme, path, user info, spaces) is ignored rather than failing the build.

const LOCAL_URL = "http://localhost:3000";
const HOST_NAME = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;

export function getSiteUrl(): URL {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (host && HOST_NAME.test(host)) {
    try {
      return new URL(`https://${host}`);
    } catch {
      // fall through to the local default
    }
  }
  return new URL(LOCAL_URL);
}
