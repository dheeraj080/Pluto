"use client";

/**
 * Pills.
 *
 * `ChangePill` is the standard "versus the previous period" badge. Following
 * the product rule, a fall in spending is the good outcome and reads green,
 * while a rise uses a soft amber — never a warning-red, because comparing two
 * normal periods is not an error.
 *
 * `InfoPill` is the quiet note beside a date range (e.g. "Rates as of 9 Oct ·
 * estimate"). It expands into a short explanation on click, so the honest
 * caveats stay available without a full-width banner taking over the page.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconInfo, IconTrendUp } from "./icons";

export function ChangePill({
  /** Percent change versus the previous period; negative means spending fell. */
  percent,
  /** Whether a decrease is the good outcome. Defaults to true (spending). */
  downIsGood = true,
  /** Optional caption after the pill, e.g. "vs last month". */
  caption,
  className = "",
}: {
  percent: number | null;
  downIsGood?: boolean;
  caption?: string;
  className?: string;
}) {
  if (percent == null || !Number.isFinite(percent)) return null;

  const down = percent < 0;
  const flat = percent === 0;
  const good = flat ? null : down === downIsGood;

  const tone = flat
    ? "border-border bg-paper text-muted"
    : good
      ? "border-success/25 bg-success-subtle text-success"
      : "border-warning/25 bg-warning-subtle text-warning";

  const magnitude = `${percent > 0 ? "+" : ""}${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}>
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${tone}`}>
        {!flat && (
          <IconTrendUp aria-hidden="true" className={`h-3.5 w-3.5 ${down ? "rotate-180" : ""}`} />
        )}
        <span className="tabular-nums">{magnitude}</span>
      </span>
      {caption && <span className="text-muted">{caption}</span>}
    </span>
  );
}

export function InfoPill({
  label,
  title,
  children,
  tone = "neutral",
  className = "",
}: {
  /** Compact text shown on the pill itself. */
  label: string;
  /** Optional heading inside the popover. */
  title?: string;
  children: ReactNode;
  /** `warning` tints the pill amber — e.g. whenever figures include estimates. */
  tone?: "neutral" | "warning";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toneClass =
    tone === "warning"
      ? "border-warning/30 bg-warning-subtle text-warning hover:border-warning/50"
      : "border-border bg-paper text-muted hover:border-border-strong hover:text-ink";

  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${toneClass}`}
      >
        <IconInfo
          aria-hidden="true"
          className={`h-3.5 w-3.5 ${tone === "warning" ? "text-warning" : "text-primary"}`}
        />
        <span className="tabular-nums">{label}</span>
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={title ?? label}
          className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100%-2rem)] rounded-[var(--radius-card,8px)] border border-border bg-paper p-4 text-left shadow-2xl"
        >
          {title && <p className="text-sm font-semibold text-ink">{title}</p>}
          <div className={`text-xs leading-relaxed text-muted ${title ? "mt-1.5" : ""}`}>
            {children}
          </div>
        </div>
      )}
    </span>
  );
}
