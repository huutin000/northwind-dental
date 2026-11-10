// Lead shape and input validation. Hand-written checks, no library.

import type { ChatMessage } from "@/lib/ai/provider";

export type Lead = {
  id: string;
  createdAt: string; // ISO 8601
  email: string;
  name?: string;
  note?: string;
  category: "booking" | "pricing" | "other";
  summary?: string;
};

export const MAX_EMAIL = 254;
export const MAX_NAME = 80;
export const MAX_NOTE = 500;
export const MAX_HISTORY_ITEMS = 6;
export const MAX_HISTORY_CONTENT = 2000;

export type LeadInput = { email: string; name?: string; note?: string; history: ChatMessage[] };
export type ParseResult = { ok: true; value: LeadInput } | { ok: false; error: string };

// Friendly texts. None of them echoes the input.
const ERR_EMAIL = "Please enter a valid email address.";
const ERR_NAME = `Please keep the name to one line of at most ${MAX_NAME} characters.`;
const ERR_NOTE = `Please keep the note to at most ${MAX_NOTE} characters.`;
const ERR_HISTORY = "The conversation could not be read. Please try again.";
const ERR_GENERIC = "Sorry, we could not process that. Please check your details and try again.";

const ERR_TOO_BIG = "Please shorten your message and try again.";

/** The fixed 400 texts, exported so the client can recognise them (it never trusts other server text). */
export const LEAD_ERRORS = {
  email: ERR_EMAIL,
  name: ERR_NAME,
  note: ERR_NOTE,
  history: ERR_HISTORY,
  generic: ERR_GENERIC,
  tooBig: ERR_TOO_BIG,
} as const;

const fail = (error: string): ParseResult => ({ ok: false, error });

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

// Letters (any script), combining marks and digits.
const ALNUM = String.raw`\p{L}\p{M}\p{N}`;
const LOCAL = new RegExp(String.raw`^[${ALNUM}!#$%&'*+/=?^_\x60{|}~-]+(\.[${ALNUM}!#$%&'*+/=?^_\x60{|}~-]+)*$`, "u");
const LABEL = new RegExp(String.raw`^[${ALNUM}]([${ALNUM}-]*[${ALNUM}])?$`, "u");

// One "@", a local part without leading, trailing or doubled dots, and a domain
// of at least two dot-separated labels. No spaces or control characters anywhere.
function isValidEmail(email: string): boolean {
  if (email.length === 0 || email.length > MAX_EMAIL) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!LOCAL.test(local)) return false;
  const labels = domain.split(".");
  return labels.length >= 2 && labels.every((l) => LABEL.test(l));
}

// undefined stays undefined; otherwise a trimmed string, empty -> undefined.
// Returns null when the value is present but not a string.
function optionalText(v: unknown): string | undefined | null {
  if (v === undefined) return undefined;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? undefined : t;
}

export function parseLeadInput(raw: unknown): ParseResult {
  if (!isPlainObject(raw)) return fail(ERR_GENERIC);

  // Honeypot: a hidden field that real visitors leave empty. Same generic
  // error as any other failure, so a bot learns nothing.
  const trap = optionalText(raw.website);
  if (trap !== undefined) return fail(ERR_GENERIC);

  if (typeof raw.email !== "string") return fail(ERR_EMAIL);
  const email = raw.email.trim();
  if (!isValidEmail(email)) return fail(ERR_EMAIL);

  const name = optionalText(raw.name);
  if (name === null || (name !== undefined && (name.length > MAX_NAME || /[\r\n]/.test(name)))) {
    return fail(ERR_NAME);
  }

  const note = optionalText(raw.note);
  if (note === null || (note !== undefined && note.length > MAX_NOTE)) return fail(ERR_NOTE);

  const history: ChatMessage[] = [];
  if (raw.history !== undefined) {
    if (!Array.isArray(raw.history) || raw.history.length > MAX_HISTORY_ITEMS) return fail(ERR_HISTORY);
    for (const item of raw.history as unknown[]) {
      if (!isPlainObject(item)) return fail(ERR_HISTORY);
      const { role, content } = item;
      if (role !== "user" && role !== "assistant") return fail(ERR_HISTORY);
      if (typeof content !== "string" || content.length > MAX_HISTORY_CONTENT) return fail(ERR_HISTORY);
      history.push({ role, content }); // copy only the two known fields
    }
  }

  return { ok: true, value: { email, name, note, history } };
}

// ---------------------------------------------------------------- write validation

export const MAX_SUMMARY = 400;
export const MAX_LEAD_BYTES = 4096;
export const LEAD_ID = /^[A-Za-z0-9_-]{8,64}$/; // fits crypto.randomUUID(); also used in Redis key names
const CATEGORIES: readonly string[] = ["booking", "pricing", "other"];

// Checked by BOTH stores before anything is saved. Builds a NEW object from the
// known fields only (extra properties, including __proto__, are dropped), checks
// types and bounds, and caps the JSON size in UTF-8 bytes. The error is always
// the same fixed text: it never echoes the data.
export function sanitizeLead(lead: unknown): Lead {
  const bad = () => new RangeError("invalid lead");
  if (!isPlainObject(lead)) throw bad();
  const { id, createdAt, email, category, name, note, summary } = lead;
  // typeof first, so a number such as 12345678 never reaches the regex.
  if (typeof id !== "string" || !LEAD_ID.test(id)) throw bad();
  if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) throw bad();
  if (typeof email !== "string" || email.length > MAX_EMAIL) throw bad();
  if (typeof category !== "string" || !CATEGORIES.includes(category)) throw bad();
  const optional = (v: unknown, max: number): string | undefined => {
    if (v === undefined) return undefined;
    if (typeof v !== "string" || v.length > max) throw bad();
    return v;
  };
  const clean: Lead = { id, createdAt, email, category: category as Lead["category"] };
  const n = optional(name, MAX_NAME);
  const o = optional(note, MAX_NOTE);
  const s = optional(summary, MAX_SUMMARY);
  if (n !== undefined) clean.name = n;
  if (o !== undefined) clean.note = o;
  if (s !== undefined) clean.summary = s;
  if (new TextEncoder().encode(JSON.stringify(clean)).length > MAX_LEAD_BYTES) throw bad();
  return clean;
}
