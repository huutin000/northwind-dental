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
  { href: "/faq#faq-group-0", label: "Opening hours and booking" },
  { href: "/faq#faq-group-2", label: "Costs and insurance" },
  { href: "/faq#faq-group-3", label: "Before your visit" },
  { href: "/services", label: "What each visit involves" },
];

const linkClass =
  "inline-flex min-h-11 items-center rounded-control text-footer-ink underline-offset-4 hover:underline md:min-h-9";
const headingClass = "font-sans text-[0.9375rem] font-bold tracking-[0.02em] text-footer-ink";

export default function Footer() {
  return (
    <footer className="bg-footer pt-14 pb-[var(--chat-reserve)] text-footer-muted">
      <div className="page-wrap">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div className="space-y-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2.5 rounded-control font-heading text-[1.375rem] font-medium tracking-[-0.02em] text-footer-ink"
            >
              <ToothMark className="size-7 shrink-0 text-accent" />
              <span>{clinic.name}</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed">
              A fictional dental clinic website, built as a demo project.
            </p>
          </div>

          <nav aria-label="Footer navigation">
            <h2 className={headingClass}>Explore</h2>
            <ul className="mt-2 grid gap-1 text-sm">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Patient guides">
            <h2 className={headingClass}>Patient Care</h2>
            <ul className="mt-2 grid gap-1 text-sm">
              {clinicalTopics.map((t) => (
                <li key={t.label}>
                  <Link href={t.href} className={linkClass}>
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className={headingClass}>Visit Clinic</h2>
            <address className="mt-2 space-y-1 text-sm not-italic">
              <p className="text-footer-ink">{clinic.address}</p>
              <p>Phone: {clinic.phone}</p>
              <p className="break-words">Email: {clinic.email}</p>
            </address>
            <dl className="mt-4 space-y-1 text-sm">
              {clinic.hours.map((h) => (
                <div key={h.days} className="flex flex-wrap justify-between gap-x-4">
                  <dt>{h.days}</dt>
                  <dd className="text-footer-ink">{h.time}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-10 grid gap-1 border-t border-footer-muted/30 pt-5 text-sm">
          <p>Demo website. Northwind Dental is not a real clinic.</p>
          <p>Images on this site are AI-generated.</p>
          <p>© {new Date().getFullYear()} Northwind Dental</p>
        </div>
      </div>
    </footer>
  );
}
