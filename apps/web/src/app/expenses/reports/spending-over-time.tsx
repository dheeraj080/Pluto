"use client";

/**
 * "Spending over time" — the full-width comparison line.
 *
 * One emerald line for the selected range with a soft gradient fill and a
 * dashed grey-blue line for the equal-length period before it. The bucket size
 * follows the global range (daily / weekly / monthly), so a single month never
 * draws twelve points. The value axis is a single primary-currency axis: the
 * second currency is never plotted unless the reader opts in with the
 * "Show second currency axis" toggle, which is off by default.
 *
 * A "Per period | Cumulative" switch reads the same buckets either way.
 * Clicking a point lists that bucket's expenses underneath (max 5, with a link
 * to the full list), and estimated rates are marked "est." wherever a rate is
 * shown. There is no budget line and no "Compare" pill: the previous period is
 * always present, which is what the chart is for.
 */

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactAxis, usePrefersReducedMotion, type ChartTable } from "@/components/charts";
import { formatMoney } from "@/lib/format";
import { dualAmounts } from "@/lib/convert";
import { granularityLabel, type ReportGranularity } from "@/lib/ranges";
import type { ExpenseSeriesResponse, RateSnapshot } from "@/lib/types";
import { TransactionRow } from "@/components/transaction-row";
import { SegmentedControl, Skeleton } from "@/components/ui";
import { ReportCard } from "./report-card";
import {
  bucketAxis,
  bucketBounds,
  bucketHeading,
  effectiveRate,
  formatRateValue,
} from "./report-utils";
import { useReportExpenses } from "../use-reports";

export interface TrendRowReport {
  key: string;
  current: number | null;
  currentSecond: number | null;
  previous: number | null;
  previousSecond: number | null;
}

type SeriesMode = "period" | "cumulative";

const TICK = { fontSize: 11, fill: "var(--muted)" } as const;
const GRID = "rgba(255, 255, 255, 0.06)";
const CURSOR = { stroke: "rgba(255, 255, 255, 0.16)", strokeWidth: 1, strokeDasharray: "4 4" };
const MODE_OPTIONS = [
  { value: "period", label: "Per period" },
  { value: "cumulative", label: "Cumulative" },
];

/**
 * Rows for the comparison line: the current series verbatim, and the previous
 * series aligned from the most recent bucket so equal-length windows line up
 * even when a week/month boundary adds one bucket at the far end.
 */
export function buildTrendRows(
  current: ExpenseSeriesResponse | null,
  previous: ExpenseSeriesResponse | null,
): TrendRowReport[] {
  const currentPoints = current?.points ?? [];
  const previousPoints = previous?.points ?? [];
  const offset = previousPoints.length - currentPoints.length;
  return currentPoints.map((point, index) => {
    const prevPoint = previousPoints[index + offset];
    return {
      key: point.bucket,
      current: point.total,
      currentSecond: point.secondaryTotal ?? null,
      previous: prevPoint?.total ?? null,
      previousSecond: prevPoint?.secondaryTotal ?? null,
    };
  });
}

/** Running totals across the buckets, for the cumulative reading. */
function toCumulative(rows: TrendRowReport[]): TrendRowReport[] {
  let current = 0;
  let previous = 0;
  let currentSecond = 0;
  let previousSecond = 0;
  return rows.map((row) => {
    current += row.current ?? 0;
    previous += row.previous ?? 0;
    currentSecond += row.currentSecond ?? 0;
    previousSecond += row.previousSecond ?? 0;
    return {
      key: row.key,
      current,
      currentSecond,
      previous,
      previousSecond,
    };
  });
}

interface TooltipEntry {
  payload?: TrendRowReport;
}

