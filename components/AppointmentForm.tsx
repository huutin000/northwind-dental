"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { clinic } from "@/components/clinic";

/**
 * Front-end SIMULATION of an appointment request. It sends nothing: no network
 * call, no storage, no logging. The "sending" state is a timer only.
 */

const SERVICES = [
  "Check-up",
  "Cleaning",
  "Filling",
  "Whitening",
  "Root canal",
  "Crowns and bridges",
  "Children's dentistry",
] as const;

const SENDING_MS = 1200;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Values = { name: string; phone: string; email: string; service: string; date: string; time: string; notes: string };
type ErrorKey = "name" | "phone" | "email" | "service" | "when";
type Errors = Partial<Record<ErrorKey, string>>;
type Status = "idle" | "sending" | "done";

const EMPTY: Values = { name: "", phone: "", email: "", service: "", date: "", time: "", notes: "" };

const MESSAGES: Record<ErrorKey, string> = {
  name: "Enter your full name.",
  phone: "Enter a phone number with at least 7 digits.",
  email: "Enter an email address like name@example.com.",
  service: "Choose a service.",
  when: "Pick a preferred date and time.",
};

function validate(v: Values): Errors {
  const errors: Errors = {};
  if (v.name.trim() === "") errors.name = MESSAGES.name;
  if (v.phone.replace(/\D/g, "").length < 7) errors.phone = MESSAGES.phone;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) errors.email = MESSAGES.email;
  if (v.service === "") errors.service = MESSAGES.service;
  if (v.date === "" || v.time === "") errors.when = MESSAGES.when;
  return errors;
}

