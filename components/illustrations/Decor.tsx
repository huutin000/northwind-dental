import { SPARKLE_PATH, TOOTH_PATH } from "./paths";

type Props = { className?: string };

const common = {
  "aria-hidden": true,
  focusable: false,
} as const;

/** Small tooth mark used in the header. */
export function ToothMark({ className }: Props) {
  return (
    <svg viewBox="0 0 48 48" {...common} className={className}>
      <path d={TOOTH_PATH} className="fill-brand" />
      <path d={SPARKLE_PATH} className="fill-canvas" transform="translate(19 20) scale(1.3)" />
    </svg>
  );
}

/** Check mark badge for the list of reasons. */
export function CheckBadge({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" {...common} className={className}>
      <circle cx="12" cy="12" r="11" className="fill-brand" />
      <path
        d="M7 12.5l3.5 3.5L17 9"
        fill="none"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-canvas"
      />
    </svg>
  );
}

/** Cluster of sparkles, a quiet accent for headings. */
export function SparkleCluster({ className }: Props) {
  return (
    <svg viewBox="0 0 80 60" {...common} className={className}>
      <path d={SPARKLE_PATH} className="fill-accent sparkle" transform="translate(28 30) scale(5)" />
      <path d={SPARKLE_PATH} className="fill-wash sparkle sparkle-late" transform="translate(58 14) scale(2.6)" />
      <path d={SPARKLE_PATH} className="fill-brand sparkle" transform="translate(60 46) scale(1.4)" />
    </svg>
  );
}

/** Toothbrush with bubbles, used on the Services page. */
export function ToothbrushScene({ className }: Props) {
  return (
    <svg viewBox="0 0 320 120" {...common} className={className}>
      <circle cx="260" cy="30" r="22" className="fill-tint-strong" />
      <circle cx="292" cy="78" r="12" className="fill-wash" />
      <circle cx="226" cy="84" r="8" className="fill-tint-strong" />
      <g transform="translate(18 92) rotate(-18)">
        <rect x="0" y="0" width="190" height="16" rx="8" className="fill-brand" />
        <rect x="150" y="-4" width="10" height="24" rx="5" className="fill-brand-strong" />
        <rect x="176" y="-14" width="76" height="30" rx="10" className="fill-tint stroke-brand" strokeWidth={3} />
        <g className="stroke-accent" strokeWidth={4} strokeLinecap="round">
          <path d="M188-8v-12M200-8v-12M212-8v-12M224-8v-12M236-8v-12" />
        </g>
      </g>
      <path d={SPARKLE_PATH} className="fill-accent sparkle" transform="translate(205 26) scale(3)" />
    </svg>
  );
}

/** Appointment card with a check mark and a speech bubble, used on the Contact page. */
export function AppointmentScene({ className }: Props) {
  return (
    <svg viewBox="0 0 320 200" {...common} className={className}>
      <rect x="10" y="10" width="300" height="180" rx="32" className="fill-tint-strong" />
      <rect x="34" y="34" width="124" height="138" rx="16" className="fill-canvas stroke-brand" strokeWidth={3} />
      <path d="M34 66V50a16 16 0 0 1 16-16h92a16 16 0 0 1 16 16v16z" className="fill-brand" />
      <rect x="62" y="24" width="8" height="22" rx="4" className="fill-brand-strong" />
      <rect x="122" y="24" width="8" height="22" rx="4" className="fill-brand-strong" />
      <g className="fill-wash">
        <rect x="50" y="82" width="20" height="16" rx="4" />
        <rect x="82" y="82" width="20" height="16" rx="4" />
        <rect x="114" y="82" width="20" height="16" rx="4" />
        <rect x="50" y="108" width="20" height="16" rx="4" />
        <rect x="114" y="108" width="20" height="16" rx="4" />
        <rect x="50" y="134" width="20" height="16" rx="4" />
        <rect x="82" y="134" width="20" height="16" rx="4" />
      </g>
      <rect x="80" y="106" width="24" height="20" rx="6" className="fill-brand" />
      <path d="M86 116l4 4 8-9" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="stroke-canvas" />
      <path d="M180 56h100a14 14 0 0 1 14 14v40a14 14 0 0 1-14 14h-62l-22 20v-20h-16a14 14 0 0 1-14-14V70a14 14 0 0 1 14-14z" className="fill-canvas stroke-brand" strokeWidth={3} strokeLinejoin="round" />
      <g className="fill-brand">
        <circle cx="212" cy="90" r="6" />
        <circle cx="234" cy="90" r="6" />
        <circle cx="256" cy="90" r="6" />
      </g>
      <path d={SPARKLE_PATH} className="fill-accent sparkle" transform="translate(290 34) scale(3)" />
    </svg>
  );
}

