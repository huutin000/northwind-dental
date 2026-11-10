import type { Metadata } from "next";
import Link from "next/link";
import {
  ChildIcon,
  CleaningIcon,
  CrownIcon,
  FillingIcon,
  RootCanalIcon,
  WhiteningIcon,
} from "@/components/illustrations/ServiceIcons";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Check-ups, cleaning, fillings, whitening, root canal treatment, crowns and bridges, and children's dentistry at Northwind Dental.",
};

type DentalService = {
  id: string;
  name: string;
  summary: string;
  expectSteps: string[];
  Icon: (props: { className?: string }) => React.JSX.Element;
};

const servicesList: DentalService[] = [
  {
    id: "cleaning",
    name: "Cleaning",
    summary: "A scale and polish, with time to ask about your routine at home.",
    expectSteps: [
      "We look at your teeth and gums and talk through what we see.",
      "We remove plaque and tartar with hand and ultrasonic instruments.",
      "We polish your teeth and answer questions about brushing and flossing.",
    ],
    Icon: CleaningIcon,
  },
  {
    id: "fillings",
    name: "Tooth-coloured fillings",
    summary: "Your dentist explains the steps and the materials before the work begins.",
    expectSteps: [
      "Your dentist looks at the tooth and talks through the options.",
      "The tooth is prepared, and numbing is discussed with you beforehand.",
      "The filling material is placed in layers, then we check your bite.",
    ],
    Icon: FillingIcon,
  },
  {
    id: "whitening",
    name: "Whitening",
    summary: "We go through shade options and how a session works before you decide.",
    expectSteps: [
      "We look at your teeth and any existing fillings or crowns.",
      "We talk through the options, such as trays or a chairside session.",
      "We explain how the treatment works and what to do afterwards.",
    ],
    Icon: WhiteningIcon,
  },
  {
    id: "root-canal",
    name: "Root canal treatment",
    summary: "This treatment works on the inside of a tooth. We explain what it involves before we start.",
    expectSteps: [
      "Your dentist looks at the tooth and explains each stage.",
      "The area is numbed, and the inside of the tooth is cleaned and shaped.",
      "The tooth is sealed, and we explain what comes next.",
    ],
    Icon: RootCanalIcon,
  },
  {
    id: "crowns",
    name: "Crowns and bridges",
    summary: "A crown covers a tooth and a bridge spans a gap. We talk through the options first.",
    expectSteps: [
      "We look at your teeth and talk through the options.",
      "We take impressions, and a temporary crown may be fitted.",
      "At a later visit we check the fit and your bite before fixing the final piece.",
    ],
    Icon: CrownIcon,
  },
  {
    id: "pediatric",
    name: "Children's dentistry",
    summary: "Visits for younger patients, with each step explained in simple words.",
    expectSteps: [
      "We say hello and show your child the chair and the tools.",
      "We look at your child's teeth and count them together.",
      "We talk with parents about brushing at home.",
    ],
    Icon: ChildIcon,
  },
];

const eyebrow = "text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-brand";
const h2 = "text-[clamp(1.75rem,1.1rem+2.2vw,2.5rem)] leading-[1.15] text-ink";
const lead = "max-w-[52ch] text-[1.1875rem] leading-relaxed text-muted";
const btn =
  "inline-flex min-h-12 w-full items-center justify-center rounded-button border-2 px-6 py-3 text-center font-semibold leading-tight transition-colors sm:w-auto";
const btnPrimary = `${btn} border-transparent bg-brand text-canvas hover:bg-brand-strong`;
const btnPeach = `${btn} border-transparent bg-peach text-ink hover:bg-peach-strong`;
const band = "py-[clamp(3.5rem,9vw,7rem)]";

export default function ServicesPage() {
  return (
    <>
      <section className="pb-[clamp(2rem,5vw,3.5rem)] pt-[clamp(1.5rem,4vw,4.5rem)]">
        <div className="page-wrap grid justify-items-start gap-4">
          <p className={`${eyebrow} motion-safe:animate-rise`}>Services</p>
          <h1 className="text-[clamp(2.125rem,1.3rem+3.6vw,3.625rem)] leading-[1.08] text-ink">Our services</h1>
          <p className={`${lead} motion-safe:animate-rise motion-safe:[animation-delay:0.1s]`}>
            Check-ups, cleaning, fillings, whitening, root canal treatment, crowns and bridges, and children&apos;s
            dentistry. We explain each step before we begin, and we go through costs with you first.
          </p>
        </div>
      </section>

      <div className={`bg-sand ${band}`}>
        <div className="page-wrap grid gap-4 lg:grid-cols-2">
          {servicesList.map(({ id, name, summary, expectSteps, Icon }) => (
            <article
              key={id}
              id={id}
              className="grid content-start gap-4 rounded-card border border-line bg-surface p-6 shadow-soft sm:p-7"
            >
              <div className="flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-button bg-tint text-brand">
                  <Icon className="size-[26px]" />
                </span>
                <h2 className="text-2xl leading-tight text-ink">{name}</h2>
              </div>
              <p className="text-muted">{summary}</p>
              <div className="rounded-control bg-tint p-4">
                <h3 className="font-sans text-base font-bold tracking-normal text-ink">What a visit involves</h3>
                <ul className="mt-2.5 grid gap-2">
                  {expectSteps.map((step) => (
                    <li key={step} className="flex items-start gap-2.5 text-ink">
                      <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <Link
                  href="/contact"
                  className="inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4 hover:text-brand-strong"
                >
                  Book this visit
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      <section className={band} aria-labelledby="services-cta-heading">
        <div className="page-wrap">
          <div className="relative isolate grid justify-items-start gap-4 overflow-hidden rounded-panel bg-tint-strong p-[clamp(1.75rem,6vw,4rem)] after:absolute after:-bottom-20 after:-right-15 after:-z-10 after:size-55 after:rounded-full after:bg-wash">
            <h2 id="services-cta-heading" className={h2}>
              Not sure which visit you need?
            </h2>
            <p className="max-w-[52ch] text-[1.1875rem] leading-relaxed text-ink">
              Tell us what you need and we will plan your visit around it. The FAQ covers hours, booking and costs.
            </p>
            <div className="mt-1.5 flex w-full flex-wrap gap-3">
              <Link href="/contact" className={btnPrimary}>
                Book a visit
              </Link>
              <Link href="/faq" className={btnPeach}>
                Read the FAQ
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
