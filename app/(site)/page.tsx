import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { clinic } from "@/components/clinic";
import {
  CheckupIcon,
  CleaningIcon,
  CostIcon,
  CrownIcon,
  FillingIcon,
  RootCanalIcon,
  StepsIcon,
  TalkIcon,
  WhiteningIcon,
} from "@/components/illustrations/ServiceIcons";
import { FAQ } from "@/lib/faq/data";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Dental care at Northwind Dental, a fictional clinic in Sampletown. Check-ups, cleanings, fillings and other treatments, with each step explained.",
};

const services = [
  { title: "Check-up", text: "We look over your teeth and gums and talk through what we see.", Icon: CheckupIcon },
  { title: "Cleaning", text: "A scale and polish, with time to ask about your routine at home.", Icon: CleaningIcon },
  {
    title: "Whitening",
    text: "We go through shade options and how a session works before you decide.",
    Icon: WhiteningIcon,
  },
  { title: "Fillings", text: "We explain each step and the materials before we begin.", Icon: FillingIcon },
  {
    title: "Root canal treatment",
    text: "We explain what the treatment involves and what to expect afterwards before we start.",
    Icon: RootCanalIcon,
  },
  {
    title: "Crowns and bridges",
    text: "We talk through the options and the steps involved before we begin.",
    Icon: CrownIcon,
  },
];

const approachPoints = [
  {
    title: "Time to talk",
    text: "Visits begin with a chat about what brought you in and what matters to you.",
    Icon: TalkIcon,
  },
  {
    title: "Each step explained",
    text: "We say what we are doing before we do it, and you can pause at any point.",
    Icon: StepsIcon,
  },
  {
    title: "Costs discussed first",
    text: "We go through options and costs with you before any treatment starts.",
    Icon: CostIcon,
  },
];

const gallery = [
  {
    caption: "Treatment room",
    src: "/images/treatment-room.webp",
    width: 1600,
    height: 893,
    alt: "A private treatment room with a dental chair and a window",
    sizes: "(min-width: 1160px) 690px, (min-width: 768px) 58vw, 100vw",
    className: "md:row-span-2",
  },
  {
    caption: "Reception",
    src: "/images/reception.webp",
    width: 1376,
    height: 768,
    alt: "Reception desk in light oak with sky-blue accents",
    sizes: "(min-width: 1160px) 460px, (min-width: 768px) 40vw, 100vw",
    className: "",
  },
  {
    caption: "Imaging bay",
    src: "/images/equipment-bay.webp",
    width: 1376,
    height: 768,
    alt: "An imaging bay with a monitor and an uncluttered counter",
    sizes: "(min-width: 1160px) 460px, (min-width: 768px) 40vw, 100vw",
    className: "",
  },
];

/** Answers come verbatim from the FAQ data (the hours answer carries clinic.hoursSummary). */
const HOME_FAQ_IDS = ["first-visit", "booking", "hours", "pricing"];
const homeFaq = HOME_FAQ_IDS.map((id) => FAQ.find((entry) => entry.id === id)).filter(
  (entry): entry is (typeof FAQ)[number] => entry !== undefined,
);

const eyebrow = "text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-brand";
const h2 = "text-[clamp(1.75rem,1.1rem+2.2vw,2.5rem)] leading-[1.15] text-ink";
const lead = "max-w-[52ch] text-[1.1875rem] leading-relaxed text-muted";
const btn =
  "inline-flex min-h-12 w-full items-center justify-center rounded-button border-2 px-6 py-3 text-center font-semibold leading-tight transition-colors sm:w-auto";