function TrendTooltip({
  active,
  payload,
  label,
  granularity,
  base,
  second,
  estimated,
  mode,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  granularity: ReportGranularity;
  base: string | null;
  second: string | null;
  estimated: boolean;
  mode: SeriesMode;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  const heading = bucketHeading(String(label ?? row.key), granularity);
  const diff =
    row.current == null && row.previous == null ? null : (row.current ?? 0) - (row.previous ?? 0);
  const diffSecond =
    row.currentSecond != null && row.previousSecond != null
      ? row.currentSecond - row.previousSecond
      : null;
  const rate = effectiveRate(row.current, row.currentSecond);
  const thisLabel = mode === "cumulative" ? "Cumulative" : "This period";

  const money = (value: number | null, code: string | null) =>
    value == null || !code ? "—" : formatMoney(value, code);
  const signed = (value: number, code: string | null) =>
    `${value > 0 ? "+" : ""}${money(value, code)}`;

  return (
    <div className="min-w-[12.5rem] rounded-[var(--radius-stock,8px)] border border-border bg-paper px-3 py-2 shadow-2xl">
      <p className="mb-1.5 text-xs font-medium text-ink">{heading}</p>
      <ul className="space-y-1">
        <TooltipRow
          dot="var(--primary)"
          label={thisLabel}
          value={money(row.current, base)}
          secondary={
            row.currentSecond == null || !second ? null : formatMoney(row.currentSecond, second)
          }
        />
        <TooltipRow
          dot="var(--chart-secondary)"
          label="Previous period"
          value={money(row.previous, base)}
          secondary={
            row.previousSecond == null || !second ? null : formatMoney(row.previousSecond, second)
          }
        />
        <TooltipRow
          dot="transparent"
          label="Difference"
          value={diff == null ? "—" : signed(diff, base)}
          secondary={diffSecond == null || !second ? null : signed(diffSecond, second)}
          strong
        />
      </ul>
      {rate !== null && base && second && (
        <p className="mt-1.5 border-t border-border pt-1.5 text-[11px] tabular-nums text-muted">
          {granularity === "day" ? "Rate" : "Avg rate"}: 1 {base} = {formatRateValue(rate)}{" "}
          {second}
          {estimated && <span className="ml-1 text-warning">est.</span>}
        </p>
      )}
    </div>
  );
}

function TooltipRow({
  dot,
  label,
  value,
  secondary,
  strong = false,
}: {
  dot: string;
  label: string;
  value: string;
  secondary: string | null;
  strong?: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-4 text-xs">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span
          aria-hidden="true"
          className="mt-1 inline-block size-2 shrink-0 rounded-full"
          style={{ backgroundColor: dot }}
        />
        <span className={strong ? "text-ink" : "truncate text-muted"}>{label}</span>
      </span>
      <span className="text-right">
        <span
          className={`block tabular-nums ${strong ? "font-semibold text-ink" : "font-medium text-ink"}`}
        >
          {value}
        </span>
        {secondary && <span className="block text-[11px] tabular-nums text-muted">{secondary}</span>}
      </span>
    </li>
  );
}

export function SpendingOverTime({
  rows,
  granularity,
  base,
  second,
  snapshot,
  estimated,
  rangeLabel,
  loading,
  error,
  onRetry,
  className = "",
}: {
  rows: TrendRowReport[];
  granularity: ReportGranularity;
  base: string | null;
  second: string | null;
  snapshot: RateSnapshot | null;
  estimated: boolean;
  rangeLabel: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const [mode, setMode] = useState<SeriesMode>("period");
  const [showSecondAxis, setShowSecondAxis] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const chartRows = useMemo(
    () => (mode === "cumulative" ? toCumulative(rows) : rows),
    [rows, mode],
  );

  const bounds = selected ? bucketBounds(selected, granularity) : null;
  const drill = useReportExpenses({ from: bounds?.from, to: bounds?.to, limit: 5 });

  const table: ChartTable = useMemo(() => {
    const columns = ["Bucket", `This period (${base ?? "—"})`];
    if (second) columns.push(`This period (${second})`);
    columns.push(`Previous (${base ?? "—"})`, `Difference (${base ?? "—"})`);
    return {
      caption: `Spending over time, ${granularity} buckets, ${mode === "cumulative" ? "cumulative" : "per period"}`,
      columns,
      rows: chartRows.map((row) => {
        const cells = [bucketHeading(row.key, granularity), fmt(row.current, base)];
        if (second) cells.push(fmt(row.currentSecond, second));
        const diff =
          row.current == null && row.previous == null
            ? null
            : (row.current ?? 0) - (row.previous ?? 0);
        cells.push(
          fmt(row.previous, base),
          diff == null ? "—" : `${diff > 0 ? "+" : ""}${fmt(diff, base)}`,
        );
        return cells;
      }),
    };
  }, [chartRows, granularity, base, second, mode]);

  const hasSpending = rows.some((row) => (row.current ?? 0) > 0);
  const isEmpty = rows.length === 0 || !hasSpending;
  const showSecondLine = Boolean(second) && showSecondAxis;

  return (
    <ReportCard
      title="Spending over time"
      subtitle={`${granularityLabel(granularity)} · ${rangeLabel}`}
      table={table}
      loading={loading}
      skeleton={<Skeleton className="h-[280px]" />}
      error={error}
      onRetry={onRetry}
      empty={
        isEmpty ? (
          <p className="py-12 text-center text-sm text-muted">No spending in this period yet</p>
        ) : undefined
      }
      className={className}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            label="Series reading"
            options={MODE_OPTIONS}
            value={mode}
            onChange={(value) => setMode(value as SeriesMode)}
          />
          {second && (
            <label className="inline-flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={showSecondAxis}
                onChange={(event) => setShowSecondAxis(event.target.checked)}
                className="size-3.5 rounded border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                style={{ accentColor: "var(--primary)" }}
              />
              Show second currency axis
            </label>
          )}
        </div>
      }
      footer={`Click a point to list that period's expenses. The dashed grey-blue line is the ${granularity === "day" ? "day" : granularity} before.`}
    >
      <div className="cursor-pointer" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartRows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.34} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
            <XAxis
              dataKey="key"
              tick={TICK}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={28}
              interval="preserveStartEnd"
              tickFormatter={(value: string) => bucketAxis(value, granularity)}
            />
            <YAxis
              yAxisId="left"
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={[0, "auto"]}
              tickFormatter={compactAxis}
            />
            {showSecondLine && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={TICK}
                tickLine={false}
                axisLine={false}
                width={48}
                domain={[0, "auto"]}
                tickFormatter={compactAxis}
              />
            )}
            <Tooltip
              cursor={CURSOR}
              isAnimationActive={false}
              content={
                <TrendTooltip
                  granularity={granularity}
                  base={base}
                  second={second}
                  estimated={estimated}
                  mode={mode}
                />
              }
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="current"
              name="This period"
              stroke="var(--primary)"
              strokeWidth={2}
              strokeLinecap="round"
              fill={`url(#${gradientId})`}
              fillOpacity={1}
              dot={{ r: 2.5, fill: "var(--primary)", strokeWidth: 0 }}
              activeDot={{ r: 4.5, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={!reduced}
              animationDuration={reduced ? 0 : 700}
              onClick={(datum: unknown) => {
                const row = datum as TrendRowReport;
                if (row?.key) setSelected(row.key);
              }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="previous"
              name="Previous period"
              stroke="var(--chart-secondary)"
              strokeWidth={1.75}
              strokeDasharray="5 4"
              strokeLinecap="round"
              dot={{ r: 2, fill: "var(--chart-secondary)", strokeWidth: 0 }}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={!reduced}
              animationDuration={reduced ? 0 : 700}
            />
            {showSecondLine && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="currentSecond"
                name="This period (second currency)"
                stroke="var(--primary)"
                strokeWidth={1.25}
                strokeOpacity={0.55}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            {showSecondLine && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="previousSecond"
                name="Previous period (second currency)"
                stroke="var(--chart-secondary)"
                strokeWidth={1.25}
                strokeOpacity={0.4}
                strokeDasharray="5 4"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {selected && bounds && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-ink">{bucketHeading(selected, granularity)}</p>
            <Link
              href={`/expenses/transactions?from=${bounds.from}&to=${bounds.to}`}
              className="text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              View all
            </Link>
          </div>
          {drill.error ? (
            <p className="py-3 text-sm text-danger">{drill.error}</p>
          ) : drill.loading ? (
            <p className="py-3 text-sm text-muted">Loading…</p>
          ) : (drill.data?.items.length ?? 0) === 0 ? (
            <p className="py-3 text-sm text-muted">No expenses recorded in this period.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(drill.data?.items ?? []).map((expense) => {
                const pair = dualAmounts(expense.amount, expense.currency, base, second, snapshot);
                const primaryCurrency =
                  pair.base !== null ? (base ?? expense.currency) : expense.currency;
                const primaryAmount = pair.base ?? expense.amount;
                return (
                  <li key={expense.id}>
                    <TransactionRow
                      href={`/expenses/${expense.id}`}
                      color={expense.categoryColor}
                      title={expense.description || expense.categoryName}
                      meta={`${expense.incurredOn} · ${expense.categoryName}`}
                      amount={primaryAmount}
                      currency={primaryCurrency}
                      secondary={
                        pair.second != null && second ? { amount: pair.second, currency: second } : null
                      }
                      paid={
                        expense.currency !== primaryCurrency
                          ? { amount: expense.amount, currency: expense.currency }
                          : null
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </ReportCard>
  );
}

function fmt(value: number | null | undefined, code: string | null): string {
  if (value == null || !code) return "—";
  return formatMoney(value, code);
}
