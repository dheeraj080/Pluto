"use client";

/**
 * "Spending by day of week" and its companion insight card.
 *
 * The line plots the *average* per weekday across the selected range — a
 * weekday's converted total divided by how often that weekday occurs — so a
 * range with five Wednesdays never looks heavier than a range with four. The
 * axis is categorical, so the line is straight segments with dots and no
 * smoothing: the peak day's dot is emerald, the rest grey-blue.
 *
 * The insight card reads the same rows: the busiest weekday with its share of
 * the range's total, plus the quietest one.
 */

import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactAxis, type ChartTable } from "@/components/charts";
import { Skeleton } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { addDaysIso, diffDays } from "@/lib/ranges";
import type { DayOfWeekItem } from "@/lib/types";
import { ReportCard } from "./report-card";

export interface DayOfWeekRow {
  /** JavaScript day-of-week index, 0 = Sunday. */
  dow: number;
  /** Short label for the axis, e.g. "Mon". */
  label: string;
  /** Full name for tooltips and the insight, e.g. "Monday". */
  full: string;
  /** Average primary-currency spend per occurrence of this weekday. */
  average: number;
  /** Average secondary-currency spend per occurrence, when available. */
  secondaryAverage: number | null;
  /** Total primary-currency spend on this weekday. */
  total: number;
  /** Number of expenses recorded on this weekday. */
  count: number;
  /** How many times this weekday occurs inside the range. */
  occurrences: number;
}

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Chart order: Monday first, matching the app's week. */
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

const TICK = { fontSize: 11, fill: "var(--muted)" } as const;
const GRID = "rgba(255, 255, 255, 0.06)";
const CURSOR = { stroke: "rgba(255, 255, 255, 0.16)", strokeWidth: 1, strokeDasharray: "4 4" };

/** Occurrence count for each weekday (indexed by dow) across an inclusive range. */
function weekdayCounts(from: string, to: string): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const days = diffDays(from, to);
  for (let offset = 0; offset <= days; offset += 1) {
    const dow = new Date(`${addDaysIso(from, offset)}T00:00:00Z`).getUTCDay();
    counts[dow] += 1;
  }
  return counts;
}

/**
 * The chart rows: the server's per-weekday totals divided by how often each
 * weekday occurs inside the range, so the line is a fair per-day average.
 */
export function dayOfWeekRows(items: DayOfWeekItem[], from: string, to: string): DayOfWeekRow[] {
  const counts = weekdayCounts(from, to);
  return DOW_ORDER.map((dow) => {
    const item = items.find((entry) => entry.dow === dow);
    const occurrences = counts[dow] || 1;
    const total = item?.total ?? 0;
    const secondaryTotal = item?.secondaryTotal ?? null;
    return {
      dow,
      label: DOW_SHORT[dow],
      full: DOW_FULL[dow],
      average: total / occurrences,
      secondaryAverage: secondaryTotal == null ? null : secondaryTotal / occurrences,
      total,
      count: item?.count ?? 0,
      occurrences,
    };
  });
}

interface TooltipEntry {
  payload?: DayOfWeekRow;
}

function DowTooltip({
  active,
  payload,
  base,
  second,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  base: string | null;
  second: string | null;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="min-w-[12.5rem] rounded-xl border border-border bg-surface px-3 py-2 shadow-2xl">
      <p className="mb-1.5 text-xs font-medium text-ink">{row.full}</p>
      <ul className="space-y-1">
        <li className="flex items-start justify-between gap-4 text-xs">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className="mt-1 inline-block size-2 shrink-0 rounded-full"
              style={{ backgroundColor: "var(--primary)" }}
            />
            <span className="truncate text-muted">
              {base ? `Average (${base})` : "Average"}
            </span>
          </span>
          <span className="text-right">
            <span className="block font-medium tabular-nums text-ink">
              {money(row.average, base)}
            </span>
            {row.secondaryAverage != null && second && (
              <span className="block text-[11px] tabular-nums text-muted">
                {formatMoney(row.secondaryAverage, second)}
              </span>
            )}
          </span>
        </li>
        <li className="flex items-start justify-between gap-4 text-xs">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              className="mt-1 inline-block size-2 shrink-0 rounded-full"
              style={{ backgroundColor: "var(--chart-secondary)" }}
            />
            <span className="truncate text-muted">Expenses</span>
          </span>
          <span className="text-right">
            <span className="block font-medium tabular-nums text-ink">
              {row.count} across {row.occurrences} {row.occurrences === 1 ? row.label : `${row.label}s`}
            </span>
          </span>
        </li>
      </ul>
    </div>
  );
}

