// Signed session cookie.
//
// Cookie name: nd_session. Value: "<id>.<signature>"
//   id        32 lowercase hex characters (16 random bytes)
//   signature base64url HMAC-SHA256 of the id, keyed with SESSION_SECRET
// The signature stops a client from inventing or editing a session id.
// A missing, malformed or wrongly signed cookie simply counts as "no session".
//
// This is an anonymous session, not a login: it only lets the server count
// messages and (later) find a visitor's own leads.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "nd_session";
const MAX_AGE_SECONDS = 86_400; // 24 hours
const MAX_COOKIE_VALUE_CHARS = 128; // a valid value is 76 characters; longer is junk
const ID_PATTERN = /^[0-9a-f]{32}$/;
const MIN_SECRET_CHARS = 16;

/**
 * Fixed, public, INSECURE secret used only outside production when SESSION_SECRET
 * is unset or too short, so local development and tests work without setup.
 * Anyone can read this file, so it must never protect real data.
 */
const DEV_FALLBACK_SECRET = "insecure-development-only-session-secret";

/** SESSION_SECRET is read at call time. In production a missing/short one is an error (fail closed). */
function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= MIN_SECRET_CHARS) return secret;
  if (process.env.NODE_ENV === "production") {
    // The message never includes the secret value.
    throw new Error("SESSION_SECRET must be set (at least 16 characters) in production.");
  }
  return DEV_FALLBACK_SECRET;
}

function sign(id: string, secret: string): string {
  return createHmac("sha256", secret).update(id).digest("base64url");
}

/** Value of the nd_session cookie from the raw Cookie header, or null. Parsed by hand. */
function rawCookieValue(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === COOKIE_NAME) return part.slice(eq + 1).trim();
  }
  return null;
}

/** The verified session id, or null when there is no valid cookie. */
export function readSession(req: Request): string | null {
  const secret = getSecret(); // throws in production without a secret
  const value = rawCookieValue(req);
  if (!value || value.length > MAX_COOKIE_VALUE_CHARS) return null;

  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [id, signature] = parts;
  if (!ID_PATTERN.test(id)) return null;

  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(id, secret));
  // timingSafeEqual throws on different lengths, so check that first.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return id;
}

/** Reuse a valid session, or create one. `setCookie` is set only for a NEW session. */
export function getOrCreateSession(req: Request): { sessionId: string; setCookie?: string } {
  const existing = readSession(req);
  if (existing) return { sessionId: existing };

  const sessionId = randomBytes(16).toString("hex");
  const attributes = ["HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${MAX_AGE_SECONDS}`];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  const value = `${sessionId}.${sign(sessionId, getSecret())}`;
  return { sessionId, setCookie: `${COOKIE_NAME}=${value}; ${attributes.join("; ")}` };
}
