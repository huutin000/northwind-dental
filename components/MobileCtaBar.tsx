"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileCtaBar() {
  const pathname = usePathname();

  // If already on contact/booking page, don't crowd the view with a duplicate CTA
  if (pathname === "/contact") return null;

  return (
    <aside
      aria-label="Quick appointment action"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-canvas/95 px-4 py-2.5 backdrop-blur-md sm:hidden shadow-[0_-4px_16px_rgba(8,47,73,0.06)]"
    >
      <div className="flex items-center justify-between gap-3 pr-16">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-ink">Northwind Dental</p>
          <p className="truncate text-[11px] text-muted">Mon–Fri 9:00–17:00</p>
        </div>
        <Link
          href="/contact"
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-brand px-4 py-2 text-xs font-semibold text-canvas hover:bg-brand-strong active:scale-95 transition-all"
        >
          Book a visit
        </Link>
      </div>
    </aside>
  );
}

