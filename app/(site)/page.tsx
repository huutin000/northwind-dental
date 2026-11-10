import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { clinic } from "@/components/clinic";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Tranquil, unhurried dental care at Northwind Dental, a fictional boutique clinic in Sampletown. Preventive hygiene, restorative treatments, and calm consultations.",
};

const trustPoints = [
  {
    title: "Unhurried appointments",
    text: "Longer consultation slots so you never feel rushed through treatment decisions.",
  },
  {
    title: "Written treatment plans",
    text: "Every recommendation explained in plain words with written summaries before starting.",
  },
  {
    title: "Calm clinical suites",
    text: "Natural light, sound-softening finishes, and ergonomic chairs designed for comfort.",
  },
  {
    title: "Direct clinician dialogue",
    text: "Speak directly with your dentist about sensory concerns, pace, and step-by-step pauses.",
  },
];

const teamMembers = [
  {
    initials: "M",
    name: "Maya",
    role: "general dentist",
    focus: "Comprehensive dental examinations, preventive care, and patient consultations.",
    color: "bg-sky-100 text-brand-strong border-sky-200",
  },
  {
    initials: "M",
    name: "Marcus",
    role: "restorative care",
    focus: "Tooth-colored composite restorations, crown preparations, and structural repairs.",
    color: "bg-sky-700 text-canvas border-sky-800",
  },
  {
    initials: "E",
    name: "Elena",
    role: "hygiene coordinator",
    focus: "Professional plaque removal, periodontal monitoring, and everyday home-care routines.",
    color: "bg-tint-strong text-ink border-wash",
  },
];

const firstVisitSteps = [
  {
    step: "01",
    title: "Welcome & quiet check-in",
    duration: "10 mins",
    desc: "Settle into our reception lounge with tea or water. We review your dental history and any specific preferences in a private consultation room.",
  },
  {
    step: "02",
    title: "Thorough clinical examination",
    duration: "25 mins",
    desc: "Your dentist examines teeth, soft tissues, and bite alignment. We take digital diagnostics only when indicated and walk through what we observe.",
  },
  {
    step: "03",
    title: "Collaborative care plan",
    duration: "15 mins",
    desc: "We discuss prioritized findings together. You receive a printed itemized breakdown of recommended next steps to review at home without pressure.",
  },
];

// Rich, distinct clinical tour gallery using real bespoke photos (no duplicate crops, 100% unique views)
const galleryImages = [
  {
    title: "Boutique Reception Desk",
    desc: "Curved light oak counter and quiet welcome area with filtered morning daylight",
    src: "/images/reception.webp",
    alt: "Northwind Dental reception area with light oak desk and botanicals",
  },
  {
    title: "Private Operatory Suite",
    desc: "Ergonomic treatment seating, precision LED illumination, and acoustic oak panels",
    src: "/images/treatment-room.webp",
    alt: "Clinical treatment room showing modern dental chair and timber wall",
  },
  {
    title: "Digital Diagnostic Bay",
    desc: "Low-dose panoramic imaging scanner and sterile stainless preparation counter",
    src: "/images/equipment-bay.webp",
    alt: "Modern digital dental radiography scanner and sterile preparation station",
  },
  {
    title: "Consultation & Planning Room",
    desc: "Private dialogue space for reviewing written treatment options in comfort",
    src: "/images/welcome.webp",
    alt: "Private dental consultation room with light oak desk and linen seating",
  },
];

const patientEducation = [
  {
    category: "Preventive routine",
    title: "What happens during a professional clean?",
    summary: "From ultrasonic scaling to gentle polish, discover how routine hygiene appointments preserve natural enamel.",
    href: "/faq#faq-group-1",
  },
  {
    category: "Restorative options",
    title: "Modern composite fillings vs traditional materials",
    summary: "Learn how tooth-colored composite resins bond directly with tooth structure to restore natural function.",
    href: "/faq#faq-group-2",
  },
  {
    category: "First appointments",
    title: "Managing dental sensitivity and appointment pace",
    summary: "Techniques and accommodations our team uses to support nervous visitors during routine care.",
    href: "/faq#faq-group-0",
  },
];

