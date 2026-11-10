type Props = { className?: string };

const common = {
  "aria-hidden": true,
  focusable: false,
} as const;

/** Small outlined tooth mark used in the header and footer. Takes its colour from the text colour. */
export function ToothMark({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...common}
      className={className}
    >
      <path d="M12 6C10.5 4.2 8.5 3.5 6.8 4.2 4.8 5 4 7 4.4 9.4 4.8 12 6 13.5 6.4 16.2 6.7 18.2 7.2 20.5 8.6 20.5 10 20.5 10.2 17 12 17 13.8 17 14 20.5 15.4 20.5 16.8 20.5 17.3 18.2 17.6 16.2 18 13.5 19.2 12 19.6 9.4 20 7 19.2 5 17.2 4.2 15.5 3.5 13.5 4.2 12 6Z" />
    </svg>
  );
}