/** Hero scene: one large tooth on soft shapes, with a toothbrush and sparkles. */
export function HeroScene({ className }: Props) {
  return (
    <svg viewBox="0 0 480 420" {...common} className={className}>
      <path d="M240 20c92 0 190 52 206 150 16 96-58 214-170 226-120 12-244-40-256-150C8 140 110 20 240 20z" className="fill-tint-strong" />
      <circle cx="240" cy="205" r="150" fill="none" strokeWidth={3} strokeDasharray="2 14" strokeLinecap="round" className="stroke-wash" />
      <circle cx="240" cy="205" r="112" className="fill-canvas" />
      <path d={TOOTH_PATH} className="fill-wash stroke-brand" strokeWidth={1.1} strokeLinejoin="round" transform="translate(240 205) scale(5.2) translate(-24 -23)" />
      <g transform="translate(40 352) rotate(-28)">
        <rect x="0" y="0" width="150" height="14" rx="7" className="fill-brand" />
        <rect x="118" y="-3" width="8" height="20" rx="4" className="fill-brand-strong" />
        <rect x="140" y="-12" width="60" height="26" rx="9" className="fill-tint stroke-brand" strokeWidth={3} />
        <g className="stroke-accent" strokeWidth={4} strokeLinecap="round">
          <path d="M150-6v-11M162-6v-11M174-6v-11M186-6v-11" />
        </g>
      </g>
      <path d={SPARKLE_PATH} className="fill-accent sparkle" transform="translate(372 96) scale(7)" />
      <path d={SPARKLE_PATH} className="fill-brand sparkle sparkle-late" transform="translate(120 100) scale(4)" />
      <path d={SPARKLE_PATH} className="fill-wash sparkle" transform="translate(404 270) scale(4.5)" />
      <circle cx="418" cy="176" r="9" className="fill-wash" />
      <circle cx="84" cy="228" r="6" className="fill-accent" />
    </svg>
  );
}

/** Static, illustrative map of a fictional location (no real place). */
export function MapIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 400 260"
      role="img"
      aria-label="Illustrative map of a fictional location, with a pin on a street corner"
      className={className}
    >
      <rect width="400" height="260" rx="24" className="fill-tint" />
      <path d="M0 190C80 160 140 220 230 190S350 150 400 175V260H0z" className="fill-wash" />
      <rect x="276" y="28" width="96" height="70" rx="18" className="fill-tint-strong" />
      <g className="stroke-canvas" strokeWidth={14} strokeLinecap="round" fill="none">
        <path d="M-10 110H410" />
        <path d="M130 -10V270" />
        <path d="M250 -10V120" />
        <path d="M30 40L120 40" />
      </g>
      <g className="stroke-tint-strong" strokeWidth={2} strokeDasharray="10 10" fill="none">
        <path d="M0 110H400" />
        <path d="M130 0V260" />
      </g>
      <rect x="150" y="128" width="64" height="40" rx="8" className="fill-tint-strong" />
      <rect x="40" y="126" width="64" height="30" rx="8" className="fill-tint-strong" />
      <g transform="translate(130 110)">
        <path d="M0 0C-16-18-24-30-24-42a24 24 0 0 1 48 0C24-30 16-18 0 0z" className="fill-brand" />
        <circle cx="0" cy="-42" r="9" className="fill-canvas" />
      </g>
    </svg>
  );
}
