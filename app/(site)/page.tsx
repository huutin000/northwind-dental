import type { Metadata } from "next";
import Link from "next/link";
import { clinic } from "@/components/clinic";
import { HeroScene } from "@/components/illustrations/Decor";
import {
  serviceIcons,
  type ServiceName,
} from "@/components/illustrations/ServiceIcons";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Friendly dental care at Northwind Dental, a fictional demo clinic. See our services and book a visit.",
};

const featured: { name: ServiceName; text: string }[] = [
  {
    name: "Check-ups and cleaning",
    text: "A routine visit where the dentist looks at your teeth and gums and a hygienist cleans them.",
  },
  {
    name: "Fillings",
    text: "Treatment for small cavities: the decayed part is removed and the tooth is filled.",
  },
  {
    name: "Teeth whitening",
    text: "A whitening treatment planned with your dentist around your teeth and your goals.",
  },
];

const trust = [
  {
    title: "Explained first",
    text: "Your dentist tells you what they see and what it means before any treatment starts.",
  },
  {
    title: "At your pace",
    text: "Feeling anxious is common. Say so, and the team can explain each step and pause when you ask.",
  },
  {
    title: "Plans in writing",
    text: "You get the proposed treatment on paper, so you can read it before you decide.",
  },
];

const steps = [
  {
    title: "Tell us what you need",
    text: "Send a request on the contact page with your name and a short note about why you would like to visit.",
  },
  {
    title: "Meet your dentist",
    text: "The dentist looks at your teeth and gums, answers your questions and explains the findings in plain words.",
  },
  {
    title: "Agree a plan",
    text: "If treatment is needed, you receive a written plan and decide what happens next.",
  },
];

const buttonClass =
  "inline-flex min-h-12 items-center rounded-full bg-brand px-7 py-3 font-semibold text-canvas hover:bg-brand-strong";

export default function HomePage() {
  return (
    <div className="space-y-16 sm:space-y-20">
      <section className="grid items-center gap-8 overflow-hidden rounded-[2rem] bg-tint px-5 py-10 sm:px-10 md:grid-cols-[1.15fr_1fr] md:py-14">
        <div>
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl">
            Friendly dental care for the whole family
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted">
            Northwind Dental is a fictional clinic. Here you can see what a
            calm, clear dental website can look like.
          </p>
          <Link href="/contact" className={`mt-8 ${buttonClass}`}>
            Book an appointment
          </Link>
        </div>
        <HeroScene className="mx-auto h-auto w-full max-w-md md:translate-x-4" />
      </section>

      <section aria-labelledby="trust-heading">
        <h2 id="trust-heading" className="sr-only">
          How the team works
        </h2>
        <ul className="grid gap-6 border-y border-line py-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-line">
          {trust.map((t) => (
            <li key={t.title} className="md:px-6 md:first:pl-0 md:last:pr-0">
              <h3 className="text-lg font-semibold text-brand-strong">
                {t.title}
              </h3>
              <p className="mt-2 text-muted">{t.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="featured-heading">
        <h2
          id="featured-heading"
          className="text-3xl font-bold tracking-tight text-ink"
        >
          Featured services
        </h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((s) => {
            const Icon = serviceIcons[s.name];
            return (
              <li
                key={s.name}
                className="rounded-3xl border border-line bg-canvas p-6"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-tint text-brand">
                  <Icon className="h-11 w-11" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">
                  {s.name}
                </h3>
                <p className="mt-2 text-muted">{s.text}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-6">
          <Link
            href="/services"
            className="inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4 hover:text-brand-strong"
          >
            See all services
          </Link>
        </p>
      </section>

      <section
        aria-labelledby="steps-heading"
        className="grid gap-8 md:grid-cols-[1fr_1.4fr]"
      >
        <div>
          <h2
            id="steps-heading"
            className="text-3xl font-bold tracking-tight text-ink"
          >
            How your first visit works
          </h2>
          <p className="mt-3 max-w-sm text-muted">
            Three plain steps, from your first message to a plan you have
            agreed to.
          </p>
        </div>
        <ol className="space-y-6">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand font-heading text-lg font-bold text-canvas"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-5 md:grid-cols-[1fr_1.3fr]">
        <section
          aria-labelledby="hours-heading"
          className="rounded-3xl bg-tint-strong p-6 sm:p-8"
        >
          <h2
            id="hours-heading"
            className="text-2xl font-bold tracking-tight text-ink"
          >
            Opening hours
          </h2>
          <dl className="mt-4 space-y-3">
            {clinic.hours.map((h) => (
              <div key={h.days}>
                <dt className="font-semibold text-ink">{h.days}</dt>
                <dd className="text-muted">{h.time}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-muted">These hours are fictional.</p>
        </section>
        <div className="rounded-3xl bg-brand-strong p-6 text-canvas sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">
            Ready to book a visit?
          </h2>
          <p className="mt-3 max-w-md">
            Send a short request and say what you would like help with. In this
            demo the form does not send anything.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex min-h-12 items-center rounded-full bg-canvas px-7 py-3 font-semibold text-brand-strong hover:bg-tint-strong focus-visible:outline-canvas"
          >
            Book an appointment
          </Link>
        </div>
      </section>
    </div>
  );
}