const highlightedFaqs = [
  {
    q: "How do I request an initial appointment?",
    a: "You can request an appointment through our online contact form or phone line. Our reception team will match you with a dedicated time slot.",
  },
  {
    q: "What should I bring to my first visit?",
    a: "Please bring a list of any current medications and your dental insurance details if applicable. We handle the rest during check-in.",
  },
  {
    q: "How are treatment costs determined?",
    a: "We provide itemized estimates before beginning any procedure. Written treatment plans detail each step and associated fee clearly.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-20 sm:space-y-28">
      {/* 1. HERO SECTION (Above the fold - always immediate, no flicker) */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-line bg-gradient-to-b from-tint to-canvas p-6 sm:p-10 lg:p-12">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas/80 px-3.5 py-1.5 text-xs font-semibold text-brand backdrop-blur-sm">
              <span className="size-2 rounded-full bg-brand" aria-hidden="true" />
              <span>Boutique Dental Care in Sampletown</span>
            </div>

            <h1 className="font-heading text-4xl font-bold tracking-tight text-ink sm:text-5xl lg:text-[3.5rem] lg:leading-[1.12]">
              Quiet, unhurried dental care designed for peace of mind.
            </h1>

            <p className="max-w-xl text-base text-muted sm:text-lg leading-relaxed">
              Experience dental appointments built around open conversation, clear written plans, and serene clinical spaces. Fictional demo clinic showcasing modern patient-first design.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/contact"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 py-3 text-sm font-semibold text-canvas hover:bg-brand-strong hover:scale-[1.02] active:scale-[0.98] transition-all focus-visible:outline-brand"
              >
                Book an appointment
              </Link>
              <Link
                href="/services"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-edge/60 bg-canvas px-6 py-3 text-sm font-semibold text-ink hover:bg-tint transition-colors focus-visible:outline-brand"
              >
                Explore services
              </Link>
            </div>

            {/* Floating Info Pill */}
            <div className="pt-2 flex flex-wrap items-center gap-6 text-xs text-muted">
              <div className="flex items-center gap-2">
                <svg className="size-4 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Mon–Fri: 9:00 – 17:00</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="size-4 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{clinic.address}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[16/10] sm:aspect-[4/3] w-full overflow-hidden rounded-3xl border border-line bg-tint-strong shadow-xl">
              <Image
                src="/images/hero-clinic.webp"
                alt="Northwind Dental modern clinical treatment suite with ergonomic chair, ambient daylight, and sleek overhead examination lamp"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 420px"
                className="object-cover hover:scale-105 transition-transform duration-700 ease-out"
              />
            </div>
            {/* Floating badge */}
            <div className="mt-3 sm:absolute sm:-bottom-4 sm:-left-4 rounded-2xl border border-line bg-canvas/95 p-3.5 shadow-lg backdrop-blur-md sm:max-w-xs">
              <p className="text-xs font-semibold text-ink">Treatment Suite 01</p>
              <p className="text-[11px] text-muted">Private operatory with diffused daylight & sound isolation</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. QUALITATIVE TRUST BAR (Always immediate, no flicker) */}
      <section aria-labelledby="trust-heading" className="border-y border-line py-10">
        <h2 id="trust-heading" className="sr-only">
          Our Clinical Values
        </h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 sm:divide-x sm:divide-line">
          {trustPoints.map((item, idx) => (
            <div key={item.title} className={`${idx !== 0 ? "sm:pl-6" : ""}`}>
              <div className="flex size-9 items-center justify-center rounded-xl bg-tint text-brand mb-3">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                </svg>
              </div>
              <h3 className="font-heading text-base font-semibold text-ink">
                {item.title}
              </h3>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. BENTO GRID SERVICES */}
      <ScrollReveal as="section" aria-labelledby="services-heading">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">
              Comprehensive Care
            </p>
            <h2 id="services-heading" className="mt-1 font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Thoughtful dental services
            </h2>
          </div>
          <Link
            href="/services"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-strong underline underline-offset-4"
          >
            <span>View all 6 dental treatments</span>
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-3 md:grid-rows-2">
          {/* Bento Card 1: Featured Hygiene (2 cols, 2 rows) */}
          <div className="group md:col-span-2 md:row-span-2 relative flex flex-col justify-between overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-tint via-canvas to-tint-strong p-6 sm:p-8">
            <div className="relative z-10 max-w-md">
              <span className="inline-block rounded-full bg-brand px-3 py-1 text-xs font-semibold text-canvas">
                Foundation Care
              </span>
              <h3 className="mt-4 font-heading text-2xl sm:text-3xl font-bold text-ink">
                Routine Examination & Hygiene Prophylaxis
              </h3>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                A thorough evaluation of teeth, gums, and oral soft tissues paired with gentle calculus removal and preventative polishing. We review personalized home maintenance strategies tailored to your lifestyle.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <svg className="size-4 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Typical visit: 45–60 mins
                </span>
                <span>•</span>
                <span>Estimate given at your visit</span>
              </div>
            </div>

            <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-line bg-canvas">
              <Image
                src="/images/cleaning.webp"
                alt="Sterile dental prophylaxis instruments organized on sky-blue clinical tray"
                fill
                sizes="(max-width: 768px) 100vw, 550px"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>

          {/* Bento Card 2: Restorative Fillings */}
          <div className="flex flex-col justify-between rounded-3xl border border-line bg-canvas p-6 hover:border-edge transition-colors">
            <div>
              <div className="flex size-10 items-center justify-center rounded-xl bg-tint text-brand mb-4">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 2C8 2 5 4.5 5 8c0 2.5 1 4.5 2 7l1.5 5.5c.3 1 1 1.5 2 1.5s1.7-.5 2-1.5L14 15c1-2.5 2-4.5 2-7 0-3.5-3-6-4-6Z" />
                  <path d="M9 8h6M12 5v6" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-bold text-ink">
                Composite Restorations
              </h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Direct tooth-colored bonding to repair minor cavities and structural wear, color-matched to your surrounding enamel.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-line flex items-center justify-between text-xs">
              <span className="text-muted">30–45 mins</span>
              <Link href="/services" className="font-semibold text-brand hover:underline">
                Details →
              </Link>
            </div>
          </div>

          {/* Bento Card 3: Cosmetic Whitening */}
          <div className="flex flex-col justify-between rounded-3xl border border-line bg-canvas p-6 hover:border-edge transition-colors">
            <div>
              <div className="flex size-10 items-center justify-center rounded-xl bg-tint text-brand mb-4">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-bold text-ink">
                Supervised Whitening
              </h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Gradual enamel brightening planned carefully after a clinical health check to prevent sensitivity.
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-line flex items-center justify-between text-xs">
              <span className="text-muted">60 mins consult</span>
              <Link href="/services" className="font-semibold text-brand hover:underline">
                Details →
              </Link>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* 4. FIRST VISIT TIMELINE */}
      <ScrollReveal as="section" aria-labelledby="timeline-heading" className="rounded-3xl border border-line bg-tint/60 p-6 sm:p-10">
        <div className="max-w-xl mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            Step-by-Step Experience
          </p>
          <h2 id="timeline-heading" className="mt-1 font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            How your first visit works
          </h2>
          <p className="mt-3 text-sm text-muted">
            We believe predictability eliminates anxiety. Here is what to expect from arrival to departure.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 relative">
          {firstVisitSteps.map((step, idx) => (
            <div
              key={step.title}
              className="relative flex flex-col justify-between rounded-2xl border border-line bg-canvas p-6 shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <span className="font-heading text-2xl font-bold text-brand">
                    {step.step}
                  </span>
                  <span className="rounded-full bg-tint px-2.5 py-1 text-[11px] font-medium text-muted">
                    {step.duration}
                  </span>
                </div>
                <h3 className="font-heading text-lg font-semibold text-ink">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-xs text-muted leading-relaxed">
                  {step.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-line flex items-center gap-2 text-[11px] text-muted">
                <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
                <span>Step {idx + 1} of 3</span>
              </div>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* 5. MEET OUR TEAM */}
      <ScrollReveal as="section" aria-labelledby="team-heading">
        <div className="text-center max-w-xl mx-auto mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            Care Team
          </p>
          <h2 id="team-heading" className="mt-1 font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Meet the clinical team
          </h2>
          <p className="mt-3 text-sm text-muted">
            Dedicated professionals committed to clear communication and attentive patient care.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {teamMembers.map((member) => (
            <div
              key={member.name}
              className="flex flex-col items-center text-center rounded-3xl border border-line bg-canvas p-8 hover:shadow-md transition-shadow"
            >
              <div
                className={`flex size-20 items-center justify-center rounded-full border-2 font-heading text-2xl font-bold ${member.color}`}
                aria-hidden="true"
              >
                {member.initials}
              </div>
              <h3 className="mt-5 font-heading text-xl font-bold text-ink">
                {member.name}
              </h3>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-wider text-brand">
                {member.role}
              </p>
              <p className="mt-3 text-xs text-muted leading-relaxed">
                {member.focus}
              </p>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* 6. CLINIC TOUR GALLERY (4 DISTINCT BESPOKE PHOTOS, NO DUPLICATES) */}
      <ScrollReveal as="section" aria-labelledby="gallery-heading">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">
              Clinic Spaces
            </p>
            <h2 id="gallery-heading" className="mt-1 font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Take a look inside
            </h2>
          </div>
          <p className="text-xs text-muted max-w-xs">
            Natural materials, acoustic timber finishes, and soothing daylight throughout Northwind Dental.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {galleryImages.map((img, idx) => (
            <div
              key={idx}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-canvas shadow-sm hover:shadow-md transition-all"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-tint">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6">
                <h3 className="font-heading text-lg font-semibold text-ink">
                  {img.title}
                </h3>
                <p className="mt-1.5 text-xs text-muted leading-relaxed">
                  {img.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* 7. PATIENT EDUCATION & FAQ TEASERS */}
      <ScrollReveal as="section" aria-labelledby="edu-heading">
        <div className="max-w-xl mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            Patient Knowledge
          </p>
          <h2 id="edu-heading" className="mt-1 font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Clear answers before your visit
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {patientEducation.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group flex flex-col justify-between rounded-3xl border border-line bg-canvas p-6 hover:border-brand hover:shadow-md transition-all"
            >
              <div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-brand">
                  {card.category}
                </span>
                <h3 className="mt-3 font-heading text-lg font-bold text-ink group-hover:text-brand transition-colors">
                  {card.title}
                </h3>
                <p className="mt-2 text-xs text-muted leading-relaxed">
                  {card.summary}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-line flex items-center justify-between text-xs font-semibold text-brand">
                <span>Read guide in FAQ</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </Link>
          ))}
        </div>
      </ScrollReveal>

      {/* 8. EMERGENCY CARE & URGENT QUESTIONS BLOCK */}
      <ScrollReveal as="section" aria-labelledby="emergency-heading" className="rounded-3xl border border-notice-ink/30 bg-notice/30 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-md bg-notice-ink/10 px-2.5 py-1 text-xs font-semibold text-notice-ink mb-3">
              <span className="size-2 rounded-full bg-notice-ink" aria-hidden="true" />
              <span>Urgent Dental Needs</span>
            </div>
            <h2 id="emergency-heading" className="font-heading text-2xl font-bold text-notice-ink">
              Experiencing acute toothache or trauma?
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-notice-ink/90 leading-relaxed">
              We reserve dedicated emergency slots each weekday for unexpected pain, cracked teeth, or knocked restorations. Call our reception desk promptly for immediate triage advice.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:items-end gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-notice-ink/80">
              Direct Emergency Line
            </span>
            <a
              href={`tel:${clinic.phone}`}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-notice-ink px-6 py-3 font-heading text-base font-bold text-canvas hover:bg-black transition-colors"
            >
              Call {clinic.phone}
            </a>
            <span className="text-[11px] text-notice-ink/75">During clinic opening hours</span>
          </div>
        </div>
      </ScrollReveal>

      {/* 9. HIGHLIGHTED FAQS */}
      <ScrollReveal as="section" aria-labelledby="faq-spotlight-heading" className="border-t border-line pt-12">
        <div className="max-w-xl mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">
            Common Inquiries
          </p>
          <h2 id="faq-spotlight-heading" className="mt-1 font-heading text-3xl font-bold tracking-tight text-ink">
            Frequently asked questions
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {highlightedFaqs.map((item) => (
            <div key={item.q} className="rounded-2xl border border-line bg-canvas p-6">
              <h3 className="font-heading text-base font-semibold text-ink">
                {item.q}
              </h3>
              <p className="mt-2.5 text-xs text-muted leading-relaxed">
                {item.a}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center">
          <Link
            href="/faq"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-strong underline underline-offset-4"
          >
            <span>Browse all questions by category</span>
            <span>→</span>
          </Link>
        </p>
      </ScrollReveal>

      {/* 10. FINAL CTA BANNER */}
      <ScrollReveal as="section" className="rounded-[2.5rem] bg-brand-strong p-8 text-canvas sm:p-12 text-center relative overflow-hidden">
        <div className="relative z-10 max-w-2xl mx-auto space-y-4">
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl text-canvas">
            Ready to plan your dental visit?
          </h2>
          <p className="text-sm sm:text-base text-wash leading-relaxed">
            Send us an appointment request to select a convenient date and time. Our team will follow up to confirm your booking and address any questions.
          </p>
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-canvas px-8 py-3.5 text-sm font-semibold text-brand-strong hover:bg-tint-strong hover:scale-105 active:scale-95 transition-all focus-visible:outline-canvas"
            >
              Request an appointment
            </Link>
            <Link
              href="/faq"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-canvas/40 bg-transparent px-7 py-3.5 text-sm font-semibold text-canvas hover:bg-canvas/10 transition-colors focus-visible:outline-canvas"
            >
              Read our patient FAQ
            </Link>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}
