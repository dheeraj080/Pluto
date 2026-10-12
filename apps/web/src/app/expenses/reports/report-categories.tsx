"use client";

/**
 * The category section: a donut (with a stacked-area "over time" alternative)
 * on the left, and the ranked category list on the right, over a single
 * 12-column grid.
 *
 * Left, 4 columns — "Share | Over time":
 *  - Share: a donut of every category, ranked, in a muted palette, with the
 *    range total in the centre (primary large, secondary small). Hovering a
 *    segment — or the matching row on the right — dims everything else so the
 *    pair reads together.
 *  - Over time: a stacked area of the top five categories plus "Other", never
 *    overlapping because the areas stack. Clicking a legend chip isolates that
 *    category; clicking it again shows everything.
 *
 * Right, 8 columns — the ranked list, one compact ~52px line per category:
 * colour dot, name, grey count, a 60px sparkline over the same buckets as the
 * stacked area, a thin progress bar, the share, and the amounts (primary bold,
 * secondary beneath). The "Total" footer row is the sum of the rows and equals
 * the Total KPI. Clicking a row opens a side drawer of that category's
 * expenses, two values per row.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactAxis, usePrefersReducedMotion, type ChartTable } from "@/components/charts";
import { SegmentedControl, Skeleton } from "@/components/ui";
import { formatDateRange, formatMoney, formatPercent } from "@/lib/format";
import { dualAmounts } from "@/lib/convert";
import type { ReportGranularity } from "@/lib/ranges";
import type { CategoryBreakdown, RateSnapshot } from "@/lib/types";
import { TransactionRow } from "@/components/transaction-row";
import { DualAmount } from "@/components/amount";
import { ReportCard } from "./report-card";
import { bucketAxis, bucketHeading } from "./report-utils";
import { useReportCategorySeries, useReportExpenses } from "../use-reports";

type CategoryView = "share" | "overTime";

/** Muted donut palette: emerald, teal, sky, amber, rose, slate, violet. */
const PALETTE = ["#2fbf9d", "#35b7bf", "#4aa8e8", "#dcae4e", "#e5829a", "#8b98a8", "#9a8cd9"];
const OTHER_COLOR = "#8b98a8";
const OTHER_ID = "__other";

const VIEW_OPTIONS = [
  { value: "share", label: "Share" },
  { value: "overTime", label: "Over time" },
];

const TICK = { fontSize: 11, fill: "var(--muted)" } as const;
const GRID = "rgba(255, 255, 255, 0.06)";
const CURSOR = { stroke: "rgba(255, 255, 255, 0.16)", strokeWidth: 1 };

interface StackEntry {
  id: string;
  name: string;
  color: string;
  values: number[];
}

interface DonutSlice {
  id: string;
  name: string;
  value: number;
  color: string;
  secondary: number | null;
  share: number;
}

function fmt(value: number | null | undefined, code: string | null): string {
  if (value == null || !code) return "—";
  return formatMoney(value, code);
}

/** A tiny sparkline: one category's bucket totals over the range, flat when empty. */
function Sparkline({
  values,
  color,
  width = 60,
  height = 22,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (values.length === 0) {
    return <svg width={width} height={height} aria-hidden="true" className="shrink-0" />;
  }
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)},${(
          height -
          2 -
          ((value - min) / range) * (height - 5)
        ).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}

function DonutTooltip({
  active,
  payload,
  base,
  second,
}: {
  active?: boolean;
  payload?: Array<{ payload?: DonutSlice }>;
  base: string | null;
  second: string | null;
}) {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) return null;
  return (
    <div className="min-w-[10rem] rounded-xl border border-border bg-surface px-3 py-2 shadow-2xl">
      <div className="mb-1 flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ backgroundColor: slice.color }}
        />
        <p className="text-xs font-medium text-ink">{slice.name}</p>
      </div>
      <ul className="space-y-0.5">
        <li className="flex items-center justify-between gap-4 text-xs">
          <span className="text-muted">{base ?? "Amount"}</span>
          <span className="font-medium tabular-nums text-ink">{fmt(slice.value, base)}</span>
        </li>
        {slice.secondary != null && second && (
          <li className="flex items-center justify-between gap-4 text-xs">
            <span className="text-muted">{second}</span>
            <span className="tabular-nums text-ink">{fmt(slice.secondary, second)}</span>
          </li>
        )}
        <li className="flex items-center justify-between gap-4 text-xs">
          <span className="text-muted">Share</span>
          <span className="tabular-nums text-ink">{slice.share.toFixed(1)}%</span>
        </li>
      </ul>
    </div>
  );
}

