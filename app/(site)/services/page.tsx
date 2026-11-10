import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Comprehensive boutique dental services at Northwind Dental: preventive cleans, composite fillings, whitening, endodontics, restorative crowns, and children's dentistry.",
};

type DentalService = {
  id: string;
  name: string;
  tagline: string;
  duration: string;
  summary: string;
  expectSteps: string[];
  icon: (props: { className?: string }) => React.JSX.Element;
};

// Distinct, bespoke hand-crafted SVG clinical icons following the project color palette
const ServiceIcons = {
  Cleaning: ({ className = "size-8" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Fillings: ({ className = "size-8" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2C8 2 5 4.5 5 8c0 2.5 1 4.5 2 7l1.5 5.5c.3 1 1 1.5 2 1.5s1.7-.5 2-1.5L14 15c1-2.5 2-4.5 2-7 0-3.5-3-6-4-6Z" />
      <path d="M9 8h6M12 5v6" />
    </svg>
  ),
  Whitening: ({ className = "size-8" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
      <path d="M5 3v4M3 5h4M19 17v4M17 19h4" />
    </svg>
  ),
  RootCanal: ({ className = "size-8" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3c0 4 1.5 7 2 10l1.5 7c.2.8.8 1 1.5 1s1.3-.2 1.5-1l1-5 1 5c.2.8.8 1 1.5 1s1.3-.2 1.5-1l1.5-7c.5-3 2-6 2-10-3 1-5 1-8 0-3 1-5 1-8 0Z" />
      <path d="M12 7v7" />
    </svg>
  ),
  Crowns: ({ className = "size-8" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  ),
  Pediatric: ({ className = "size-8" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" />
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
    </svg>
  ),
};

const servicesList: DentalService[] = [
  {
    id: "cleaning",
    name: "Routine Cleaning & Hygiene Prevention",
    tagline: "Preserving natural tooth structure and gum health",
    duration: "45 – 60 minutes",
    summary:
      "Regular clinical maintenance to remove calcified plaque (calculus), prevent periodontal irritation, and polish tooth surfaces for lasting comfort.",
    expectSteps: [
      "Initial assessment of gum margins and pocket depths.",
      "Ultrasonic calculus removal followed by hand instrumentation.",
      "Gentle enamel polishing and personalized flossing advice.",
    ],
    icon: ServiceIcons.Cleaning,
  },
  {
    id: "fillings",
    name: "Tooth-Colored Composite Fillings",
    tagline: "Seamless structural restoration for minor decay",
    duration: "30 – 50 minutes",
    summary:
      "Minimally invasive composite resin restorations that mimic natural tooth color and bond directly to preserve as much healthy tooth structure as possible.",
    expectSteps: [
      "Targeted local numbing to ensure total procedure comfort.",
      "Gentle removal of softened, decayed tooth matter.",
      "Layered resin application, light-curing, and bite verification.",
    ],
    icon: ServiceIcons.Fillings,
  },
  {
    id: "whitening",
    name: "Professional Supervised Teeth Whitening",
    tagline: "Dentist-guided enamel shade improvement",
    duration: "60 minutes initial visit",
    summary:
      "Carefully formulated whitening systems tailored to your tooth sensitivity profile, helping to lift common everyday staining from coffee, tea, and age.",
    expectSteps: [
      "Clinical baseline check of existing restorations and tooth sensitivity.",
      "Custom tray fabrication or chairside application planning.",
      "Clear guidance on post-treatment dietary choices and aftercare.",
    ],
    icon: ServiceIcons.Whitening,
  },
  {
    id: "root-canal",
    name: "Endodontic Root Canal Care",
    tagline: "Resolving deep tooth infection while saving the natural tooth",
    duration: "60 – 90 minutes",
    summary:
      "When internal tooth pulp becomes inflamed or infected, endodontic therapy cleans and disinfects the microscopic internal canals, sealing them to avoid extraction.",
    expectSteps: [
      "Profound local anaesthesia and isolation with a dental dam.",
      "Careful canal cleansing using delicate rotary instruments.",
      "Biocompatible canal sealing followed by a protective temporary seal.",
    ],
    icon: ServiceIcons.RootCanal,
  },
  {
    id: "crowns",
    name: "Ceramic Crowns & Precision Bridges",
    tagline: "Rebuilding strength and chewing function for compromised teeth",
    duration: "2 appointments (60 mins each)",
    summary:
      "High-strength ceramic restorations crafted to cover weakened teeth or span gaps left by missing teeth, engineered to match your natural bite contour.",
    expectSteps: [
      "Tooth preparation, 3D digital impressions, and temporary crown placement.",
      "Custom fabrication in a dental laboratory to match your natural shade.",
      "Precision fit checking, bite harmonization, and definitive bonding.",
    ],
    icon: ServiceIcons.Crowns,
  },
  {
    id: "pediatric",
    name: "Children's Dental Care",
    tagline: "Positive, stress-free dental introductions for young patients",
    duration: "30 – 45 minutes",
    summary:
      "Nurturing visits focused on building curiosity and confidence. We introduce dental instruments at a child-friendly pace without overwhelming sensory cues.",
    expectSteps: [
      "Fun 'count the teeth' examination and familiarization with the chair.",
      "Gentle clean and optional remineralizing fluoride varnish.",
      "Helpful, positive tips for parents on brushing habits at home.",
    ],
    icon: ServiceIcons.Pediatric,
  },
];

export default function ServicesPage() {
  return (
    <div className="space-y-16 sm:space-y-24">
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-line bg-gradient-to-br from-tint via-canvas to-tint-strong p-6 sm:p-10 lg:p-12">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas/80 px-3.5 py-1.5 text-xs font-semibold text-brand backdrop-blur-sm">
            <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
            <span>Clinical Treatments & Procedures</span>
          </div>

          <h1 className="font-heading text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Our Dental Services
          </h1>

          <p className="text-base sm:text-lg text-muted leading-relaxed">
            From routine prevention to restorative procedures, we take time to explain each step before beginning. Transparent discussions and written treatment plans accompany every visit.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-muted">
            <span className="inline-flex items-center gap-1.5">
              <svg className="size-4 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Clear visit durations
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1.5">
              <svg className="size-4 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Written treatment estimates
            </span>
          </div>
        </div>
      </section>

      {/* Services Detailed List using Bespoke Clinical Icon Cards */}
      <div className="space-y-10">
        {servicesList.map((service, index) => {
          const Icon = service.icon;
          return (
            <ScrollReveal
              key={service.id}
              as="article"
              id={service.id}
              className="grid gap-6 rounded-3xl border border-line bg-canvas p-6 sm:p-8 lg:p-10 lg:grid-cols-12 lg:items-center hover:border-edge/60 transition-colors shadow-sm"
            >
              {/* Icon Badge Column (3 cols) */}
              <div className="lg:col-span-3 flex lg:flex-col items-center lg:items-start gap-4">
                <div className="flex size-16 sm:size-20 shrink-0 items-center justify-center rounded-2xl bg-tint text-brand border border-line shadow-inner">
                  <Icon className="size-9 sm:size-10 text-brand" />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand">
                    Service 0{index + 1}
                  </span>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <svg className="size-3.5 text-brand shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{service.duration}</span>
                  </div>
                </div>
              </div>

              {/* Content Column (9 cols) */}
              <div className="lg:col-span-9 space-y-4">
                <div>
                  <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                    {service.name}
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm font-medium text-brand-strong">
                    {service.tagline}
                  </p>
                </div>

                <p className="text-xs sm:text-sm text-muted leading-relaxed">
                  {service.summary}
                </p>

                {/* What to Expect Box */}
                <div className="rounded-2xl border border-line bg-tint/50 p-4 sm:p-5">
                  <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-brand-strong">
                    What to expect during your appointment:
                  </h3>
                  <ul className="mt-2.5 space-y-1.5">
                    {service.expectSteps.map((step, sIdx) => (
                      <li key={sIdx} className="flex items-start gap-2 text-xs text-ink leading-relaxed">
                        <span className="mt-1 size-1.5 rounded-full bg-brand shrink-0" aria-hidden="true" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-line text-xs">
                  <div className="rounded-full bg-tint-strong px-3 py-1 font-medium text-brand-strong">
                    Estimate given at your visit
                  </div>
                  <Link
                    href="/contact"
                    className="inline-flex min-h-10 items-center justify-center rounded-full bg-brand px-6 text-xs font-semibold text-canvas hover:bg-brand-strong transition-all focus-visible:outline-brand"
                  >
                    Book this visit
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          );
        })}
      </div>

      {/* Bottom CTA Section */}
      <ScrollReveal as="section" className="rounded-3xl border border-line bg-tint-strong p-8 text-center sm:p-12">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          Have questions about which visit fits your needs?
        </h2>
        <p className="mt-3 max-w-lg mx-auto text-xs sm:text-sm text-muted">
          Our demo assistant or reception desk can clarify appointment preparation, duration, and what to bring.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/contact"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-8 py-3 text-xs sm:text-sm font-semibold text-canvas hover:bg-brand-strong transition-all"
          >
            Contact our clinic
          </Link>
          <Link
            href="/faq"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-edge/60 bg-canvas px-7 py-3 text-xs sm:text-sm font-semibold text-ink hover:bg-tint transition-colors"
          >
            Read FAQs
          </Link>
        </div>
      </ScrollReveal>
    </div>
  );
}
