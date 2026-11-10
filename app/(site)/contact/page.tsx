import type { Metadata } from "next";
import Image from "next/image";
import { clinic } from "@/components/clinic";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Contact & Appointments",
  description:
    "Request an appointment or reach out to Northwind Dental (fictional boutique clinic). Opening hours, address, and demo booking form.",
};

const eyebrow = "text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-brand";
const dl = "grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5";
const dt = "text-muted";
const dd = "m-0 min-w-0 break-words font-medium text-ink";

export default function ContactPage() {
  return (
    <div className="page-wrap pb-[clamp(3.5rem,8vw,6rem)] pt-[clamp(1.5rem,4vw,4.5rem)]">
      <div className="grid justify-items-start gap-4">
        <p className={`${eyebrow} motion-safe:animate-rise`}>Contact</p>
        <h1 className="text-[clamp(2.125rem,1.3rem+3.6vw,3.625rem)] leading-[1.08] text-ink">Book a visit</h1>
        <p className="max-w-[52ch] text-[1.1875rem] leading-relaxed text-muted motion-safe:animate-rise motion-safe:[animation-delay:0.1s]">
          Leave your details and tell us what you need. This is a demo, so please use a fake email.
        </p>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:mt-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        <section
          aria-labelledby="form-heading"
          className="grid min-w-0 gap-5 rounded-panel border border-line bg-surface p-[clamp(1.25rem,4vw,2rem)] shadow-soft"
        >
          <div>
            <h2 id="form-heading" className="text-2xl text-ink">
              Request an appointment
            </h2>
            <p className="mt-1 text-muted">
              Leave an email address and an optional note. This is a demo: nothing is sent to a real clinic.
            </p>
          </div>

          <LeadForm />
        </section>

        <div className="grid min-w-0 gap-4">
          <section aria-labelledby="hours-heading" className="grid gap-3 rounded-card bg-tint p-5.5">
            <h2 id="hours-heading" className="font-sans text-lg font-bold tracking-normal text-ink">
              Opening hours
            </h2>
            <dl className={dl}>
              {clinic.hours.map((h) => (
                <div key={h.days} className="contents">
                  <dt className={dt}>{h.days}</dt>
                  <dd className={dd}>{h.time}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="info-heading" className="grid gap-3 rounded-card bg-sand p-5.5">
            <h2 id="info-heading" className="font-sans text-lg font-bold tracking-normal text-ink">
              Find us
            </h2>
            <dl className={dl}>
              <dt className={dt}>Address</dt>
              <dd className={dd}>{clinic.address}</dd>
              <dt className={dt}>Phone</dt>
              <dd className={dd}>{clinic.phone}</dd>
              <dt className={dt}>Email</dt>
              <dd className={dd}>{clinic.email}</dd>
            </dl>
            <p className="text-sm text-muted">Fictional details for this demo.</p>
          </section>

          <Image
            src="/images/waiting-lounge.webp"
            alt="A bright imaging room with two scanners, a light oak wall and a window"
            width={1376}
            height={768}
            loading="lazy"
            sizes="(min-width: 1160px) 440px, (min-width: 1024px) 42vw, 100vw"
            className="aspect-[4/3] w-full rounded-panel bg-tint-strong object-cover shadow-lift"
          />
        </div>
      </div>
    </div>
  );
}
