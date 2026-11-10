// Pure helpers for the lead form: the fetch init and the visitor-facing text per response.
// No logging, no DOM. Texts are fixed client strings; server text is shown only when it is
// one of the known 400 messages from schema.ts.

import type { ChatMessage } from "@/lib/ai/provider";
import { errorField, type LeadField } from "./clientRules";
import { LEAD_ERRORS } from "./schema";

export const LEAD_NOTICE = "This is a demo. Please use a fake email. Data is deleted after 24 hours.";

const KNOWN_400 = new Set<string>([LEAD_ERRORS.email, LEAD_ERRORS.name, LEAD_ERRORS.note, LEAD_ERRORS.tooBig]);

const MESSAGES = {
  badRequest: "Please check your details and try again.",
  forbidden: "We could not verify this request. Please reload the page and try again.",
  unsupported: "Your browser sent the request in an unexpected format. Please reload the page and try again.",
  limit: "You have reached the request limit for this demo. Please try again tomorrow.",
  unavailable: "We could not save your request right now. Please try again in a moment.",
  generic: "Something went wrong. Please try again.",
} as const;

export type LeadFormInput = { email: string; name: string; note: string; website?: string };

/**
 * Same-origin JSON POST. The Content-Type header is required by the server guard (415 otherwise).
 * No `credentials`, `mode` or `referrerPolicy` is set: the defaults (same-origin cookies) are right,
 * and `Referrer-Policy: no-referrer` would make the browser send `Origin: null` (see CLAUDE.md).
 */
export function buildLeadRequest(input: LeadFormInput, history: ChatMessage[]): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      name: input.name,
      note: input.note,
      website: input.website ?? "", // honeypot: empty for real visitors
      history,
    }),
  };
}

export type LeadOutcome = { ok: true } | { ok: false; message: string; field?: LeadField };

/**
 * `status` 0 means a network failure. Any 2xx counts as success even when the body cannot be read:
 * the lead was saved, and retrying would only use another of the 3 slots.
 */
export function describeLeadResponse(status: number, body?: unknown): LeadOutcome {
  if (status >= 200 && status < 300) return { ok: true };
  switch (status) {
    case 400: {
      const error =
        typeof body === "object" && body !== null && !Array.isArray(body)
          ? (body as Record<string, unknown>).error
          : undefined;
      if (typeof error === "string" && KNOWN_400.has(error)) {
        const field = errorField(error);
        return field ? { ok: false, message: error, field } : { ok: false, message: error };
      }
      return { ok: false, message: MESSAGES.badRequest };
    }
    case 403:
      return { ok: false, message: MESSAGES.forbidden };
    case 415:
      return { ok: false, message: MESSAGES.unsupported };
    case 429:
      return { ok: false, message: MESSAGES.limit };
    case 503:
      return { ok: false, message: MESSAGES.unavailable };
    default:
      return { ok: false, message: MESSAGES.generic };
  }
}
