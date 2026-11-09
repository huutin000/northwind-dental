import Link from "next/link";
import { ToothMark } from "@/components/illustrations/Decor";
import { clinic } from "@/components/clinic";

const pages = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

const linkClass =
  "inline-flex min-h-11 items-center rounded underline underline-offset-4 hover:text-footer-ink focus-visible:outline-canvas";

export default function Footer() {
  return (
    <footer className="bg-footer pb-[var(--chat-reserve)] text-footer-muted">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 text-sm sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1.2fr]">
        <div>
          <p className="flex items-center gap-3 font-heading text-lg font-bold text-footer-ink">
            <ToothMark className="h-9 w-9 shrink-0 rounded-lg bg-footer-ink p-1.5" />
            {clinic.name} (fictional)
          </p>
          <p className="mt-3 max-w-xs">
            This is a demo project, not a real clinic. All names, contact
            details and prices on this site are made up.
          </p>
        </div>
        <nav aria-label="Footer">
          <h2 className="text-base font-semibold text-footer-ink">Pages</h2>
          <ul className="mt-2">
            {pages.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="text-base font-semibold text-footer-ink">Visit us</h2>
          <address className="mt-2 space-y-1 not-italic">
            <p>{clinic.address} (fictional)</p>
            <p>{clinic.phone} (fictional)</p>
            <p className="break-words">{clinic.email} (fictional)</p>
            <p>{clinic.hoursSummary}</p>
          </address>
        </div>
      </div>
    </footer>
  );
}
