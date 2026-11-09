import type { ReactNode } from "react";
import { SPARKLE_PATH, TOOTH_PATH } from "./paths";

type IconProps = { className?: string };

function Icon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export function CheckupIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={TOOTH_PATH} className="fill-wash" transform="translate(-2 -1) scale(.9)" />
      <circle cx="33" cy="32" r="8" className="fill-tint" />
      <path d="M39 38l6 6" />
    </Icon>
  );
}

export function FillingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={TOOTH_PATH} className="fill-wash" />
      <circle cx="24" cy="17" r="4.5" className="fill-accent" />
    </Icon>
  );
}

export function WhiteningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={TOOTH_PATH} className="fill-wash" transform="translate(-2 2) scale(.9)" />
      <path d={SPARKLE_PATH} className="fill-accent" transform="translate(38 10) scale(1.6)" />
      <path d={SPARKLE_PATH} className="fill-accent" transform="translate(41 25) scale(.8)" />
    </Icon>
  );
}

export function RootCanalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={TOOTH_PATH} className="fill-wash" />
      <path d="M20 19c0 6 1 10 1.5 15M28 19c0 6-1 10-1.5 15" className="stroke-accent" />
    </Icon>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 30l2-16 8 8 5-10 5 10 8-8 2 16z" className="fill-wash" />
      <path d="M9 37h30" />
      <path d="M18 37v5M30 37v5" />
    </Icon>
  );
}

export function ChildrenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={TOOTH_PATH} className="fill-wash" />
      <circle cx="19" cy="19" r="1.2" className="fill-current" />
      <circle cx="29" cy="19" r="1.2" className="fill-current" />
      <path d="M19 25q5 4.5 10 0" />
    </Icon>
  );
}

export const serviceIcons = {
  "Check-ups and cleaning": CheckupIcon,
  Fillings: FillingIcon,
  "Teeth whitening": WhiteningIcon,
  "Root canal treatment": RootCanalIcon,
  "Crowns and bridges": CrownIcon,
  "Children's dentistry": ChildrenIcon,
} as const;

export type ServiceName = keyof typeof serviceIcons;
