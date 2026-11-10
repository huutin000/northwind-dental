import type { Metadata } from "next";
import Link from "next/link";
import { SparkleCluster } from "@/components/illustrations/Decor";
import FaqInteractive from "@/components/faq/FaqInteractive";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Clear, transparent answers to questions about booking, opening hours, dental fees, procedure durations, and post-visit aftercare at Northwind Dental.",
};

export default function FaqPage() {
  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Page Header */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-line bg-gradient-to-br from-tint via-canvas to-tint-strong p-6 sm:p-10 lg:p-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas/80 px-3.5 py-1.5 text-xs font-semibold text-brand backdrop-blur-sm">
              <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
              <span>Patient Knowledge Base</span>
            </div>

            <h1 className="font-heading text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Frequently Asked Questions
            </h1>

            <p className="text-sm sm:text-base text-muted leading-relaxed">
              Find instant answers about our appointments, fees, gentle hygiene methods, and what to expect during your first visit to Northwind Dental.
            </p>
          </div>

          <SparkleCluster className="hidden h-auto w-24 shrink-0 sm:block text-brand" />
        </div>
      </section>

      {/* Interactive FAQ with Search & Accordion */}
      <FaqInteractive />

      {/* Still have questions block */}
      <section className="rounded-3xl border border-line bg-tint-strong p-6 text-center sm:p-10">
        <h2 className="font-heading text-xl sm:text-2xl font-bold text-ink">
          Still have a question not covered here?
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-muted max-w-md mx-auto">
          Our virtual assistant is available 24/7 in the bottom-right corner, or you can send a note directly to our reception team.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 text-xs sm:text-sm font-semibold text-canvas hover:bg-brand-strong transition-all"
          >
            Contact our reception
          </Link>
          <Link
            href="/services"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-edge/60 bg-canvas px-6 text-xs sm:text-sm font-semibold text-ink hover:bg-tint transition-colors"
          >
            Review treatments
          </Link>
        </div>
      </section>
    </div>
  );
}
