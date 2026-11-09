import type { Metadata } from "next";
import Link from "next/link";
import { ToothbrushScene } from "@/components/illustrations/Decor";
import {
  serviceIcons,
  type ServiceName,
} from "@/components/illustrations/ServiceIcons";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Common dental services at Northwind Dental (fictional demo clinic): check-ups, cleaning, fillings, whitening, root canal care and more.",
};

const services: { name: ServiceName; text: string; expect: string }[] = [
  {
    name: "Check-ups and cleaning",
    text: "A full exam and a professional clean of your teeth and gums.",
    expect:
      "The dentist looks at your teeth and gums, then a hygienist cleans away plaque and tartar.",
  },
  {
    name: "Fillings",
    text: "Tooth-coloured fillings that repair small cavities.",
    expect:
      "The area is numbed, the decayed part is removed, and the tooth is rebuilt with filling material.",
  },
  {
    name: "Teeth whitening",
    text: "A cosmetic treatment that changes the shade of your teeth.",
    expect:
      "The dentist first checks your teeth and gums, then explains your options before anything starts.",
  },
  {
    name: "Root canal treatment",
    text: "Treatment for an infected tooth, working on the inside of the tooth.",
    expect:
      "The tooth is numbed, cleaned on the inside and sealed. The dentist tells you each step as it happens.",
  },
  {
    name: "Crowns and bridges",
    text: "Restorations for damaged or missing teeth: a crown covers a tooth, a bridge fills a gap.",
    expect:
      "The dentist shapes the tooth, takes an impression and fits a cover over the tooth.",
  },
  {
    name: "Children's dentistry",
    text: "Check-ups and treatment for young patients.",
    expect:
      "Children can look around and meet the team first. The dentist can show you the tools before using them.",
  },
];

export default function ServicesPage() {
  return (
    <div>
      <section className="grid items-center gap-6 rounded-[2rem] bg-tint px-5 py-8 sm:px-10 md:grid-cols-[1.4fr_1fr]">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-ink">
            Our services
          </h1>
          <p className="mt-3 max-w-lg text-lg text-muted">
            A short list of common treatments. This is a demo, so the details
            are simplified.
          </p>
        </div>
        <ToothbrushScene className="mx-auto h-auto w-full max-w-xs" />
      </section>

      <ul className="mt-10 space-y-5">
        {services.map((s) => {
          const Icon = serviceIcons[s.name];
          return (
            <li
              key={s.name}
              className="grid gap-5 rounded-3xl border border-line bg-canvas p-6 md:grid-cols-[1.2fr_1fr] md:items-center"
            >
              <div className="flex gap-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-tint text-brand">
                  <Icon className="h-11 w-11" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-ink">{s.name}</h2>
                  <p className="mt-2 text-muted">{s.text}</p>
                </div>
              </div>
              <p className="rounded-2xl bg-tint px-4 py-3 text-ink">
                <span className="font-semibold text-brand-strong">
                  What to expect:{" "}
                </span>
                {s.expect}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-10">
        <Link
          href="/contact"
          className="inline-flex min-h-12 items-center rounded-full bg-brand px-7 py-3 font-semibold text-canvas hover:bg-brand-strong"
        >
          Book an appointment
        </Link>
      </p>
    </div>
  );
}
