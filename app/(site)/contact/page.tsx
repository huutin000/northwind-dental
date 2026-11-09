import type { Metadata } from "next";
import { clinic } from "@/components/clinic";
import {
  MapIllustration,
  AppointmentScene,
} from "@/components/illustrations/Decor";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Northwind Dental (fictional demo clinic). The form is a demo shell and does not send anything.",
};

const inputClass =
  "mt-1 block min-h-11 w-full rounded-xl border border-edge bg-canvas px-3 py-2 text-ink";

export default function ContactPage() {
  return (
    <div>
      <section className="grid items-center gap-6 rounded-[2rem] bg-tint px-5 py-8 sm:px-10 md:grid-cols-2">
        <h1 className="text-4xl font-bold tracking-tight text-ink">
          Contact us
        </h1>
        <AppointmentScene className="mx-auto h-auto w-full max-w-xs" />
      </section>
      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section aria-labelledby="form-heading">
          <h2
            id="form-heading"
            className="text-2xl font-bold text-brand-strong"
          >
            Request an appointment
          </h2>
          <p
            role="note"
            className="mt-3 rounded-xl bg-notice px-4 py-3 text-sm text-notice-ink"
          >
            This is a demo. Please use a fake email. Data is deleted after 24
            hours.
          </p>
          {/* Non-functional shell: no action, no submit handler. Wired up in a later task. */}
          <form className="mt-4 space-y-4" noValidate>
            <div>
              <label htmlFor="lead-email" className="font-semibold text-ink">
                Email
              </label>
              <input
                id="lead-email"
                name="email"
                type="email"
                autoComplete="off"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="lead-name" className="font-semibold text-ink">
                Name
              </label>
              <input
                id="lead-name"
                name="name"
                type="text"
                autoComplete="off"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="lead-note" className="font-semibold text-ink">
                Note
              </label>
              <textarea
                id="lead-note"
                name="note"
                rows={4}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled
              className="min-h-12 rounded-full bg-disabled px-6 py-3 font-semibold text-canvas disabled:cursor-not-allowed"
            >
              Send request (not available in this demo)
            </button>
          </form>
        </section>

        <div className="space-y-6">
          <section
            aria-labelledby="info-heading"
            className="rounded-3xl bg-tint-strong p-6 sm:p-8"
          >
            <h2
              id="info-heading"
              className="text-2xl font-bold text-brand-strong"
            >
              Clinic information
            </h2>
            <p className="mt-3 text-sm text-muted">
              All details below are fictional.
            </p>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="font-semibold text-ink">Address</dt>
                <dd className="text-muted">{clinic.address} (fictional)</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Phone</dt>
                <dd className="text-muted">{clinic.phone} (fictional)</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Email</dt>
                <dd className="break-words text-muted">
                  {clinic.email} (fictional)
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Opening hours</dt>
                <dd className="text-muted">
                  {clinic.hoursSummary} (fictional)
                </dd>
              </div>
            </dl>
          </section>
          <figure>
            <MapIllustration className="h-auto w-full" />
            <figcaption className="mt-2 text-sm text-muted">
              Illustrative map of a fictional location. It does not show a real
              place.
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  );
}
