import type { Metadata } from "next";
import AppointmentForm from "@/components/AppointmentForm";
import { clinic } from "@/components/clinic";

export const metadata: Metadata = {
  title: "Request an appointment",
  description:
    "A demo appointment request form for Northwind Dental, a fictional clinic in Sampletown, with opening hours and contact details. Nothing is sent to a real clinic.",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// The first OPEN_DAYS weekday chips are open days (see hours in components/clinic.ts).
const OPEN_DAYS = 5;
const [openLine, closedLine] = clinic.hoursSummary.split(/(?<=\.)\s+/);
const dt = "text-muted";
const dd = "m-0 min-w-0 break-words font-semibold text-ink";

export default function ContactPage() {
  return (
    <div className="page-wrap pb-[clamp(3.5rem,8vw,6rem)] pt-[clamp(1.5rem,4vw,4.5rem)]">
      <div className="grid justify-items-start gap-4">
        <h1 className="text-[clamp(2.125rem,1.3rem+3.6vw,3.625rem)] leading-[1.08] text-ink">Request an appointment</h1>
        <p className="max-w-[52ch] text-[1.1875rem] leading-relaxed text-muted">
          Tell us what you need and when suits you. This is a demo, so nothing is sent to a real clinic.
        </p>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:mt-10 lg:grid-cols-[1.9fr_0.85fr] lg:gap-12">
        <section
          aria-labelledby="form-heading"
          className="min-w-0 rounded-panel border border-line bg-surface p-[clamp(1.25rem,4vw,3rem)] shadow-soft"
        >
          <h2 id="form-heading" className="sr-only">
            Appointment request form
          </h2>
          <AppointmentForm />
        </section>

        <div className="grid min-w-0 gap-6">
          <section aria-labelledby="hours-heading" className="grid gap-4 rounded-card bg-tint p-6">
            <h2 id="hours-heading" className="font-sans text-xl font-bold tracking-normal text-ink">
              Opening hours
            </h2>
            <ul aria-hidden="true" className="m-0 flex list-none gap-1.5 p-0">
              {DAYS.map((day, i) => (
                <li
                  key={day}
                  className={
                    i < OPEN_DAYS
                      ? "min-w-0 flex-1 rounded-control bg-tint-strong py-2.5 text-center text-xs font-bold text-ink sm:text-sm"
                      : "min-w-0 flex-1 rounded-control border border-dashed border-edge py-2.5 text-center text-xs text-muted sm:text-sm"
                  }
                >
                  {day}
                </li>
              ))}
            </ul>
            <p className="m-0 text-base font-bold text-ink">{openLine}</p>
            {closedLine ? <p className="m-0 text-base text-muted">{closedLine}</p> : null}
          </section>

          <section
            aria-labelledby="info-heading"
            className="grid gap-4 rounded-t-[12rem] rounded-b-card bg-sand px-6 pb-6 pt-[clamp(3rem,6vw,4.5rem)]"
          >
            <h2 id="info-heading" className="text-center font-sans text-xl font-bold tracking-normal text-ink">
              Find us
            </h2>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5">
              <dt className={dt}>Address</dt>
              <dd className={dd}>{clinic.address}</dd>
              <dt className={dt}>Phone</dt>
              <dd className={dd}>{clinic.phone}</dd>
              <dt className={dt}>Email</dt>
              <dd className={dd}>{clinic.email}</dd>
            </dl>
            <p className="m-0 text-sm text-muted">Fictional details for this demo.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
