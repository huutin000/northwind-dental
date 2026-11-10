import type { Metadata } from "next";
import { clinic } from "@/components/clinic";
import LeadForm from "@/components/LeadForm";
import { MapIllustration } from "@/components/illustrations/Decor";

export const metadata: Metadata = {
  title: "Contact & Appointments",
  description:
    "Request an appointment or reach out to Northwind Dental (fictional boutique clinic). Opening hours, address, and demo booking form.",
};

export default function ContactPage() {
  return (
    <div className="space-y-12 sm:space-y-16">
      {/* Page Header */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-line bg-gradient-to-br from-tint via-canvas to-tint-strong p-6 sm:p-10 lg:p-12">
        <div className="max-w-xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas/80 px-3.5 py-1.5 text-xs font-semibold text-brand backdrop-blur-sm">
            <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
            <span>Connect & Visit</span>
          </div>

          <h1 className="font-heading text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Get in Touch
          </h1>

          <p className="text-sm sm:text-base text-muted leading-relaxed">
            We are located in the heart of Sampletown. Use the form below to leave a request, or see the phone number and hours for reception.
          </p>
        </div>
      </section>

      {/* Main Grid: Form (Col 1) and Info + Map (Col 2) */}
      <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
        {/* Left Column: Booking Request Form (7 cols) */}
        <section
          aria-labelledby="form-heading"
          className="min-w-0 lg:col-span-7 rounded-3xl border border-line bg-canvas p-6 sm:p-8 shadow-sm space-y-6"
        >
          <div>
            <h2 id="form-heading" className="font-heading text-2xl font-bold text-ink">
              Request an Appointment
            </h2>
            <p className="mt-1 text-xs text-muted">
              Leave an email address and an optional note. This is a demo: nothing is sent to a real clinic.
            </p>
          </div>

          <LeadForm />
        </section>

        {/* Right Column: Clinic Information, Hours & Map (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Clinic Details Box */}
          <section
            aria-labelledby="info-heading"
            className="rounded-3xl border border-line bg-tint/60 p-6 sm:p-8 space-y-5"
          >
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                Northwind Dental
              </span>
              <h2 id="info-heading" className="mt-1 font-heading text-xl font-bold text-ink">
                Clinic Location & Hours
              </h2>
            </div>

            <dl className="space-y-3.5 text-xs">
              <div className="flex items-start gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-canvas text-brand shadow-sm">
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Address</dt>
                  <dd className="text-muted mt-0.5">{clinic.address} (fictional)</dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-canvas text-brand shadow-sm">
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Telephone</dt>
                  <dd className="text-muted mt-0.5">{clinic.phone} (fictional)</dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-canvas text-brand shadow-sm">
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Email</dt>
                  <dd className="text-muted mt-0.5 break-all">{clinic.email} (fictional)</dd>
                </div>
              </div>

              <div className="pt-2 border-t border-line">
                <dt className="font-semibold text-ink mb-2">Weekly Schedule</dt>
                <dd className="space-y-1.5">
                  {clinic.hours.map((h) => (
                    <div key={h.days} className="flex justify-between text-muted">
                      <span>{h.days}:</span>
                      <span className="font-medium text-ink">{h.time}</span>
                    </div>
                  ))}
                </dd>
              </div>
            </dl>
          </section>

          {/* Map Illustration */}
          <figure className="overflow-hidden rounded-3xl border border-line bg-canvas p-4 shadow-sm">
            <div className="relative overflow-hidden rounded-2xl bg-tint-strong">
              <MapIllustration className="h-auto w-full object-cover" />
            </div>
            <figcaption className="mt-3 text-center text-xs text-muted">
              Sampletown clinical precinct map. Fictional location for demonstration.
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  );
}
