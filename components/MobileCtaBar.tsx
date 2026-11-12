"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileCtaBar() {
  const pathname = usePathname();

  // If already on contact/booking page, don't crowd the view with a duplicate CTA
  if (pathname === "/contact") return null;

  // data-mobile-cta lets globals.css lift the chat toggle above this bar (--chat-bottom).
  return (
    <aside
      aria-label="Quick appointment action"
      data-mobile-cta=""
      className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-line bg-surface/95 px-[max(1rem,env(safe-area-inset-left))] pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md mobile-bar:block"
    >
      <Link
        href="/contact"
        className="flex min-h-12 w-full items-center justify-center rounded-button bg-brand px-6 font-semibold text-canvas transition-colors hover:bg-brand-strong"
      >
        Book a visit
      </Link>
    </aside>
  );
}
