import { LEAD_NOTICE } from "@/lib/leads/leadRequest";

// The demo banner for the lead form and /leads. Uses the existing notice tokens
// (notice-ink on notice: 11.58, measured; see the contrast note in app/globals.css).
export default function LeadNotice() {
  return (
    <div
      role="note"
      data-testid="lead-notice"
      className="flex items-start gap-3 rounded-button border border-notice-line bg-notice px-3.5 py-3 text-[0.9375rem] text-notice-ink"
    >
      <svg
        className="mt-0.5 size-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="min-w-0 break-words font-medium leading-snug">{LEAD_NOTICE}</p>
    </div>
  );
}
