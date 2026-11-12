"use client";

// Lead form (Task 10). Hand-written, native elements, design tokens only.
// Rules live in lib/leads/*: validation is the server's parseLeadInput (clientRules), the request
// and the texts per status are in leadRequest, the chat turns come from chatHistory (memory only).
// PRIVACY: this component never logs anything; it holds contact details.

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import LeadNotice from "@/components/LeadNotice";
import { getChatHistory } from "@/lib/leads/chatHistory";
import { validateLeadForm, type FieldErrors, type LeadField } from "@/lib/leads/clientRules";
import { buildLeadRequest, describeLeadResponse } from "@/lib/leads/leadRequest";
import { MAX_EMAIL, MAX_NAME, MAX_NOTE } from "@/lib/leads/schema";

const REQUEST_TIMEOUT_MS = 15_000; // the server's worst case is about 8 s

type Status = "idle" | "sending" | "success";
type FocusTarget = LeadField | "summary" | "success";

const fieldClass =
  "mt-1.5 block min-h-12 w-full rounded-control bg-surface px-3.5 py-3 text-base text-ink placeholder:text-muted focus:border-brand focus:ring-3 focus:ring-brand/20";
const labelClass = "block text-sm font-semibold text-ink";
const hintClass = "mt-1 text-xs text-muted";

function ErrorIcon() {
  return (
    <svg
      className="mt-0.5 size-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="mt-1.5 flex items-start gap-2 rounded-control bg-error px-3 py-2 text-[0.9375rem] font-medium text-error-ink"
    >
      <ErrorIcon />
      <span className="font-semibold">Error:</span>
      <span className="min-w-0 break-words">{message}</span>
    </p>
  );
}

