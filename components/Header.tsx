"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToothMark } from "@/components/illustrations/Decor";

const links = [
  { href: "/services", label: "Services" },
  { href: "/#approach", label: "Approach" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

const MENU_ID = "main-menu";

export default function Header() {
  const pathname = usePathname();
  // The menu remembers the page it was opened on, so a route change closes it
  // without an effect. Links that stay on the same page close it in onClick.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
      // React when focus is inside the header nav, or nowhere in particular (some browsers do not
      // focus a button on click). Leave Escape alone when focus is elsewhere; the chat widget
      // handles its own Escape.
      const active = document.activeElement;
      if (active && active !== document.body && !navRef.current?.contains(active)) return;
      setOpenAt(null);
      buttonRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 h-17 border-b border-line bg-canvas/95 backdrop-blur-md">
      <div className="page-wrap flex h-full items-center justify-between gap-4">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2.5 rounded-control text-brand"
        >
          <ToothMark className="size-7 shrink-0" />
          <span className="font-heading text-[1.1875rem] font-medium leading-none tracking-[-0.02em] text-ink sm:text-[1.375rem]">
            Northwind Dental
          </span>
        </Link>

        <nav ref={navRef} aria-label="Main" className="flex items-center gap-1">
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={MENU_ID}
            onClick={() => setOpenAt(open ? null : pathname)}
            className="inline-flex min-h-11 items-center gap-2 rounded-control border-[1.5px] border-edge px-3.5 text-[0.9375rem] font-semibold text-ink hover:bg-tint md:hidden"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
            Menu
          </button>

          <ul
            id={MENU_ID}
            className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-full flex-col divide-y divide-line border-b border-line bg-surface px-4 pb-3 shadow-lift md:static md:flex md:flex-row md:items-center md:gap-1 md:divide-y-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
          >
            {links.map(({ href, label }) => {
              const current = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpenAt(null)}
                    className="flex min-h-12 items-center font-medium text-ink hover:bg-tint aria-[current=page]:bg-tint-strong md:inline-flex md:min-h-11 md:rounded-control md:px-3.5"
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <Link
            href="/contact"
            className="ml-2 hidden min-h-11 items-center justify-center rounded-button bg-brand px-5 font-semibold text-canvas transition-colors hover:bg-brand-strong md:inline-flex"
          >
            Book a visit
          </Link>
        </nav>
      </div>
    </header>
  );
}
