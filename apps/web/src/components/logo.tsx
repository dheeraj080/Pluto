/**
 * Pluto brand mark and wordmark.
 *
 * The mark is a planet wrapped by an orbit ring whose gap closes with an
 * arrowhead: an **orbit** (the trip) and an **exchange arrow** (a currency
 * converting) in one shape. The planet is painted with `currentColor` so it
 * sits correctly on any surface; the ring uses the emerald accent.
 *
 * Kept deliberately simple so it survives at 16px — see `app/icon.svg` for the
 * static favicon, which drops the faint underlying orbit and thickens the ring.
 */

type MarkProps = {
  className?: string;
  /** Adds an accessible name; omit for decorative usage next to text. */
  title?: string;
};

export function PlutoMark({ className = "", title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`shrink-0 ${className}`}
    >
      <g transform="rotate(-24 12 12)">
        {/* Faint complete orbit for depth. */}
        <ellipse
          cx="12"
          cy="12"
          rx="10"
          ry="4.2"
          stroke="currentColor"
          strokeWidth="1.4"
          opacity="0.22"
        />
        {/* Back half of the ring (passes behind the planet). */}
        <path
          d="M2.4 10.6 A10 4.2 0 0 1 20.6 10.2"
          stroke="var(--color-accent, #34d399)"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </g>

      {/* Planet. */}
      <circle cx="12" cy="12" r="5.5" fill="currentColor" />

      <g transform="rotate(-24 12 12)">
        {/* Front half of the ring (crosses in front of the planet). */}
        <path
          d="M20.6 13.8 A10 4.2 0 0 1 2.4 10.6"
          stroke="var(--color-accent, #34d399)"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        {/* Exchange arrowhead closing the ring. */}
        <polygon points="19.1 11.3 22.6 12 21.5 8.5" fill="var(--color-accent, #34d399)" />
      </g>
    </svg>
  );
}

/** Backwards-compatible alias used by the header, footer and app shells. */
export function Logo({ className = "" }: { className?: string }) {
  return <PlutoMark className={className} />;
}

export function Wordmark({
  className = "",
  logoClassName = "",
}: {
  className?: string;
  logoClassName?: string;
}) {
  return (
    <span className={`inline-flex select-none items-center gap-2 ${className}`}>
      <PlutoMark className={`h-[1.4em] w-[1.4em] ${logoClassName}`} />
      <span className="font-display text-[1.28em] font-semibold leading-none tracking-tight">
        Pluto
      </span>
    </span>
  );
}

/** Standalone wordmark lockup for marketing surfaces (hero, footer). */
export function WordmarkLockup({
  className = "",
  markClassName = "h-9 w-9",
  textClassName = "",
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={`inline-flex select-none items-center gap-2.5 ${className}`}>
      <PlutoMark className={markClassName} />
      <span
        className={`font-display text-2xl font-semibold leading-none tracking-tight ${textClassName}`}
      >
        Pluto
      </span>
    </span>
  );
}
