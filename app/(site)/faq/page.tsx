import type { Metadata } from "next";
import { SparkleCluster } from "@/components/illustrations/Decor";
import { FAQ, FAQ_GROUPS } from "@/lib/faq/data";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about opening hours, services, costs, preparing for a visit and aftercare at Northwind Dental (fictional demo clinic).",
};

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="h-5 w-5 shrink-0 text-brand transition-transform group-open:rotate-180"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function FaqPage() {
  return (
    <div>
      <section className="flex items-center justify-between gap-6 rounded-[2rem] bg-tint px-5 py-8 sm:px-10">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-ink">
            Frequently asked questions
          </h1>
          <p className="mt-3 max-w-lg text-lg text-muted">
            Short answers to common questions. This is a demo, so the answers
            are general and fictional.
          </p>
        </div>
        <SparkleCluster className="hidden h-auto w-28 shrink-0 sm:block" />
      </section>
      <div className="mt-10 space-y-10">
        {FAQ_GROUPS.map((g, i) => (
          <section key={g} aria-labelledby={`faq-group-${i}`}>
            <h2
              id={`faq-group-${i}`}
              className="text-2xl font-bold text-brand-strong"
            >
              {g}
            </h2>
            <div className="mt-4 space-y-3">
              {FAQ
                .filter((item) => item.group === g)
                .map((item) => (
                  <details
                    key={item.id}
                    className="group rounded-2xl border border-line bg-canvas open:bg-tint"
                  >
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-3 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                      {item.question}
                      <Chevron />
                    </summary>
                    <p className="px-5 pb-4 text-muted">{item.answer}</p>
                  </details>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
