import Link from "next/link";
import { ToothMark } from "@/components/illustrations/Decor";
import { clinic } from "@/components/clinic";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/services", label: "All Dental Services" },
  { href: "/faq", label: "Patient FAQ" },
  { href: "/contact", label: "Contact & Appointments" },
];

const clinicalTopics = [
  { href: "/faq#faq-group-0", label: "Your First Visit" },
  { href: "/faq#faq-group-1", label: "Hygiene & Prevention" },
  { href: "/faq#faq-group-2", label: "Comfort & Restorations" },
  { href: "/services", label: "Treatment Expectations" },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-footer pb-[var(--chat-reserve)] text-footer-muted">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand & Demo Disclaimer */}
          <div className="md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 font-heading text-lg font-bold text-footer-ink">
              <span className="flex size-8 items-center justify-center rounded-lg bg-footer-ink text-footer p-1">
                <ToothMark className="size-5 shrink-0" />
              </span>
              <span>{clinic.name}</span>
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-footer-muted">
              A fictional boutique dental practice demo showcasing patient-centered design, clear treatment planning, and tranquil clinic spaces.
            </p>
            <div className="mt-4 rounded-xl border border-footer-muted/20 bg-footer-ink/5 p-3 text-[11px] leading-relaxed text-footer-muted">
              Demo project only. No real appointments or medical care provided.
            </div>
          </div>

          {/* Quick Navigation */}
          <nav aria-label="Footer navigation">
            <h2 className="font-heading text-sm font-semibold tracking-wider uppercase text-footer-ink">
              Explore
            </h2>
            <ul className="mt-3 space-y-2 text-xs">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex min-h-8 items-center hover:text-footer-ink underline-offset-4 hover:underline transition-colors focus-visible:outline-footer-ink"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Patient Guides */}
          <nav aria-label="Patient guides">
            <h2 className="font-heading text-sm font-semibold tracking-wider uppercase text-footer-ink">
              Patient Care
            </h2>
            <ul className="mt-3 space-y-2 text-xs">
              {clinicalTopics.map((t) => (
                <li key={t.label}>
                  <Link
                    href={t.href}
                    className="inline-flex min-h-8 items-center hover:text-footer-ink underline-offset-4 hover:underline transition-colors focus-visible:outline-footer-ink"
                  >
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Clinic Hours & Contact */}
          <div>
            <h2 className="font-heading text-sm font-semibold tracking-wider uppercase text-footer-ink">
              Visit Clinic
            </h2>
            <address className="mt-3 space-y-1.5 text-xs not-italic text-footer-muted">
              <p className="text-footer-ink font-medium">{clinic.address}</p>
              <p>Phone: {clinic.phone}</p>
              <p className="break-words">Email: {clinic.email}</p>
              <div className="mt-3 pt-3 border-t border-footer-muted/15">
                <p className="font-medium text-footer-ink">Hours:</p>
                <p className="mt-0.5">{clinic.hoursSummary}</p>
              </div>
            </address>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-footer-muted/15 pt-6 text-xs sm:flex-row">
          <p>© {new Date().getFullYear()} Northwind Dental. Fictional demo for portfolio review.</p>
          <div className="flex items-center gap-4">
            <Link href="/contact" className="hover:text-footer-ink underline-offset-4 hover:underline">
              Book consultation
            </Link>
            <span aria-hidden="true" className="text-footer-muted/40">•</span>
            <Link href="/faq" className="hover:text-footer-ink underline-offset-4 hover:underline">
              FAQ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
