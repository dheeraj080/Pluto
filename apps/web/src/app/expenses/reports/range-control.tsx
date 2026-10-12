"use client";

/**
 * The one global range control for Reports.
 *
 * Its selection is the single source of truth for every card on the screen, so
 * it lives in the header and never inside a card. Four presets cover the common
 * windows; "Custom" opens a two-month calendar popover (never a pair of raw
 * date inputs), so a custom window is picked the same way the presets are.
 *
 * The resolved range is echoed beside the control so the user can always see
 * exactly which days every card is describing.
 *
 * Accessibility: the popover is a labelled dialog; Escape and outside clicks
 * close it and return focus to the trigger, each day is a real button with a
 * full-date label, and every control keeps the shared focus ring.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { REPORT_PRESETS, type ReportPreset, todayIso } from "@/lib/ranges";
import { formatRangeLabel } from "@/lib/format";
import { IconCalendar, IconChevronDown } from "@/components/icons";

/* ------------------------------------------------------------------ */
/* Calendar arithmetic (UTC, so a bound never shifts by a timezone)    */
/* ------------------------------------------------------------------ */

function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1 + delta, 1)).toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A fixed Monday, so the weekday headers are stable across locales that agree. */
const WEEK_START = Date.UTC(2024, 0, 1);
const WEEKDAYS = Array.from({ length: 7 }, (_, index) =>
  new Date(WEEK_START + index * 86_400_000).toLocaleDateString(undefined, {
    weekday: "narrow",
    timeZone: "UTC",
  }),
);

interface DayCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

/** Six weeks of days for a `YYYY-MM` month, Monday first. */
function monthCells(month: string): DayCell[] {
  const [year, mon] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // 0 = Monday
  const start = Date.UTC(year, mon - 1, 1 - offset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start + index * 86_400_000);
    const iso = date.toISOString().slice(0, 10);
    return { iso, day: date.getUTCDate(), inMonth: iso.slice(0, 7) === month };
  });
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/* ------------------------------------------------------------------ */
/* Control                                                             */
/* ------------------------------------------------------------------ */

