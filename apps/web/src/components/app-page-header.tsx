/**
 * One-row page header and the Pair switcher.
 *
 * Every app screen opens with the same tidy row: the title, the date range and
 * an optional info pill on the left; the currency-pair control and the screen's
 * actions on the right. On narrow screens the row wraps rather than scrolling
 * sideways.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { IconSwap } from "./icons";

export function AppPageHeader({
  title,
  dateRange,
  pair,
  info,
  actions,
  className = "",
}: {
  title: string;
  /** Compact date-range control (presets and/or custom bounds). */
  dateRange?: ReactNode;
  /** The Pair switcher. */
  pair?: ReactNode;
  /** Small info pill, e.g. the rate/estimate note. */
  info?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-3 ${className}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {title}
        </h1>
        {dateRange}
        {info}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {pair}
        {actions}
      </div>
    </header>
  );
}

/**
 * Compact two-option control that flips which currency is the Base. The active
 * (Base) option is filled; activating the other makes it the Base and demotes
 * the previous Base to Second. With no second currency chosen yet it becomes a
 * quiet link into Settings instead of an empty control.
 */
export function PairSwitcher({
  base,
  second,
  onSwap,
  className = "",
}: {
  base: string | null;
  second: string | null;
  /** Make the second currency the base (and vice versa). */
  onSwap: () => void;
  className?: string;
}) {
  if (!base || !second) {
    return (
      <Link
        href="/expenses/settings"
        className={`inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border-strong px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-primary/40 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
      >
        <IconSwap className="h-3.5 w-3.5" />
        Set a currency pair
      </Link>
    );
  }

  return (
    <div
      role="group"
      aria-label="Display currency pair"
      className={`inline-flex items-center rounded-xl border border-border bg-surface-muted p-0.5 ${className}`}
    >
      <button
        type="button"
        aria-pressed="true"
        className="h-7 rounded-[10px] bg-primary-subtle px-2.5 text-xs font-semibold tabular-nums text-primary"
      >
        {base}
      </button>
      <button
        type="button"
        aria-pressed="false"
        onClick={onSwap}
        title={`Show ${second} as the base currency`}
        className="inline-flex h-7 items-center gap-1 rounded-[10px] px-2.5 text-xs font-medium tabular-nums text-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <IconSwap aria-hidden="true" className="h-3 w-3" />
        {second}
      </button>
    </div>
  );
}
