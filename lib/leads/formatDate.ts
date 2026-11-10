// Safe date text for stored leads. Stored values may be malformed (the store only checks Date.parse),
// so anything that is not a real ISO 8601 timestamp gives null and the caller omits the date.
// Built by hand from UTC fields (no Intl): the output is identical on every server and ICU build.

const ISO = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** "10 Nov 2026, 14:05 UTC", or null for anything that is not a valid ISO 8601 timestamp. */
export function formatLeadDate(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const m = ISO.exec(value);
  if (!m) return null;
  // The written calendar day must exist (a lenient parser would roll Feb 30 over to March).
  const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const written = new Date(Date.UTC(y, mo - 1, day));
  if (written.getUTCFullYear() !== y || written.getUTCMonth() !== mo - 1 || written.getUTCDate() !== day) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
