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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">Your requests</h1>
        <p className="text-sm leading-relaxed text-muted sm:text-base">
          Requests sent from this browser during the last 24 hours.
        </p>
      </div>

      <LeadNotice />

      {leads.length === 0 ? (
        <div
          data-testid="lead-empty"
          className="space-y-3 rounded-2xl border border-line bg-tint p-5 text-ink"
        >
          <p className="font-semibold">No requests yet.</p>
          <p className="text-sm leading-relaxed text-muted">
            Requests you send from the contact page show up here for 24 hours.
          </p>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-canvas hover:bg-brand-strong"
          >
            Go to the contact form
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {leads.map((lead) => {
            const when = formatLeadDate(lead.createdAt);
            return (
              <li
                key={lead.id}
                data-testid="lead-list-item"
                className="min-w-0 space-y-3 rounded-2xl border border-line bg-canvas p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="rounded-full bg-tint-strong px-3 py-1 font-semibold text-ink">
                    {CATEGORY_LABEL[lead.category] ?? "Other"}
                  </span>
                  {when && <span className="text-muted">{when}</span>}
                </div>
                <dl className="space-y-2 text-sm">
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
