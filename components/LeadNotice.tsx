import { LEAD_NOTICE } from "@/lib/leads/leadRequest";

// The demo banner for the lead form and /leads. Uses the existing notice tokens
// (notice-ink on notice: 13.5, measured; see the contrast note in app/globals.css).
export default function LeadNotice() {
  return (
    <div
      role="note"
      data-testid="lead-notice"
      className="flex items-start gap-3 rounded-2xl border border-notice-ink/20 bg-notice/30 p-4 text-sm text-notice-ink"
    >
      <svg
        className="mt-0.5 size-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="min-w-0 break-words font-medium leading-relaxed">{LEAD_NOTICE}</p>
    </div>
  );
}
