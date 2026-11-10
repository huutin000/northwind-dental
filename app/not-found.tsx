import type { Metadata } from "next";
import Link from "next/link";
import { ToothMark } from "@/components/illustrations/Decor";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page does not exist on the Northwind Dental demo site.",
};

const btn =
  "inline-flex min-h-12 w-full items-center justify-center rounded-button border-2 px-6 py-3 text-center font-semibold leading-tight transition-colors sm:w-auto";

export default function NotFound() {
  return (
    <div className="page-wrap py-[clamp(2rem,6vw,5rem)]">
      <section className="relative isolate grid justify-items-start gap-4 overflow-hidden rounded-panel bg-tint-strong p-[clamp(1.75rem,6vw,4rem)]">
        <ToothMark className="absolute -bottom-8 -right-6 -z-10 size-48 text-wash sm:size-64" />
        <h1 className="max-w-[18ch] text-[clamp(2.125rem,1.3rem+3.6vw,3.625rem)] leading-[1.08] text-ink">
          We could not find that page
        </h1>
        <p className="max-w-[52ch] text-[1.1875rem] leading-relaxed text-ink">
          The link may be old or mistyped. Head back to the home page, or look through our services.
        </p>
        <div className="mt-1.5 flex w-full flex-wrap gap-3">
          <Link href="/" className={`${btn} border-transparent bg-brand text-canvas hover:bg-brand-strong`}>
            Back to home
          </Link>
          <Link href="/services" className={`${btn} border-brand-strong bg-transparent text-ink hover:bg-surface/60`}>
            See services
          </Link>
        </div>
      </section>
    </div>
  );
}