function StackTooltip({
  active,
  payload,
  label,
  granularity,
  base,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string | Array<number | string>; color?: string }>;
  label?: string | number;
  granularity: ReportGranularity;
  base: string | null;
}) {
  if (!active || !payload) return null;
  const rows = payload
    .filter((entry) => typeof entry.value === "number")
    .map((entry) => ({
      name: entry.name ?? "—",
      value: entry.value as number,
      color: entry.color ?? "var(--muted)",
    }));
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="min-w-[11rem] rounded-xl border border-border bg-surface px-3 py-2 shadow-2xl">
      <p className="mb-1.5 text-xs font-medium text-ink">
        {bucketHeading(String(label ?? ""), granularity)}
      </p>
      <ul className="space-y-1">
        {rows.map((row, index) => (
          <li key={index} className="flex items-start justify-between gap-4 text-xs">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className="mt-1 inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="truncate text-muted">{row.name}</span>
            </span>
            <span className="font-medium tabular-nums text-ink">{fmt(row.value, base)}</span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-4 border-t border-border pt-1 text-xs">
          <span className="font-medium text-ink">Total</span>
          <span className="font-medium tabular-nums text-ink">{fmt(total, base)}</span>
        </li>
      </ul>
    </div>
  );
}

export function ReportCategories({
  from,
  to,
  granularity,
  rangeLabel,
  categories,
  count,
  total,
  secondaryTotal,
  base,
  second,
  snapshot,
  loading,
  error,
  onRetry,
  className = "",
}: {
  from: string;
  to: string;
  granularity: ReportGranularity;
  rangeLabel: string;
  categories: CategoryBreakdown[];
  count: number;
  total: number | null;
  secondaryTotal: number | null;
  base: string | null;
  second: string | null;
  snapshot: RateSnapshot | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [view, setView] = useState<CategoryView>("share");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const categorySeries = useReportCategorySeries({ from, to, granularity, base, secondary: second });

  const sectionLoading = loading || categorySeries.loading;
  const sectionError = error ?? categorySeries.error ?? null;
  const retryAll = () => {
    onRetry();
    categorySeries.reload();
  };

  /* --------------------------- shared shapes ---------------------------- */

  const rankOf = new Map(categories.map((entry, index) => [entry.categoryId, index]));
  const paletteFor = (id: string) => PALETTE[(rankOf.get(id) ?? 0) % PALETTE.length];

  const seriesItems = categorySeries.data?.series ?? [];
  const buckets = categorySeries.data?.buckets ?? [];
  const pointsById = new Map(seriesItems.map((item) => [item.categoryId, item.points.map((point) => point.total ?? 0)]));

  const hasSpending = categories.some((entry) => entry.total > 0);
  const isEmpty = categories.length === 0 || !hasSpending;
  const emptyNode = (
    <p className="py-12 text-center text-sm text-muted">No spending in this period yet</p>
  );

  const donutData: DonutSlice[] = categories
    .filter((entry) => entry.total > 0)
    .map((entry) => ({
      id: entry.categoryId,
      name: entry.categoryName,
      value: entry.total,
      color: paletteFor(entry.categoryId),
      secondary: entry.secondaryTotal ?? null,
      share: entry.percentage,
    }));

  /* Stacked area: top five + Other, same bucket axis as the top-level line. */
  const topEntries: StackEntry[] = seriesItems.slice(0, 5).map((item) => ({
    id: item.categoryId,
    name: item.categoryName,
    color: paletteFor(item.categoryId),
    values: item.points.map((point) => point.total ?? 0),
  }));
  const rest = seriesItems.slice(5);
  const otherEntry: StackEntry | null =
    rest.length > 0
      ? {
          id: OTHER_ID,
          name: "Other",
          color: OTHER_COLOR,
          values: buckets.map((_, index) =>
            rest.reduce((sum, item) => sum + (item.points[index]?.total ?? 0), 0),
          ),
        }
      : null;
  const visibleStack: StackEntry[] = otherEntry ? [...topEntries, otherEntry] : topEntries;
  const stackRows = buckets.map((bucket, index) => {
    const row: Record<string, number | string> = { bucket };
    for (const entry of visibleStack) row[entry.id] = entry.values[index];
    return row;
  });
  const isolatedEntry = visibleStack.find((entry) => entry.id === isolated) ?? null;
  const renderStack = isolatedEntry ? [isolatedEntry] : visibleStack;

  /* ------------------------------ tables -------------------------------- */

  const shareTable: ChartTable | undefined =
    categories.length > 0
      ? {
          caption: `Spending by category, ${rangeLabel}`,
          columns: [
            "Category",
            `Spent (${base ?? "—"})`,
            ...(second ? [`Spent (${second})`] : []),
            "Share",
          ],
          rows: categories.map((entry) => [
            entry.categoryName,
            fmt(entry.total, base),
            ...(second ? [entry.secondaryTotal == null ? "—" : fmt(entry.secondaryTotal, second)] : []),
            `${formatPercent(entry.percentage)}`,
          ]),
        }
      : undefined;

  const overTimeTable: ChartTable | undefined =
    stackRows.length > 0 && visibleStack.length > 0
      ? {
          caption: `Spending by category over time, ${rangeLabel}, ${granularity} buckets`,
          columns: ["Bucket", ...visibleStack.map((entry) => entry.name)],
          rows: stackRows.map((row) => [
            bucketHeading(String(row.bucket), granularity),
            ...visibleStack.map((entry) => fmt(row[entry.id] as number, base)),
          ]),
        }
      : undefined;

  const drawerCategory = categories.find((entry) => entry.categoryId === drawerId) ?? null;

  return (
    <div className={`grid grid-cols-1 gap-5 lg:grid-cols-12 ${className}`}>
      {/* ----------------------------- Left: donut / stacked area ------------------------ */}
      <section className="lg:col-span-4">
        <ReportCard
          title="By category"
          subtitle={`${rangeLabel} · ${view === "share" ? "share of spending" : "over time"}`}
          action={
            <SegmentedControl
              label="Category view"
              options={VIEW_OPTIONS}
              value={view}
              onChange={(value) => setView(value as CategoryView)}
            />
          }
          table={view === "share" ? shareTable : overTimeTable}
          loading={sectionLoading}
          skeleton={<Skeleton className="h-[240px]" />}
          error={sectionError}
          onRetry={retryAll}
          empty={isEmpty ? emptyNode : undefined}
        >
          {view === "share" ? (
            <div className="relative" style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="72%"
                    outerRadius="94%"
                    paddingAngle={1.5}
                    cornerRadius={3}
                    stroke="var(--surface)"
                    strokeWidth={2}
                    isAnimationActive={!reduced}
                    animationDuration={reduced ? 0 : 600}
                    onMouseEnter={(_data: unknown, index: number) => {
                      setHoveredId(donutData[index]?.id ?? null);
                    }}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {donutData.map((slice) => (
                      <Cell
                        key={slice.id}
                        fill={slice.color}
                        fillOpacity={hoveredId === null || hoveredId === slice.id ? 1 : 0.3}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={false}
                    isAnimationActive={false}
                    content={<DonutTooltip base={base} second={second} />}
                  />
                </PieChart>
              </ResponsiveContainer>
              {total != null && base && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                  <DualAmount
                    amount={total}
                    currency={base}
                    secondaryAmount={secondaryTotal}
                    secondaryCurrency={second}
                    size="kpi"
                    layout="stack"
                  />
                  <span className="text-[11px] tabular-nums text-muted">
                    {count} {count === 1 ? "expense" : "expenses"}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {visibleStack.map((entry) => {
                  const active = isolatedEntry === null || isolatedEntry.id === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      aria-pressed={isolatedEntry?.id === entry.id}
                      onClick={() =>
                        setIsolated(isolatedEntry?.id === entry.id ? null : entry.id)
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                        active
                          ? "border-border-strong text-ink"
                          : "border-border text-muted opacity-60"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      {entry.name}
                    </button>
                  );
                })}
              </div>
              {isolatedEntry && (
                <p className="mb-2 text-[11px] text-muted">
                  Showing only {isolatedEntry.name} — click it again to show all.
                </p>
              )}
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stackRows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis
                      dataKey="bucket"
                      tick={TICK}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      minTickGap={28}
                      interval="preserveStartEnd"
                      tickFormatter={(value: string) => bucketAxis(value, granularity)}
                    />
                    <YAxis
                      tick={TICK}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      domain={[0, "auto"]}
                      tickFormatter={compactAxis}
                    />
                    <Tooltip
                      cursor={CURSOR}
                      isAnimationActive={false}
                      content={<StackTooltip granularity={granularity} base={base} />}
                    />
                    {renderStack.map((entry) => (
                      <Area
                        key={entry.id}
                        type="monotone"
                        dataKey={entry.id}
                        name={entry.name}
                        stackId="1"
                        stroke={entry.color}
                        strokeWidth={1.5}
                        fill={entry.color}
                        fillOpacity={0.85}
                        dot={false}
                        activeDot={false}
                        connectNulls={false}
                        isAnimationActive={!reduced}
                        animationDuration={reduced ? 0 : 600}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </ReportCard>
      </section>

      {/* ----------------------------- Right: ranked list ------------------------------ */}
      <section className="lg:col-span-8">
        <ReportCard
          title="Categories"
          subtitle={`${rangeLabel} · ranked`}
          loading={sectionLoading}
          skeleton={<Skeleton className="h-72" />}
          error={sectionError}
          onRetry={retryAll}
          empty={isEmpty ? emptyNode : undefined}
        >
          <ul className="divide-y divide-border">
            {categories.map((entry) => {
              const rowColor = paletteFor(entry.categoryId);
              const dimmed = hoveredId !== null && hoveredId !== entry.categoryId;
              const active = hoveredId === entry.categoryId;
              const max = categories[0]?.total ?? 0;
              const width = max > 0 ? (entry.total / max) * 100 : 0;
              return (
                <li key={entry.categoryId}>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={drawerCategory?.categoryId === entry.categoryId}
                    onClick={() => setDrawerId(entry.categoryId)}
                    onMouseEnter={() => setHoveredId(entry.categoryId)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setHoveredId(entry.categoryId)}
                    onBlur={() => setHoveredId(null)}
                    className={`block w-full text-left transition-opacity duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                      active ? "rounded-lg bg-surface-muted" : ""
                    } ${dimmed ? "opacity-40" : ""}`}
                    style={{ minHeight: 52 }}
                  >
                    <span className="flex items-center gap-2 py-2.5 md:py-2">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: rowColor }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink md:w-28 md:flex-none">
                        {entry.categoryName}
                      </span>
                      <span className="hidden shrink-0 text-[11px] tabular-nums text-muted md:inline">
                        {entry.count} {entry.count === 1 ? "expense" : "expenses"}
                      </span>
                      <span className="hidden shrink-0 md:block">
                        <Sparkline values={pointsById.get(entry.categoryId) ?? []} color={rowColor} />
                      </span>
                      <span
                        aria-hidden="true"
                        className="hidden h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-surface-muted md:block"
                      >
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${width}%`, backgroundColor: rowColor }}
                        />
                      </span>
                      <span className="hidden w-10 shrink-0 text-right text-xs tabular-nums text-muted md:inline">
                        {formatPercent(entry.percentage)}
                      </span>
                      <DualAmount
                        amount={entry.total}
                        currency={base ?? "USD"}
                        secondaryAmount={entry.secondaryTotal ?? null}
                        secondaryCurrency={entry.secondaryTotal != null ? second : null}
                        size="sm"
                        layout="stack"
                        align="right"
                        className="w-[86px] shrink-0"
                      />
                    </span>
                    <span className="flex items-center gap-3 px-1 pb-2.5 md:hidden">
                      <span className="shrink-0 text-[11px] tabular-nums text-muted">
                        {entry.count} {entry.count === 1 ? "expense" : "expenses"}
                      </span>
                      <Sparkline values={pointsById.get(entry.categoryId) ?? []} color={rowColor} />
                      <span
                        aria-hidden="true"
                        className="h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-surface-muted"
                      >
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${width}%`, backgroundColor: rowColor }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">
                        {formatPercent(entry.percentage)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {categories.length > 0 && (
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border-strong pt-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Total</p>
                <p className="text-[11px] text-muted">Sum of rows — equals the Total KPI.</p>
              </div>
              <DualAmount
                amount={total ?? 0}
                currency={base ?? "USD"}
                secondaryAmount={secondaryTotal}
                secondaryCurrency={second}
                size="sm"
                layout="stack"
                align="right"
              />
            </div>
          )}
        </ReportCard>
      </section>

      {drawerCategory && (
        <CategoryDrawer
          category={drawerCategory}
          color={paletteFor(drawerCategory.categoryId)}
          from={from}
          to={to}
          base={base}
          second={second}
          snapshot={snapshot}
          onClose={() => setDrawerId(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category expense drawer                                             */
/* ------------------------------------------------------------------ */

function CategoryDrawer({
  category,
  color,
  from,
  to,
  base,
  second,
  snapshot,
  onClose,
}: {
  category: CategoryBreakdown;
  color: string;
  from: string;
  to: string;
  base: string | null;
  second: string | null;
  snapshot: RateSnapshot | null;
  onClose: () => void;
}) {
  const list = useReportExpenses({ from, to, categoryId: category.categoryId, limit: 50 });
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${category.categoryName} expenses`}
      className="fixed inset-0 z-50"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <span
                aria-hidden="true"
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="truncate">{category.categoryName}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {formatDateRange(from, to)} · {category.count}{" "}
              {category.count === 1 ? "expense" : "expenses"}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {list.error ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger/25 bg-danger-subtle px-3.5 py-2.5 text-sm text-danger">
              <span className="leading-snug">{list.error}</span>
              <button
                type="button"
                onClick={list.reload}
                className="rounded-lg border border-danger/30 px-2.5 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
              >
                Retry
              </button>
            </div>
          ) : list.loading ? (
            <div className="space-y-3">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : (list.data?.items.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              No expenses in this category in this period.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {list.data?.items.map((expense) => {
                const pair = dualAmounts(expense.amount, expense.currency, base, second, snapshot);
                const primaryCurrency =
                  pair.base !== null ? (base ?? expense.currency) : expense.currency;
                return (
                  <li key={expense.id}>
                    <TransactionRow
                      href={`/expenses/${expense.id}`}
                      color={expense.categoryColor}
                      title={expense.description || expense.categoryName}
                      meta={`${expense.incurredOn} · ${expense.categoryName}`}
                      amount={pair.base ?? expense.amount}
                      currency={primaryCurrency}
                      secondary={
                        pair.second != null && second
                          ? { amount: pair.second, currency: second }
                          : null
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-xs tabular-nums text-muted">
            {list.data
              ? `Showing ${Math.min(list.data.items.length, list.data.total)} of ${list.data.total}`
              : null}
          </p>
          <Link
            href={`/expenses/transactions?categoryId=${category.categoryId}&from=${from}&to=${to}`}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            View all expenses
          </Link>
        </footer>
      </div>
    </div>
  );
}