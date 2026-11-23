/**
 * Pure date and time helpers for the appointment pickers. No React, no Intl, no
 * locale: every string is English and every date is built from y/m/d parts, so
 * no time zone can shift a day.
 */

export const MONTH_NAMES = [
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
] as const;

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Two-letter column headers, Sunday first (matches the US-style "Dec 3, 2026" display format). */
export const WEEKDAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

/** First and last clinic hour shown in the hour grid (see clinic.hours in components/clinic.ts: 9:00 to 17:00). */
export const FIRST_HOUR = 9;
export const LAST_HOUR = 17;
export const MINUTE_STEPS: readonly number[] = [0, 15, 30, 45];

const MIN_YEAR = 1000;
const MAX_YEAR = 9999;

export type DateParts = { y: number; m: number; d: number };
export type GridDay = DateParts & { iso: string; inMonth: boolean };

const pad2 = (n: number) => String(n).padStart(2, "0");

export function toIso({ y, m, d }: DateParts): string {
  return `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}`;
}

/** True when y/m/d is a real calendar day inside the supported year range. */
function isRealDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || y < MIN_YEAR || y > MAX_YEAR) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** "2026-12-03" -> parts, or null when it is not a real date. */
export function parseIso(iso: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return isRealDate(y, m, d) ? { y, m, d } : null;
}

/** "2026-12-03" -> "Dec 3, 2026"; "" for anything that is not a real ISO date. */
export function formatDate(iso: string): string {
  const parts = parseIso(iso);
  if (!parts) return "";
  return `${MONTH_NAMES[parts.m - 1].slice(0, 3)} ${parts.d}, ${parts.y}`;
}

/** Month number (1-12) from a typed name: "dec", "Dec.", "DECEMBER", "sept". Needs at least 3 letters. */
function monthFromName(name: string): number | null {
  const lower = name.toLowerCase();
  if (lower.length < 3) return null;
  const index = MONTH_NAMES.findIndex((full) => full.toLowerCase().startsWith(lower));
  if (index !== -1) return index + 1;
  return lower === "sept" ? 9 : null;
}

/**
 * Typed text -> ISO "YYYY-MM-DD", or null. Accepts "Dec 3, 2026" (case-insensitive,
 * optional leading zero, optional comma and full stop) and "2026-12-03" (also "2026-2-3").
 */
export function parseDateInput(text: string): string | null {
  const t = text.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (iso) {
    const [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return isRealDate(y, m, d) ? toIso({ y, m, d }) : null;
  }
  const named = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(t);
  if (named) {
    const m = monthFromName(named[1]);
    const [d, y] = [Number(named[2]), Number(named[3])];
    return m !== null && isRealDate(y, m, d) ? toIso({ y, m, d }) : null;
  }
  return null;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function fromUtc(date: Date): DateParts {
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

/** Shift an ISO date by whole days. The input must be a valid ISO date (callers pass cursor values). */
export function addDays(iso: string, days: number): string {
  const p = parseIso(iso);
  if (!p) return iso;
  return toIso(fromUtc(new Date(Date.UTC(p.y, p.m - 1, p.d + days))));
}

/** Shift an ISO date by whole months, clamping the day (Jan 31 + 1 month = Feb 28 or 29). */
export function addMonths(iso: string, months: number): string {
  const p = parseIso(iso);
  if (!p) return iso;
  const first = new Date(Date.UTC(p.y, p.m - 1 + months, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth() + 1;
  return toIso({ y, m, d: Math.min(p.d, daysInMonth(y, m)) });
}

/** "Thursday, December 3, 2026": the accessible name of a day button. */
export function longDateLabel(iso: string): string {
  const p = parseIso(iso);
  if (!p) return "";
  const weekday = WEEKDAY_NAMES[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  return `${weekday}, ${MONTH_NAMES[p.m - 1]} ${p.d}, ${p.y}`;
}

/** Always 6 weeks (42 days), Sunday first, so the popover keeps one height from month to month. */
export function monthGrid(y: number, m: number): GridDay[] {
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days: GridDay[] = [];
  for (let i = 0; i < 42; i += 1) {
    const p = fromUtc(new Date(Date.UTC(y, m - 1, 1 - firstWeekday + i)));
    days.push({ ...p, iso: toIso(p), inMonth: p.m === m });
  }
  return days;
}

/** Today's date from the visitor's local clock, as ISO. Client-only (call it from an event handler). */
export function todayIso(now: Date = new Date()): string {
  return toIso({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

/** Typed text -> "HH:MM" (24-hour), or null. Accepts "9:30" and "09:30"; nothing outside 00:00-23:59. */
export function parseTimeInput(text: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [h, min] = [Number(match[1]), Number(match[2])];
  if (h > 23 || min > 59) return null;
  return `${pad2(h)}:${pad2(min)}`;
}

/** "10:30" -> { hour: 10, minute: 30 }; null for anything else. */
export function splitTime(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function joinTime(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

/** Only the closing hour (17) restricts minutes to :00; every other hour allows all steps (typed times outside clinic hours are accepted, nothing is enforced). */
export function isMinuteAllowed(hour: number, minute: number): boolean {
  return hour !== LAST_HOUR || minute === 0;
}
