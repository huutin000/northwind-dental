import type { Metadata } from "next";
import Link from "next/link";
import { SparkleCluster } from "@/components/illustrations/Decor";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page does not exist on the Northwind Dental demo site.",
};

export default function NotFound() {
  return (
    <section className="flex flex-wrap items-center gap-8 rounded-[2rem] bg-tint px-5 py-12 sm:px-10">
      <div className="max-w-md">
        <h1 className="text-4xl font-bold tracking-tight text-ink">
          We could not find that page
        </h1>
        <p className="mt-4 text-lg text-muted">
          The link may be old or mistyped. Head back to the home page, or look
          through our services.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center rounded-full bg-brand px-7 py-3 font-semibold text-canvas hover:bg-brand-strong"
          >
            Back to home
          </Link>
          <Link
            href="/services"
            className="inline-flex min-h-12 items-center rounded-full border border-brand px-7 py-3 font-semibold text-brand-strong hover:bg-tint-strong"
          >
            See services
          </Link>
        </div>
      </div>
      <SparkleCluster className="h-auto w-36" />
    </section>
  );
}
