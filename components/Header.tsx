"use client";

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

  return (
    <header className="md:sticky md:top-0 md:z-30 border-b border-line bg-canvas">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-0 px-4 py-1 sm:py-2">
        <Link
          href="/"
          className="flex min-h-10 items-center gap-2 rounded text-lg sm:min-h-11 font-bold text-brand-strong"
        >
          <ToothMark className="h-8 w-8 shrink-0" />
          Northwind Dental
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap gap-x-1 gap-y-1">
            {links.map(({ href, label }) => {
              const current = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold sm:px-4 hover:bg-tint-strong ${
                      current
                        ? "bg-brand text-canvas hover:bg-brand-strong"
                        : "text-ink"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
