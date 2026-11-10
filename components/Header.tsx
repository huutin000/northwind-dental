"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToothMark } from "@/components/illustrations/Decor";

const links = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-md transition-all duration-200 ${
        scrolled ? "py-1.5 shadow-sm" : "py-2.5 sm:py-3.5"
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-brand"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-tint text-brand group-hover:bg-tint-strong transition-colors">
            <ToothMark className="size-6 shrink-0" />
          </span>
          <div className="flex flex-col">
            <span className="font-heading text-lg font-bold leading-tight tracking-tight text-ink">
              Northwind Dental
            </span>
            <span className="text-[11px] font-medium tracking-wider uppercase text-muted">
              Boutique Clinic
            </span>
          </div>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <ul className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            {links.map(({ href, label }) => {
              const current = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex min-h-10 items-center rounded-full px-3 text-xs sm:text-sm font-semibold transition-colors ${
                      current
                        ? "bg-brand text-canvas hover:bg-brand-strong"
                        : "text-ink hover:bg-tint-strong"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="hidden sm:block ml-2 pl-2 border-l border-line">
            <Link
              href="/contact"
              className="inline-flex min-h-10 items-center rounded-full bg-tint-strong px-4 text-xs sm:text-sm font-semibold text-brand-strong hover:bg-brand hover:text-canvas transition-all"
            >
              Book visit
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
