import type { ReactNode } from "react";

type IconProps = { className?: string };

/** Outlined 24-unit icons in currentColor. Decorative: the label next to them carries the meaning. */
function Icon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
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

const TOOTH =
  "M12 6C10.5 4.2 8.5 3.5 6.8 4.2 4.8 5 4 7 4.4 9.4 4.8 12 6 13.5 6.4 16.2 6.7 18.2 7.2 20.5 8.6 20.5 10 20.5 10.2 17 12 17 13.8 17 14 20.5 15.4 20.5 16.8 20.5 17.3 18.2 17.6 16.2 18 13.5 19.2 12 19.6 9.4 20 7 19.2 5 17.2 4.2 15.5 3.5 13.5 4.2 12 6Z";

export function CheckupIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </Icon>
  );
}

export function CleaningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 19L15 9" />
      <path d="M13 6.5l4.5 4.5 2.5-2.5-4.5-4.5z" />
      <path d="M6 3.5v3M4.5 5h3M19 15v3M17.5 16.5h3" />
    </Icon>
  );
}

export function WhiteningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" />
    </Icon>
  );
}

export function FillingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={TOOTH} />
      <circle cx="12" cy="10.5" r="1.6" />
    </Icon>
  );
}

export function RootCanalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d={TOOTH} />
      <path d="M9.5 11.5c0 2 .4 3.4.7 4.6M14.5 11.5c0 2-.4 3.4-.7 4.6" />
    </Icon>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 18.5h14M5.4 18.5L4.2 8.2l4.4 3.6L12 5l3.4 6.8 4.4-3.6-1.2 10.3" />
    </Icon>
  );
}

export function TalkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 5.5h15v10h-9l-4.5 3.5v-3.5h-1.5z" />
    </Icon>
  );
}

export function StepsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.2l2.6 2.6 4.8-5.2" />
    </Icon>
  );
}

export function ChildIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.6 14.2c.8 1.2 2 1.8 3.4 1.8s2.6-.6 3.4-1.8" />
      <path d="M9 9.6h.01M15 9.6h.01" />
    </Icon>
  );
}

export function CostIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9.6 10c0-1.2 1-1.8 2.4-1.8s2.4.6 2.4 1.7-1 1.4-2.4 1.7-2.4.6-2.4 1.7 1 1.8 2.4 1.8 2.4-.6 2.4-1.8" />
    </Icon>
  );
}
