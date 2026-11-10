import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import LeadNotice from "@/components/LeadNotice";
import { formatLeadDate } from "@/lib/leads/formatDate";
import { handleListLeads } from "@/lib/leads/handleLead";
import { getLeadStore } from "@/lib/leads/store";
import type { Lead } from "@/lib/leads/schema";
import { readSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Your requests",
  robots: { index: false, follow: false },
};

// Per visitor, never cached.
export const dynamic = "force-dynamic";

/**
 * This visitor's leads. Read-only: it never creates a session or sets a cookie.
 * No cookie, an invalid cookie or any store/session error gives an empty list and no error text.
 */
async function loadLeads(): Promise<Lead[]> {
  try {
    const cookieHeader = (await headers()).get("cookie") ?? "";
    const sessionId = readSession(new Request("http://localhost/leads", { headers: { cookie: cookieHeader } }));
    const result = await handleListLeads(sessionId, { store: getLeadStore() });
    return result.body.leads;
  } catch {
    return [];
  }
}

const CATEGORY_LABEL: Record<Lead["category"], string> = {
  booking: "Booking",
  pricing: "Pricing",
  other: "Other",
};

// Everything below is rendered as React text nodes: stored text is never trusted as markup.
export default async function LeadsPage() {
  const leads = await loadLeads();

  return (
    <div className="page-wrap pb-[clamp(3.5rem,8vw,6rem)] pt-[clamp(1.5rem,4vw,4.5rem)]">
      <div className="mx-auto grid max-w-2xl gap-6">
        <div className="grid justify-items-start gap-4">
          <p className="text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-brand motion-safe:animate-rise">
            This browser
          </p>
          <h1 className="text-[clamp(2.125rem,1.3rem+3.6vw,3.625rem)] leading-[1.08] text-ink">Your requests</h1>
          <p className="max-w-[52ch] text-[1.1875rem] leading-relaxed text-muted motion-safe:animate-rise motion-safe:[animation-delay:0.1s]">
            Requests sent from this browser during the last 24 hours.
          </p>
        </div>

        <LeadNotice />

        {leads.length === 0 ? (
          <div
            data-testid="lead-empty"
            className="grid min-w-0 justify-items-start gap-3 rounded-panel bg-sand p-[clamp(1.25rem,4vw,2rem)] text-ink"
          >
            <span className="grid size-12 place-items-center rounded-full bg-surface text-brand" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <path d="m4 8 8 6 8-6" />
              </svg>
            </span>
            <p className="font-heading text-2xl text-ink">No requests yet.</p>
            <p className="max-w-[46ch] leading-relaxed text-muted">
              Requests you send from the contact page show up here for 24 hours.
            </p>
            <Link
              href="/contact"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-button border-2 border-transparent bg-brand px-6 py-3 text-center font-semibold leading-tight text-canvas transition-colors hover:bg-brand-strong sm:w-auto"
            >
              Go to the contact form
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4">
            {leads.map((lead) => {
              const when = formatLeadDate(lead.createdAt);
              return (
                <li
                  key={lead.id}
                  data-testid="lead-list-item"
                  className="grid min-w-0 gap-3 rounded-card border border-line bg-surface p-5 shadow-soft"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="rounded-full bg-tint-strong px-3 py-1 font-semibold text-ink">
                      {CATEGORY_LABEL[lead.category] ?? "Other"}
                    </span>
                    {when && <span className="text-muted">{when}</span>}
                  </div>
                  <dl className="grid gap-3 text-[0.9375rem]">
                    <Row label="Email" value={lead.email} />
                    {lead.name && <Row label="Name" value={lead.name} />}
                    {lead.note && <Row label="Note" value={lead.note} />}
                    {lead.summary && <Row label="Chat summary" value={lead.summary} />}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-muted [overflow-wrap:anywhere] [unicode-bidi:isolate]">{value}</dd>
    </div>
  );
}
