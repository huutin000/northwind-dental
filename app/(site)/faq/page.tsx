import type { Metadata } from "next";
import Link from "next/link";
import FaqInteractive from "@/components/faq/FaqInteractive";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about booking, opening hours, costs and what happens at a visit at Northwind Dental.",
};

const eyebrow = "text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-brand";
const h2 = "text-[clamp(1.75rem,1.1rem+2.2vw,2.5rem)] leading-[1.15] text-ink";
const btn =
  "inline-flex min-h-12 w-full items-center justify-center rounded-button border-2 px-6 py-3 text-center font-semibold leading-tight transition-colors sm:w-auto";
const btnPrimary = `${btn} border-transparent bg-brand text-canvas hover:bg-brand-strong`;
const btnPeach = `${btn} border-transparent bg-peach text-ink hover:bg-peach-strong`;

export default function FaqPage() {
  return (
    <>
      <section className="pb-[clamp(1.5rem,4vw,2.5rem)] pt-[clamp(1.5rem,4vw,4.5rem)]">
        <div className="page-wrap grid justify-items-start gap-4">
          <p className={`${eyebrow} motion-safe:animate-rise`}>FAQ</p>
          <h1 className="text-[clamp(2.125rem,1.3rem+3.6vw,3.625rem)] leading-[1.08] text-ink">
            Frequently Asked Questions
          </h1>
          <p className="max-w-[52ch] text-[1.1875rem] leading-relaxed text-muted motion-safe:animate-rise motion-safe:[animation-delay:0.1s]">
            Answers about opening hours, booking, services, costs and what happens at a visit. Search, or open a topic
            below.
          </p>
        </div>
      </section>

      <div className="page-wrap">
        <FaqInteractive />
      </div>

      <section className="py-[clamp(3rem,8vw,6rem)]" aria-labelledby="faq-ask-heading">
        <div className="page-wrap">
          <div className="relative isolate grid justify-items-start gap-4 overflow-hidden rounded-panel bg-tint-strong p-[clamp(1.75rem,6vw,4rem)] after:absolute after:-bottom-20 after:-right-15 after:-z-10 after:size-55 after:rounded-full after:bg-wash">
            <h2 id="faq-ask-heading" className={h2}>
              Not answered here?
            </h2>
            <p className="max-w-[52ch] text-[1.1875rem] leading-relaxed text-ink">
              Send a request through the contact page, or look at what each service involves. The demo chat assistant
              in the corner can also answer from this list.
            </p>
            <div className="mt-1.5 flex w-full flex-wrap gap-3">
              <Link href="/contact" className={btnPrimary}>
                Contact us
              </Link>
              <Link href="/services" className={btnPeach}>
                See services
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