/** "2026-12-03" + "10:30" -> "Thursday 3 December, 10:30", built from the parts (no time zone involved). */
function formatPreferred(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return `${date}, ${time}`;
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${MONTHS[m - 1]}, ${time}`;
}

const inputBase =
  "block min-h-12 w-full rounded-control bg-surface px-3.5 py-3 text-base text-ink placeholder:text-muted";
const labelClass = "block text-[0.9375rem] font-semibold text-ink";
const hintClass = "font-normal text-muted";
const legendClass = "mb-4 w-full border-b border-line pb-3 font-heading text-2xl text-ink";

function ErrorIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false" className="mt-px shrink-0">
      <circle cx="10" cy="10" r="10" className="fill-error-ink" />
      <path d="M10 5.5v5.5" className="stroke-surface" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="14.4" r="1.2" className="fill-surface" />
    </svg>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-2 text-[0.9375rem] leading-snug text-error-ink">
      <ErrorIcon />
      <span>{message}</span>
    </p>
  );
}

export default function AppointmentForm() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [submitted, setSubmitted] = useState<Values | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusNameOnIdle = useRef(false);
  // Count fixed at submit time, so the banner does not change while the visitor edits.
  const [bannerCount, setBannerCount] = useState(0);
  // Focus request, applied in an effect after React has committed aria-invalid and the error text.
  const [focusReq, setFocusReq] = useState<{ id: string; n: number } | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (status === "done") successRef.current?.focus();
    if (status === "idle" && focusNameOnIdle.current) {
      focusNameOnIdle.current = false;
      formRef.current?.querySelector<HTMLElement>("#appt-name")?.focus();
    }
  }, [status]);

  useEffect(() => {
    if (!focusReq) return;
    formRef.current?.querySelector<HTMLElement>(`#${focusReq.id}`)?.focus();
  }, [focusReq]);

  const errorCount = Object.keys(errors).length;
  // Only the empty input(s) of the date-and-time pair are flagged.
  const whenFlag = { date: Boolean(errors.when) && values.date === "", time: Boolean(errors.when) && values.time === "" };
  const busy = status === "sending";

  function setField(key: keyof Values, errorKey?: ErrorKey) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setValues((prev) => ({ ...prev, [key]: value }));
      if (errorKey) {
        setErrors((prev) => {
          if (!(errorKey in prev)) return prev;
          const next = { ...prev };
          delete next[errorKey];
          return next;
        });
      }
    };
  }

  function onWhenChange(key: "date" | "time") {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      const other = key === "date" ? values.time : values.date;
      setValues((prev) => ({ ...prev, [key]: value }));
      if (value !== "" && other !== "") {
        setErrors((prev) => {
          if (!prev.when) return prev;
          const next = { ...prev };
          delete next.when;
          return next;
        });
      }
    };
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const found = validate(values);
    setErrors(found);
    setBannerCount(Object.keys(found).length);
    if (Object.keys(found).length > 0) {
      const firstId = found.name
        ? "appt-name"
        : found.phone
          ? "appt-phone"
          : found.email
            ? "appt-email"
            : found.service
              ? "appt-service"
              : values.date === ""
                ? "appt-date"
                : "appt-time";
      setFocusReq((p) => ({ id: firstId, n: (p?.n ?? 0) + 1 }));
      return;
    }
    setSubmitted(values);
    setStatus("sending");
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setStatus("done");
    }, SENDING_MS);
  }

  function reset() {
    setValues(EMPTY);
    setErrors({});
    setBannerCount(0);
    setSubmitted(null);
    focusNameOnIdle.current = true;
    setStatus("idle");
  }

  if (status === "done" && submitted) {
    const recap: Array<[string, string]> = [
      ["Name", submitted.name.trim()],
      ["Service", submitted.service],
      ["Preferred", formatPreferred(submitted.date, submitted.time)],
      ["Contact", submitted.email.trim()],
    ];
    return (
      <div
        ref={successRef}
        role="status"
        tabIndex={-1}
        className="grid gap-5 rounded-card bg-success p-[clamp(1.25rem,3vw,1.75rem)] text-success-ink outline-offset-4"
      >
        <h3 className="font-heading text-2xl text-success-ink">Request received (demo)</h3>
        <p className="max-w-[56ch] text-base leading-relaxed">
          Nothing was sent and nobody will call you. This is a demo, so no real clinic received this request.
        </p>
        <dl className="m-0 grid gap-3 border-t border-success-ink/25 pt-4 sm:grid-cols-[auto_1fr] sm:gap-x-5 sm:gap-y-2">
          {recap.map(([term, detail]) => (
            <div key={term} className="grid gap-0.5 sm:contents">
              <dt>{term}</dt>
              <dd className="m-0 min-w-0 break-words font-semibold">{detail}</dd>
            </div>
          ))}
        </dl>
        <div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-12 items-center justify-center rounded-button border-[1.5px] border-success-ink bg-surface px-6 py-3 text-[0.9375rem] font-semibold text-ink hover:bg-canvas"
          >
            Make another request
          </button>
        </div>
      </div>
    );
  }

  const border = (key: ErrorKey) => (errors[key] ? "border-2 border-error-ink" : "border-[1.5px] border-edge");
  const invalid = (key: ErrorKey) => (errors[key] ? true : undefined);
  const describe = (key: ErrorKey, id: string) => (errors[key] ? id : undefined);

  return (
    <>
    <form ref={formRef} noValidate onSubmit={onSubmit} aria-busy={busy} className="grid gap-8">
      {errorCount > 0 && bannerCount > 0 ? (
        <div role="alert" className="rounded-card bg-error px-5 py-4 text-[1.0625rem] font-semibold text-error-ink">
          {bannerCount === 1
            ? "Check the field marked below, then send your request again."
            : `Check the ${bannerCount} fields marked below, then send your request again.`}
        </div>
      ) : null}

      <fieldset disabled={busy} className="m-0 grid min-w-0 gap-5 border-0 p-0">
        <legend className={legendClass}>About you</legend>
        <div>
          <label htmlFor="appt-name" className={labelClass}>
            Full name
          </label>
          <input
            id="appt-name"
            type="text"
            autoComplete="name"
            value={values.name}
            onChange={setField("name", "name")}
            aria-invalid={invalid("name")}
            aria-describedby={describe("name", "appt-name-error")}
            className={`${inputBase} mt-2 ${border("name")}`}
          />
          <FieldError id="appt-name-error" message={errors.name} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="appt-phone" className={labelClass}>
              Phone
            </label>
            <input
              id="appt-phone"
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={setField("phone", "phone")}
              aria-invalid={invalid("phone")}
              aria-describedby={describe("phone", "appt-phone-error")}
              className={`${inputBase} mt-2 ${border("phone")}`}
            />
            <FieldError id="appt-phone-error" message={errors.phone} />
          </div>
          <div className="min-w-0">
            <label htmlFor="appt-email" className={labelClass}>
              Email
            </label>
            <input
              id="appt-email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={setField("email", "email")}
              aria-invalid={invalid("email")}
              aria-describedby={describe("email", "appt-email-error")}
              className={`${inputBase} mt-2 ${border("email")}`}
            />
            <FieldError id="appt-email-error" message={errors.email} />
          </div>
        </div>
      </fieldset>

      <fieldset disabled={busy} className="m-0 grid min-w-0 gap-5 border-0 p-0">
        <legend className={legendClass}>Your visit</legend>
        <div>
          <label htmlFor="appt-service" className={labelClass}>
            Service
          </label>
          <select
            id="appt-service"
            value={values.service}
            onChange={setField("service", "service")}
            aria-invalid={invalid("service")}
            aria-describedby={describe("service", "appt-service-error")}
            className={`${inputBase} mt-2 ${border("service")}`}
          >
            <option value="">Choose a service</option>
            {SERVICES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <FieldError id="appt-service-error" message={errors.service} />
        </div>
        <div>
          <div className="grid gap-5 sm:grid-cols-2 sm:items-end">
            <div className="min-w-0">
              <label htmlFor="appt-date" className={labelClass}>
                Preferred date
              </label>
              <input
                id="appt-date"
                type="date"
                value={values.date}
                onChange={onWhenChange("date")}
                aria-invalid={whenFlag.date ? true : undefined}
                aria-describedby={whenFlag.date ? "appt-when-error" : undefined}
                className={`${inputBase} mt-2 ${whenFlag.date ? "border-2 border-error-ink" : "border-[1.5px] border-edge"}`}
              />
            </div>
            <div className="min-w-0">
              {/* min/max below are a literal copy of the hours in components/clinic.ts: a picker hint, nothing is enforced. */}
              <label htmlFor="appt-time" className={labelClass}>
                Preferred time <span className={hintClass}>(open {clinic.hours[0].time})</span>
              </label>
              <input
                id="appt-time"
                type="time"
                min="09:00"
                max="17:00"
                value={values.time}
                onChange={onWhenChange("time")}
                aria-invalid={whenFlag.time ? true : undefined}
                aria-describedby={whenFlag.time ? "appt-when-error" : undefined}
                className={`${inputBase} mt-2 ${whenFlag.time ? "border-2 border-error-ink" : "border-[1.5px] border-edge"}`}
              />
            </div>
          </div>
          <FieldError id="appt-when-error" message={errors.when} />
        </div>
        <div>
          <label htmlFor="appt-notes" className={labelClass}>
            Notes <span className={hintClass}>(optional)</span>
          </label>
          <textarea
            id="appt-notes"
            rows={4}
            value={values.notes}
            onChange={setField("notes")}
            className={`${inputBase} mt-2 min-h-32 border-[1.5px] border-edge`}
          />
        </div>
      </fieldset>

      <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-12 sm:min-w-[14rem] items-center justify-center gap-2.5 rounded-button bg-brand px-8 py-3 text-base font-semibold text-canvas hover:bg-brand-strong disabled:cursor-not-allowed disabled:bg-disabled disabled:text-canvas"
        >
          {busy ? (
            <>
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
                focusable="false"
                className="motion-safe:animate-spin"
              >
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Sending request
            </>
          ) : (
            "Send request"
          )}
        </button>
        <p className="flex items-start gap-2.5 rounded-control border border-notice-line bg-notice px-4 py-3 text-[0.9375rem] leading-snug text-notice-ink">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false" className="mt-px shrink-0">
            <circle cx="10" cy="10" r="8.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 9v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="10" cy="6.3" r="1" fill="currentColor" />
          </svg>
          <span>Demo only. This form does not send anything.</span>
        </p>
      </div>
    </form>
    <p role="status" className="sr-only">
      {busy ? "Sending request" : ""}
    </p>
    </>
  );
}
