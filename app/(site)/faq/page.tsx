import type { Metadata } from "next";
import { SparkleCluster } from "@/components/illustrations/Decor";
import { clinic } from "@/components/clinic";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about opening hours, services, costs, preparing for a visit and aftercare at Northwind Dental (fictional demo clinic).",
};

// TEMPORARY: this inline array is replaced by lib/faq/data.ts in Task 3.
const groups = [
  "Opening hours and booking",
  "Services",
  "Costs and insurance",
  "Before your visit",
  "Aftercare",
] as const;

type Group = (typeof groups)[number];

const faq: { group: Group; q: string; a: string }[] = [
  {
    group: "Opening hours and booking",
    q: "What are your opening hours?",
    a: `Our fictional clinic is open ${clinic.hoursSummary}`,
  },
  {
    group: "Opening hours and booking",
    q: "How do I book an appointment?",
    a: "Use the contact page. In this demo the form does not send anything.",
  },
  {
    group: "Opening hours and booking",
    q: "Can I change or cancel an appointment?",
    a: "Nothing is booked in this demo. At a real clinic you would contact the team as early as you can to move or cancel a visit.",
  },
  {
    group: "Services",
    q: "Which services do you offer?",
    a: "Check-ups, cleaning, fillings, whitening, root canal treatment, crowns and bridges, and children's dentistry.",
  },
  {
    group: "Services",
    q: "Do you treat children?",
    a: "Yes, our fictional clinic offers children's dentistry.",
  },
  {
    group: "Costs and insurance",
    q: "How much does a check-up cost?",
    a: "Demo note: prices here are made up. In a real clinic, the dentist would give you a written estimate before treatment.",
  },
  {
    group: "Costs and insurance",
    q: "Do you accept dental insurance?",
    a: "Demo note: this is a fictional answer. Many clinics work with insurers, so ask your provider what they cover.",
  },
  {
    group: "Before your visit",
    q: "What should I bring?",
    a: "Bring a photo ID, a list of your medicines, and any recent dental records you have.",
  },
  {
    group: "Before your visit",
    q: "What if I feel nervous about the visit?",
    a: "Tell the team when you book or when you arrive. They can explain each step and pause when you ask.",
  },
  {
    group: "Aftercare",
    q: "What should I do after a filling?",
    a: "Your dentist will explain what to do after a filling for your own situation. Contact your dentist if something does not feel right.",
  },
  {
    group: "Aftercare",
    q: "When should I contact the clinic after treatment?",
    a: "Get in touch if pain gets worse, if you notice swelling, or if something does not feel right. In an emergency, call your local emergency number.",
  },
];

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
        {groups.map((g, i) => (
          <section key={g} aria-labelledby={`faq-group-${i}`}>
            <h2
              id={`faq-group-${i}`}
              className="text-2xl font-bold text-brand-strong"
            >
              {g}
            </h2>
            <div className="mt-4 space-y-3">
              {faq
                .filter((item) => item.group === g)
                .map((item) => (
                  <details
                    key={item.q}
                    className="group rounded-2xl border border-line bg-canvas open:bg-tint"
                  >
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-3 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <Chevron />
                    </summary>
                    <p className="px-5 pb-4 text-muted">{item.a}</p>
                  </details>
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
