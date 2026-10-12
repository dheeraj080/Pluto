"use client";

/**
 * The dashboard's "this period vs the last one" card.
 *
 * A cumulative line for the selected window and a dashed line for the
 * equivalent window before it, so the shape of the month is legible at a
 * glance. The chart fills the card — a fixed 300px plot area that scales with
 * its container, a y-axis that tops out at the data maximum plus headroom, and
 * dots only on hover and on the latest point. The table and the opt-in
 * second-currency axis live behind a small "…" menu, so the header stays to
 * title, subtitle and the range toggle.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { compareWindows, type CompareRange } from "@/lib/ranges";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import {
  ChartFrame,
  ComparisonChart,
  compactAxis,
  type ChartTable,
  type ComparisonRow,
} from "@/components/charts";
import { SegmentedControl, Skeleton } from "@/components/ui";
import { IconCheck, IconDots } from "@/components/icons";
import { CardError } from "./dashboard-error";

const RANGES = [
  { value: "month", label: "This month" },
  { value: "3m", label: "3M" },
  { value: "12m", label: "12M" },
];

export function ComparisonCard({
  rows,
  range,
  onRangeChange,
  base,
  second,
  loading,
  error,
  onRetry,
}: {
  rows: ComparisonRow[];
  range: CompareRange;
  onRangeChange: (range: CompareRange) => void;
  base: string;
  second: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [showSecond, setShowSecond] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const granularity = useMemo(() => compareWindows(range).granularity, [range]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const currentLabel = range === "month" ? "This month" : range === "3m" ? "Last 3 months" : "Last 12 months";
  const previousLabel = range === "month" ? "Last month" : range === "3m" ? "Previous 3" : "Previous 12";
  const title = range === "month" ? "This month vs last month" : `${currentLabel} vs ${previousLabel.toLowerCase()}`;
  const subtitle =
    granularity === "month" ? "Cumulative spending by month" : "Cumulative spending by day";

  const tick = (key: string): string => {
    if (granularity === "month") return shortMonth(key);
    if (range === "month") return String(Number(key.slice(8, 10)));
    return new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };
  const heading = (key: string): string =>
    granularity === "month" ? formatMonth(key) : formatDate(key);

  const money = (value: number | null | undefined) =>
    value == null ? "—" : formatMoney(value, base);
  const signed = (value: number) => `${value > 0 ? "+" : ""}${formatMoney(value, base)}`;

  const table: ChartTable | undefined =
    rows.length > 0
      ? {
          caption: `${title}, cumulative`,
          columns: ["Date", currentLabel, previousLabel, "Difference"],
          rows: rows.map((row) => [
            heading(row.key),
            money(row.current),
            money(row.previous),
            row.current == null && row.previous == null
              ? "—"
              : signed((row.current ?? 0) - (row.previous ?? 0)),
          ]),
        }
      : undefined;

  /** Data maximum plus 10% headroom, so the lines use the whole plot height. */
  const yMax = useMemo(() => {
    let max = 0;
    for (const row of rows) {
      if (row.current != null && row.current > max) max = row.current;
      if (row.previous != null && row.previous > max) max = row.previous;
    }
    return max > 0 ? max * 1.1 : 1;
  }, [rows]);

  const latestPoint = useMemo(() => {
    const last = rows[rows.length - 1];
    return last && last.current != null ? { x: last.key, y: last.current } : null;
  }, [rows]);

  return (
    <ChartFrame
      compact
      title={title}
      subtitle={subtitle}
      className="order-3"
      table={table}
      hideTableToggle
      showTable={showTable}
      onShowTableChange={setShowTable}
      loading={loading}
      skeleton={<Skeleton className="h-[300px]" />}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Comparison range"
            options={RANGES}
            value={range}
            onChange={(value) => onRangeChange(value as CompareRange)}
          />
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="Spending-chart options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted transition-colors duration-150 hover:border-border-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <IconDots className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-1.5 w-48 rounded-xl border border-border bg-surface p-1.5 shadow-2xl"
              >
                <MenuCheckItem
                  label="Table"
                  checked={showTable}
                  disabled={!table}
                  onSelect={() => {
                    setShowTable((value) => !value);
                    setMenuOpen(false);
                  }}
                />
                {second && (
                  <MenuCheckItem
                    label="Second axis"
                    checked={showSecond}
                    onSelect={() => {
                      setShowSecond((value) => !value);
                      setMenuOpen(false);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      }
    >
      {error ? (
        <CardError message={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No spending in this window yet.</p>
      ) : (
        <ComparisonChart
          data={rows}
          currentLabel={currentLabel}
          previousLabel={previousLabel}
          formatPrimary={(value) => formatMoney(value, base)}
          formatSecondary={(value) => (second ? formatMoney(value, second) : String(value))}
          xTickFormatter={tick}
          xHeadingFormatter={heading}
          showSecondAxis={showSecond}
          leftTickFormatter={compactAxis}
          rightTickFormatter={compactAxis}
          leftDomain={[0, yMax]}
          latestPoint={latestPoint}
          height={300}
        />
      )}
    </ChartFrame>
  );
}

function MenuCheckItem({
  label,
  checked,
  onSelect,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>{label}</span>
      {checked && <IconCheck className="h-4 w-4 text-primary" aria-hidden="true" />}
    </button>
  );
}

/** "Oct 2026" → "Oct", for a compact axis. */
function shortMonth(month: string): string {
  return formatMonth(month).split(" ")[0];
}