export function RangeControl({
  preset,
  from,
  to,
  customFrom,
  customTo,
  onPreset,
  onCustomFrom,
  onCustomTo,
  className = "",
}: {
  preset: ReportPreset;
  /** The resolved inclusive bounds currently in force. */
  from: string;
  to: string;
  customFrom: string;
  customTo: string;
  onPreset: (preset: ReportPreset) => void;
  onCustomFrom: (value: string) => void;
  onCustomTo: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => todayIso().slice(0, 7));
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [hover, setHover] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const today = todayIso();
  const currentMonth = today.slice(0, 7);

  const openPopover = useCallback(() => {
    setDraftFrom(preset === "custom" ? customFrom || from : from);
    setDraftTo(preset === "custom" ? customTo || to : to);
    setView((preset === "custom" ? customFrom || from : from).slice(0, 7));
    setOpen(true);
  }, [preset, customFrom, customTo, from, to]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  function selectPreset(value: ReportPreset) {
    if (value !== "custom") {
      onPreset(value);
      setOpen(false);
      return;
    }
    onPreset("custom");
    if (open) setOpen(false);
    else openPopover();
  }

  function commit(nextFrom: string, nextTo: string) {
    onCustomFrom(nextFrom);
    onCustomTo(nextTo);
    setOpen(false);
  }

  function pick(day: string) {
    if (!draftFrom || draftTo) {
      setDraftFrom(day);
      setDraftTo("");
      return;
    }
    if (day < draftFrom) commit(day, draftFrom);
    else commit(draftFrom, day);
  }

  const { lo, hi } = useMemo(() => {
    const start = draftFrom;
    const end = draftTo || hover || draftFrom;
    return start && end && end > start ? { lo: start, hi: end } : { lo: start, hi: start };
  }, [draftFrom, draftTo, hover]);

  const months = [view, shiftMonth(view, 1)];
  const canGoForward = shiftMonth(view, 1) < currentMonth;

  return (
    <div ref={wrapRef} className={`relative flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
      <div
        role="group"
        aria-label="Date range"
        className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-surface-muted p-0.5"
      >
        {REPORT_PRESETS.map((option) => {
          const active = option.value === preset;
          const isCustom = option.value === "custom";
          return (
            <button
              key={option.value}
              ref={isCustom ? triggerRef : undefined}
              type="button"
              aria-pressed={active}
              aria-haspopup={isCustom ? "dialog" : undefined}
              aria-expanded={isCustom ? open : undefined}
              aria-controls={isCustom && open ? id : undefined}
              onClick={() => selectPreset(option.value)}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                active
                  ? "bg-background text-ink shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                  : "text-muted hover:text-ink"
              }`}
            >
              {isCustom && <IconCalendar aria-hidden="true" className="h-3.5 w-3.5" />}
              {option.label}
              {isCustom && (
                <IconChevronDown
                  aria-hidden="true"
                  className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <span className="hidden text-xs tabular-nums text-muted lg:inline">
        {formatRangeLabel(from, to)}
      </span>

      {open && (
        <div
          id={id}
          role="dialog"
          aria-label="Choose a custom date range"
          className="absolute left-0 top-full z-40 mt-2 w-max max-w-[calc(100vw-2rem)] rounded-[20px] border border-border bg-surface p-4 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink">
              {draftFrom && draftTo
                ? formatRangeLabel(draftFrom, draftTo)
                : draftFrom
                  ? `${formatRangeLabel(draftFrom, draftFrom)} → pick an end date`
                  : "Pick a start date"}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setView(shiftMonth(view, -1))}
                className="inline-flex size-7 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <IconChevronDown aria-hidden="true" className="h-4 w-4 rotate-90" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                disabled={!canGoForward}
                onClick={() => setView(shiftMonth(view, 1))}
                className="inline-flex size-7 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-35"
              >
                <IconChevronDown aria-hidden="true" className="h-4 w-4 -rotate-90" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-5 overflow-x-auto">
            {months.map((month) => (
              <MonthGrid
                key={month}
                month={month}
                today={today}
                lo={lo}
                hi={hi}
                draftFrom={draftFrom}
                draftTo={draftTo}
                onPick={pick}
                onHover={setHover}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-[11px] text-muted">
              {draftFrom && !draftTo ? "Now choose the last day." : "Both bounds are inclusive."}
            </p>
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MonthGrid({
  month,
  today,
  lo,
  hi,
  draftFrom,
  draftTo,
  onPick,
  onHover,
}: {
  month: string;
  today: string;
  lo: string | null;
  hi: string | null;
  draftFrom: string;
  draftTo: string;
  onPick: (iso: string) => void;
  onHover: (iso: string | null) => void;
}) {
  const cells = monthCells(month);
  return (
    <div className="w-[16.5rem] shrink-0">
      <p className="mb-1.5 text-center text-xs font-medium text-ink">{monthLabel(month)}</p>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAYS.map((label, index) => (
          <span key={index} aria-hidden="true" className="py-1 text-[10px] uppercase text-muted">
            {label}
          </span>
        ))}
        {cells.map((cell) => {
          const disabled = cell.iso > today;
          const selected = cell.iso === draftFrom || cell.iso === draftTo;
          const inRange = lo && hi && cell.iso > lo && cell.iso < hi;
          return (
            <span key={cell.iso} className="relative">
              {inRange && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 inset-y-0.5 bg-primary-subtle"
                />
              )}
              <button
                type="button"
                disabled={disabled}
                aria-label={dayLabel(cell.iso)}
                aria-pressed={selected}
                onClick={() => onPick(cell.iso)}
                onMouseEnter={() => onHover(cell.iso)}
                onMouseLeave={() => onHover(null)}
                className={`relative mx-auto flex size-7 items-center justify-center rounded-lg text-xs tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-30 ${
                  selected
                    ? "bg-primary font-semibold text-on-primary"
                    : cell.inMonth
                      ? "text-ink hover:bg-surface-muted"
                      : "text-muted/60 hover:bg-surface-muted"
                }`}
              >
                {cell.day}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
