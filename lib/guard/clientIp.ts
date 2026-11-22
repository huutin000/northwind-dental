// Rate-limit key for the client network address.
// Only headers that the hosting platform (Vercel) sets itself are read: `x-vercel-forwarded-for`,
// then `x-real-ip`. The raw `x-forwarded-for` is never used (a client can forge it).
// A header is skipped only when its whole value is absent or blank. Otherwise only its first comma
// item (trimmed) counts: if that is blank, longer than 64 characters or not a valid IP (node:net
// `isIP`), the result is the shared constant key "unknown" and the next header is not
// consulted. IPv4 is hashed as the dotted string. IPv6 is normalised (brackets, zone id, case,
// expanded form) and cut to its /64 prefix, so rotating addresses inside one /64 shares one
// counter. An IPv4-mapped IPv6 address (::ffff:a.b.c.d or ::ffff:102:304) counts as that IPv4.
// Not mapped on purpose (ordinary IPv6 /64): ::1.2.3.4, ::ffff:0:1.2.3.4 and NAT64 64:ff9b::/96.
// The value is hashed with SESSION_SECRET and cut to 32 hex characters, so the raw IP is never
// stored in a counter key, a log or a response.

import { createHash } from "node:crypto";
import { isIP } from "node:net";

const UNKNOWN_KEY = "unknown";
const HASH_HEX_CHARS = 32;
const MAX_IP_CHARS = 64; // cheap pre-filter: longest textual IPv6 is 45; longer is junk
const IPV6_GROUPS = 8;
const PREFIX_GROUPS = 4; // /64
const MAPPED_ZERO_GROUPS = 5; // groups 0..4 are 0, group 5 is 0xffff
const MAPPED_MARKER = 0xffff;

/** Expands a valid IPv6 string to 8 groups of 16 bits; null when the shape is unexpected. */
function expandIpv6(s: string): number[] | null {
  let text = s;
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const parts = tail.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const high = ((parts[0] << 8) | parts[1]).toString(16);
    const low = ((parts[2] << 8) | parts[3]).toString(16);
    text = `${text.slice(0, lastColon + 1)}${high}:${low}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? IPV6_GROUPS - head.length - rest.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== IPV6_GROUPS)) return null;
  const groups = [...head, ...Array<string>(fill).fill("0"), ...rest].map((g) => parseInt(g, 16));
  if (groups.length !== IPV6_GROUPS || groups.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null;
  return groups;
}

/** The string to hash for a valid IP, or null for anything else. */
function normalizeIp(raw: string): string | null {
  let s = raw.toLowerCase();
  const bracketed = s.startsWith("[") && s.endsWith("]");
  if (bracketed) s = s.slice(1, -1);
  const zone = s.indexOf("%");
  if (zone !== -1) s = s.slice(0, zone);
  const version = isIP(s);
  // Brackets and zone ids are only accepted around/after an IPv6 address.
  if (version === 4) return bracketed || zone !== -1 ? null : s;
  if (version !== 6) return null;
  const groups = expandIpv6(s);
  if (!groups) return null;
  const mapped = groups.slice(0, MAPPED_ZERO_GROUPS).every((g) => g === 0) && groups[MAPPED_ZERO_GROUPS] === MAPPED_MARKER;
  if (mapped) {
    return `${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`;
  }
  return `v6/${groups.slice(0, PREFIX_GROUPS).map((g) => g.toString(16).padStart(4, "0")).join(":")}`;
}

function readIp(req: Request): string | null {
  for (const name of ["x-vercel-forwarded-for", "x-real-ip"]) {
    const header = req.headers.get(name);
    if (!header || !header.trim()) continue; // whole header absent or blank: try the next one
    const value = header.split(",")[0].trim(); // only the first item counts
    if (value.length > MAX_IP_CHARS) return null;
    return normalizeIp(value); // blank item or invalid IP -> null, next header not consulted
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