function money(value: number | null, code: string | null): string {
  if (value == null || !code) return "—";
  return formatMoney(value, code);
}

export function DayOfWeekCard({
  rows,
  base,
  second,
  rangeLabel,
  loading,
  error,
  onRetry,
}: {
  rows: DayOfWeekRow[];
  base: string | null;
  second: string | null;
  rangeLabel: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const peak = useMemo(
    () =>
      rows.length > 0
        ? rows.reduce((max, row) => (row.average > max.average ? row : max))
        : null,
    [rows],
  );

  const table: ChartTable = useMemo(() => {
    const columns = ["Day", `Average (${base ?? "—"})`];
    if (second) columns.push(`Average (${second})`);
    columns.push("Expenses", `Total (${base ?? "—"})`);
    return {
      caption: "Spending by day of week, average per weekday",
      columns,
      rows: rows.map((row) => [
        row.full,
        money(row.average, base),
        ...(second ? [money(row.secondaryAverage, second)] : []),
        String(row.count),
        money(row.total, base),
      ]),
    };
  }, [rows, base, second]);

  const isEmpty = rows.length === 0 || !rows.some((row) => row.average > 0);

  return (
    <ReportCard
      title="Spending by day of week"
      subtitle={`${rangeLabel} · average per weekday`}
      table={table}
      loading={loading}
      skeleton={<Skeleton className="h-[240px]" />}
      error={error}
      onRetry={onRetry}
      empty={
        isEmpty ? (
          <p className="py-12 text-center text-sm text-muted">No spending in this period yet</p>
        ) : undefined
      }
    >
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="label"
              tick={TICK}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={12}
              interval={0}
            />
            <YAxis
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={[0, "auto"]}
              tickFormatter={compactAxis}
            />
            <Tooltip cursor={CURSOR} isAnimationActive={false} content={<DowTooltip base={base} second={second} />} />
            <Line
              type="linear"
              dataKey="average"
              name="Average"
              stroke="var(--chart-secondary)"
              strokeWidth={2}
              strokeLinecap="round"
              dot={{ r: 3, fill: "var(--chart-secondary)", strokeWidth: 0 }}
              activeDot={{ r: 4.5, strokeWidth: 0 }}
              isAnimationActive={false}
            />
            {peak && (
              <ReferenceDot
                x={peak.label}
                y={peak.average}
                r={5}
                fill="var(--primary)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ReportCard>
  );
}

/** The busiest weekday's share of the range total, 0–100. */
function peakShare(rows: DayOfWeekRow[], peak: DayOfWeekRow | null): number {
  if (!peak) return 0;
  const sum = rows.reduce((total, row) => total + row.total, 0);
  if (sum <= 0) return 0;
  return (peak.total / sum) * 100;
}

export function DayOfWeekInsight({
  rows,
  base,
  rangeLabel,
  loading,
  error,
  onRetry,
}: {
  rows: DayOfWeekRow[];
  base: string | null;
  rangeLabel: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const peak = useMemo(
    () =>
      rows.length > 0
        ? rows.reduce((max, row) => (row.average > max.average ? row : max))
        : null,
    [rows],
  );
  const quietest = useMemo(
    () =>
      rows.length > 0
        ? rows.reduce((min, row) => (row.average < min.average ? row : min))
        : null,
    [rows],
  );
  const share = peakShare(rows, peak);
  const isLoading = loading && !error;
  const isEmpty = !isLoading && (rows.length === 0 || !rows.some((row) => row.average > 0));

  return (
    <section
      aria-label="Spending insight"
      className="flex h-full flex-col justify-center gap-3 rounded-3xl border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">What this says</p>
        {rangeLabel && <p className="text-xs text-muted">{rangeLabel}</p>}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-danger/30 px-2.5 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
          >
            Retry
          </button>
        </div>
      ) : isEmpty || !peak || !quietest ? (
        <p className="text-sm leading-relaxed text-muted">No spending in this period yet.</p>
      ) : (
        <div className="space-y-2 text-sm leading-relaxed text-muted">
          <p>
            You spend the most on{" "}
            <strong className="font-medium text-ink">{peak.full}s</strong> (
            <span className="tabular-nums text-ink">{money(peak.average, base)}</span>
            {share > 0 && (
              <>
                {" "}
                on average,{" "}
                <span className="tabular-nums text-ink">{share.toFixed(0)}%</span> of the total
              </>
            )}
            ).
          </p>
          <p>
            The quietest day is{" "}
            <strong className="font-medium text-ink">{quietest.full}</strong> —{" "}
            <span className="tabular-nums text-ink">{money(quietest.average, base)}</span> on
            average.
          </p>
        </div>
      )}
    </section>
  );
}