export default function LeadForm() {
  const [values, setValues] = useState({ email: "", name: "", note: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [focusReq, setFocusReq] = useState<{ target: FocusTarget; n: number } | null>(null);

  const inFlight = useRef(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  // Move focus after React has committed the new DOM, so a screen reader finds the error text.
  useEffect(() => {
    if (!focusReq) return;
    const el = {
      email: emailRef.current,
      name: nameRef.current,
      note: noteRef.current,
      summary: summaryRef.current,
      success: successRef.current,
    }[focusReq.target];
    el?.focus();
  }, [focusReq]);

  const requestFocus = (target: FocusTarget) => setFocusReq((p) => ({ target, n: (p?.n ?? 0) + 1 }));

  function onChange(field: LeadField) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setValues((v) => ({ ...v, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    };
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return; // no double submit, even before the state update lands
    setFormError(null);

    const check = validateLeadForm(values);
    if (!check.ok) {
      setErrors(check.errors);
      requestFocus(Object.keys(check.errors)[0] as LeadField);
      return;
    }
    setErrors({});

    inFlight.current = true;
    setStatus("sending");
    let httpStatus = 0;
    let body: unknown;
    try {
      const init = buildLeadRequest(
        { ...values, website: honeypot.current?.value ?? "" },
        getChatHistory(),
      );
      const res = await fetch("/api/leads", { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      httpStatus = res.status;
      body = await res.json().catch(() => undefined);
    } catch {
      httpStatus = 0; // network failure or timeout
    }
    inFlight.current = false;

    const outcome = describeLeadResponse(httpStatus, body);
    if (outcome.ok) {
      setValues({ email: "", name: "", note: "" });
      setStatus("success");
      requestFocus("success");
      return;
    }
    setStatus("idle");
    if (outcome.field) {
      setErrors({ [outcome.field]: outcome.message });
      requestFocus(outcome.field);
    } else {
      setFormError(outcome.message);
      requestFocus("summary");
    }
  }

  if (status === "success") {
    return (
      <div className="space-y-4">
        <LeadNotice />
        <div
          ref={successRef}
          tabIndex={-1}
          role="status"
          data-testid="lead-success"
          className="space-y-3 rounded-card bg-success p-5 text-ink"
        >
          <h3 className="font-heading text-xl text-success-ink">Request received</h3>
          <p className="text-[0.9375rem] leading-relaxed text-ink">
            Your request was saved for this demo and will be deleted after 24 hours.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/leads"
              data-testid="lead-view-link"
              className="inline-flex min-h-11 items-center justify-center rounded-button bg-brand px-6 py-2.5 text-[0.9375rem] font-semibold text-canvas hover:bg-brand-strong"
            >
              View your request
            </Link>
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                requestFocus("email");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-button border-[1.5px] border-edge px-6 py-2.5 text-[0.9375rem] font-semibold text-ink hover:bg-surface"
            >
              Send another request
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sending = status === "sending";
  const describedBy = (field: LeadField, hint: string) =>
    errors[field] ? `lead-${field}-error ${hint}` : hint;
  const border = (field: LeadField) => (errors[field] ? "border-2 border-error-ink" : "border-[1.5px] border-edge");

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-5" aria-busy={sending}>
      <LeadNotice />

      <div>
        <label htmlFor="lead-email" className={labelClass}>
          Email address <span className="font-normal text-muted">(required)</span>
        </label>
        <input
          ref={emailRef}
          id="lead-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={MAX_EMAIL}
          placeholder="alex@example.com"
          data-testid="lead-email"
          value={values.email}
          onChange={onChange("email")}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={describedBy("email", "lead-email-hint")}
          className={`${fieldClass} ${border("email")}`}
        />
        <p id="lead-email-hint" className={hintClass}>
          Use a fake address. We will not send any email.
        </p>
        <FieldError id="lead-email-error" message={errors.email} />
      </div>

      <div>
        <label htmlFor="lead-name" className={labelClass}>
          Name <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          ref={nameRef}
          id="lead-name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={MAX_NAME}
          placeholder="Alex Morgan"
          data-testid="lead-name"
          value={values.name}
          onChange={onChange("name")}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "lead-name-error" : undefined}
          className={`${fieldClass} ${border("name")}`}
        />
        <FieldError id="lead-name-error" message={errors.name} />
      </div>

      <div>
        <label htmlFor="lead-note" className={labelClass}>
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          ref={noteRef}
          id="lead-note"
          name="note"
          rows={4}
          maxLength={MAX_NOTE}
          placeholder="What would you like help with?"
          data-testid="lead-note"
          value={values.note}
          onChange={onChange("note")}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={describedBy("note", "lead-note-hint")}
          className={`${fieldClass} ${border("note")} min-h-28 resize-y`}
        />
        <p id="lead-note-hint" className={hintClass}>
          Up to {MAX_NOTE} characters. Please do not include health details.
        </p>
        <FieldError id="lead-note-error" message={errors.note} />
      </div>

      {/* Honeypot: off-screen, hidden from assistive tech, skipped by the Tab key. Bots fill it. */}
      <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="lead-website">Leave this field empty</label>
        <input
          ref={honeypot}
          id="lead-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {/* Submit errors: a live region that is always mounted, so the text is announced when it appears. */}
      <div ref={summaryRef} tabIndex={-1} aria-live="assertive" data-testid="lead-error">
        {formError && (
          <p className="flex items-start gap-2 rounded-control bg-error px-3.5 py-3 text-[0.9375rem] font-medium text-error-ink">
            <ErrorIcon />
            <span className="min-w-0 break-words">
              <span className="font-semibold">Error:</span> {formError}
            </span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <button
          type="submit"
          disabled={sending}
          data-testid="lead-submit"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-button bg-brand px-8 py-3 text-[0.9375rem] font-semibold text-canvas hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-disabled disabled:text-canvas sm:w-auto"
        >
          {sending ? "Sending…" : "Send request"}
        </button>
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted">
          {sending ? "Sending your request." : ""}
        </p>
      </div>
    </form>
  );
}
