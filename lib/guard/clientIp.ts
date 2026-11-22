// Rate-limit key for the client network address.
// Only headers that the hosting platform (Vercel) sets itself are read: `x-real-ip`, then
// `x-vercel-forwarded-for`. The raw `x-forwarded-for` is never used (a client can forge it).
// The address is hashed with SESSION_SECRET and cut to 32 hex characters, so the raw IP is
// never stored in a counter key, a log or a response. No address -> one shared constant key.

import { createHash } from "node:crypto";

const UNKNOWN_KEY = "unknown";
const HASH_HEX_CHARS = 32;
const MAX_IP_CHARS = 64; // longest textual IPv6 is 45; longer is junk

function readIp(req: Request): string | null {
  for (const name of ["x-real-ip", "x-vercel-forwarded-for"]) {
    const value = req.headers.get(name)?.split(",")[0]?.trim();
    if (value && value.length <= MAX_IP_CHARS) return value;
  }
  return null;
}

/** Opaque, stable key part for the caller's IP (or the constant "unknown"). */
export function getClientKey(req: Request): string {
  const ip = readIp(req);
  if (!ip) return UNKNOWN_KEY;
  // The secret is read at call time; an empty one still hashes (the hash is only a privacy measure).
  const secret = process.env.SESSION_SECRET ?? "";
  return createHash("sha256").update(secret).update(ip).digest("hex").slice(0, HASH_HEX_CHARS);
}
