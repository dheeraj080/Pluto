/** Pluto brand mark and wordmark, shared by the site header, footer, and app shell. */

export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <circle cx="12" cy="12" r="6" fill="currentColor" />
      <ellipse
        cx="12"
        cy="12"
        rx="10.5"
        ry="4"
        stroke="currentColor"
        strokeWidth="1.6"
        transform="rotate(-20 12 12)"
      />
    </svg>
  );
}

export function Wordmark({
  className = "",
  logoClassName = "",
}: {
  className?: string;
  logoClassName?: string;
}) {
  return (
    <span className={`inline-flex select-none items-center gap-2 font-semibold tracking-tight ${className}`}>
      <Logo className={logoClassName} />
      <span>Pluto</span>
    </span>
  );
}