const btnPrimary = `${btn} border-transparent bg-brand text-canvas hover:bg-brand-strong`;
const btnPeach = `${btn} border-transparent bg-peach text-ink hover:bg-peach-strong`;
const btnGhost = `${btn} border-brand-strong bg-transparent text-ink hover:bg-surface/60`;
const band = "py-[clamp(3.5rem,9vw,7rem)]";
const secHead = "mb-[clamp(1.75rem,4vw,3rem)] grid max-w-[40rem] gap-3";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="overflow-x-clip pb-[clamp(3rem,7vw,6.5rem)] pt-[clamp(0.5rem,3vw,3.5rem)]">
        <div className="page-wrap grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="grid justify-items-start gap-5">
            <p className={`${eyebrow} motion-safe:animate-rise`}>Dental clinic</p>
            <h1 className="text-[clamp(2.125rem,1.3rem+3.6vw,3.625rem)] leading-[1.08] text-ink motion-safe:animate-rise">
              A small dental clinic with a friendly welcome
            </h1>
            <p className={`${lead} motion-safe:animate-rise motion-safe:[animation-delay:0.1s]`}>
              Check-ups, cleanings and fillings in a light-filled space. Tell us what you need and we will plan
              your visit together.
            </p>
            <div className="mt-1.5 flex w-full flex-wrap gap-3 motion-safe:animate-rise motion-safe:[animation-delay:0.18s]">
              <Link href="/contact" className={btnPrimary}>
                Book an appointment
              </Link>
              <Link href="/faq" className={btnPeach}>
                Read the FAQ
              </Link>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 font-medium text-muted">
              {["Check-ups", "Cleanings", "Fillings", "Whitening"].map((item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative isolate mx-auto w-full max-w-120 pb-11 before:absolute before:-right-[4%] before:-top-[5%] before:-z-10 before:aspect-square before:w-[64%] before:rounded-full before:bg-tint-strong lg:before:-right-[10%] after:absolute after:bottom-2 after:right-[6%] after:-z-10 after:size-21 after:rounded-full after:bg-peach motion-safe:animate-rise motion-safe:[animation-delay:0.15s]">
            <div className="arch bg-tint-strong shadow-lift">
              <Image
                src="/images/hero-clinic.webp"
                alt="A bright treatment room with a dental chair, light oak panelling and a window onto greenery"
                fill
                priority
                sizes="(min-width: 520px) 480px, 100vw"
                className="object-cover [object-position:56%_50%]"
              />
            </div>
            <figure className="absolute bottom-0 left-[-3%] m-0 w-[46%] rounded-card border border-line bg-surface p-2 shadow-lift lg:-left-[12%]">
              <Image
                src="/images/reception.webp"
                alt="The reception area with a light oak desk"
                width={1376}
                height={768}
                loading="lazy"
                sizes="(min-width: 520px) 220px, 46vw"
                className="aspect-[4/3] w-full rounded-control object-cover"
              />
              <figcaption className="px-1 pt-1.5 text-[0.8125rem] leading-snug text-muted">
                Our reception area
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className={band} aria-labelledby="services-heading">
        <div className="page-wrap">
          <div className={secHead}>
            <p className={eyebrow}>Services</p>
            <h2 id="services-heading" className={h2}>
              What we can help with
            </h2>
            <p className="text-[1.0625rem] leading-relaxed text-muted">
              Six things people usually come in for. Each one starts with a conversation.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map(({ title, text, Icon }) => (
              <li
                key={title}
                className="grid content-start gap-3 rounded-card border border-line bg-surface p-6 shadow-soft transition-[transform,box-shadow] hover:shadow-lift motion-safe:hover:-translate-y-0.5"
              >
                <span className="grid size-12 place-items-center rounded-button bg-tint text-brand">
                  <Icon className="size-[26px]" />
                </span>
                <h3 className="text-xl text-ink">{title}</h3>
                <p className="text-muted">{text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-muted">
            We also offer children&apos;s dentistry.{" "}
            <Link
              href="/services"
              className="inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4 hover:text-brand-strong"
            >
              See all services
            </Link>
          </p>
        </div>
      </section>

      {/* Approach: full-bleed sand band */}
      <section id="approach" className={`bg-sand ${band}`} aria-labelledby="approach-heading">
        <div className="page-wrap grid items-center gap-9 lg:grid-cols-2 lg:gap-[4.5rem]">
          <Image
            src="/images/welcome.webp"
            alt="A consultation room with two chairs, a small table and soft daylight"
            width={1376}
            height={768}
            loading="lazy"
            sizes="(min-width: 1160px) 540px, (min-width: 1024px) 45vw, 100vw"
            className="h-auto w-full rounded-panel shadow-lift"
          />
          <div>
            <p className={eyebrow}>Our approach</p>
            <h2 id="approach-heading" className={`mt-3 ${h2}`}>
              A visit that starts with a conversation
            </h2>
            <ul className="mt-7 grid gap-5">
              {approachPoints.map(({ title, text, Icon }) => (
                <li key={title} className="grid grid-cols-[2.75rem_1fr] items-start gap-4">
                  <span className="grid size-11 place-items-center rounded-button border border-line bg-surface text-brand">
                    <Icon className="size-[26px]" />
                  </span>
                  <div>
                    <h3 className="font-sans text-lg font-bold tracking-normal text-ink">{title}</h3>
                    <p className="text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* The clinic */}
      <section className={band} aria-labelledby="clinic-heading">
        <div className="page-wrap">
          <div className={secHead}>
            <p className={eyebrow}>The clinic</p>
            <h2 id="clinic-heading" className={h2}>
              Take a look around
            </h2>
            <p className="text-[1.0625rem] leading-relaxed text-muted">
              Light oak and daylight. Illustrative images, not photographs of a real clinic.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr] md:grid-rows-2">
            {gallery.map((shot) => (
              <figure
                key={shot.caption}
                className={`relative m-0 aspect-[4/3] overflow-hidden rounded-panel bg-tint-strong md:aspect-auto md:min-h-65 ${shot.className}`}
              >
                <Image
                  src={shot.src}
                  alt={shot.alt}
                  width={shot.width}
                  height={shot.height}
                  loading="lazy"
                  sizes={shot.sizes}
                  className="absolute inset-0 size-full object-cover"
                />
                <figcaption className="absolute bottom-3 left-3 rounded-full bg-surface/95 px-3 py-1.5 text-sm font-semibold text-ink">
                  {shot.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={`bg-sand ${band}`} aria-labelledby="home-faq-heading">
        <div className="page-wrap grid gap-8 lg:grid-cols-[5fr_7fr] lg:items-start lg:gap-[4.5rem]">
          <div className="grid gap-3">
            <p className={eyebrow}>FAQ</p>
            <h2 id="home-faq-heading" className={h2}>
              Questions people ask us
            </h2>
            <div className="mt-2 grid justify-items-start gap-3.5 rounded-card border border-line bg-surface p-5.5">
              <p className="text-[1.0625rem] leading-relaxed text-ink">
                <strong>Not here?</strong> The FAQ page has more answers about services, hours and booking.
              </p>
              <Link href="/faq" className={btnPeach}>
                Read the FAQ
              </Link>
            </div>
          </div>
          <div className="grid gap-3">
            {homeFaq.map((entry, index) => (
              <details key={entry.id} open={index === 0} className="group rounded-card border border-line bg-surface">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 py-3.5 text-[1.0625rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  {entry.question}
                  <span
                    className="size-2.5 shrink-0 -translate-y-0.5 rotate-45 border-b-2 border-r-2 border-brand transition-transform group-open:-rotate-[135deg]"
                    aria-hidden="true"
                  />
                </summary>
                <p className="px-5 pb-5 pt-3 text-muted">{entry.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className={band} aria-labelledby="cta-heading">
        <div className="page-wrap">
          <div className="relative isolate grid justify-items-start gap-4 overflow-hidden rounded-panel bg-tint-strong p-[clamp(1.75rem,6vw,4rem)] after:absolute after:-bottom-20 after:-right-15 after:-z-10 after:size-55 after:rounded-full after:bg-wash">
            <h2 id="cta-heading" className={h2}>
              Ready when you are
            </h2>
            <p className="max-w-[52ch] text-[1.1875rem] leading-relaxed text-ink">
              Tell us what you need and we will plan your visit around it.
            </p>
            <div className="mt-1.5 flex w-full flex-wrap gap-3">
              <Link href="/contact" className={btnPrimary}>
                Book a visit
              </Link>
              <a href={`tel:${clinic.phone}`} className={btnGhost}>
                Call {clinic.phone}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
