// Client-side validation of the lead form. It does NOT re-implement any rule: it calls the
// server's parseLeadInput (client-safe: that module only imports a type) and maps its fixed
// error text to a field. The honeypot is never sent to it, so it is never a client error.

import { LEAD_ERRORS, parseLeadInput } from "./schema";

export type LeadField = "email" | "name" | "note";
export type FieldErrors = Partial<Record<LeadField, string>>;
export type FormValues = { email: string; name: string; note: string };
export type Validation = { ok: true } | { ok: false; errors: FieldErrors };

// A Map, not a plain object: a server text such as "constructor" must never match.
const FIELD_BY_ERROR = new Map<string, LeadField>([
  [LEAD_ERRORS.email, "email"],
  [LEAD_ERRORS.name, "name"],
  [LEAD_ERRORS.note, "note"],
]);

/** The field a known schema message belongs to, or null. */
export function errorField(message: unknown): LeadField | null {
  return typeof message === "string" ? (FIELD_BY_ERROR.get(message) ?? null) : null;
}

/** Same rules as the server (first failing field only; schema order is email, name, note). */
export function validateLeadForm(values: FormValues): Validation {
  const r = parseLeadInput({ email: values.email, name: values.name, note: values.note, history: [] });
  if (r.ok) return { ok: true };
  const field = errorField(r.error);
  // Every other schema text cannot happen for these inputs; keep it visible on the email field.
  return { ok: false, errors: { [field ?? "email"]: r.error } };
}
