"use client";

/**
 * Chart primitives.
 *
 * Every chart in the app is a line chart on graphite with one mint accent: no
 * bars from a generic library, no donuts, no saturated rainbow. These wrappers
 * keep that promise in one place and supply the things a bare charting library
 * leaves out:
 *
 * - a soft emerald gradient under the primary line and a quieter second line,
 * - a dual-value tooltip (both currencies) and a vertical hover guide,
 * - a table alternative that is keyboard-reachable, not just screen-reader
 *   hidden,
 * - calm skeleton loading and an empty state instead of an empty grid,
 * - animation that respects `prefers-reduced-motion`.
 *
 * Recharts is the renderer; these components own the styling and accessibility.
 */

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart as RechartsLineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** True when the OS asks for reduced motion; read as an external store. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* Card frame                                                          */
/* ------------------------------------------------------------------ */

export interface ChartTable {
  caption: string;
  columns: string[];
  rows: Array<Array<string>>;
}

/** The calm stand-in shown while a chart's data is loading. */
function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      role="status"
      aria-label="Loading chart"
      className="relative overflow-hidden rounded-[var(--radius-card,8px)] bg-paper"
      style={{ height }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-pulse"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.045), transparent)",
        }}
      />
    </div>
  );
}

/** The chart, as a real table — reachable by keyboard, not only a screen reader. */
function ChartDataTable({ table }: { table: ChartTable }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{table.caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {table.columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-xs font-medium text-muted"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`whitespace-nowrap px-3 py-2 ${
                    cellIndex === 0 ? "text-ink" : "tabular-nums text-muted"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartFrame({
  title,
  subtitle,
  action,
  children,
  table,
  srTable,
  loading = false,
  skeleton,
  empty,
  footer,
  glow = false,
  compact = false,
  clip = true,
  height = 280,
  className = "",
  bodyClassName = "",
  hideTableToggle = false,
  showTable,
  onShowTableChange,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** The chart itself. */
  children: ReactNode;
  /** Data-table alternative offered beside the chart. */
  table?: ChartTable;
  /**
   * A screen-reader-only table for charts whose visual form is replaced by a
   * richer card layout (e.g. the dashboard hero) rather than a simple toggle.
   */
  srTable?: ChartTable;
  loading?: boolean;
  /** Custom loading content; defaults to a chart-shaped block. */
  skeleton?: ReactNode;
  /** Replaces the chart when there is genuinely nothing to plot. */
  empty?: ReactNode;
  footer?: ReactNode;
  /** Adds the soft emerald glow, reserved for hero cards. */
  glow?: boolean;
  /**
   * Tighter padding and a small section label, for the dashboard's
   * compact grid. The default is the roomier report-card treatment.
   */
  compact?: boolean;
  /** Set false when a child (e.g. a hover tooltip) must escape the card edges. */
  clip?: boolean;
  height?: number;
  className?: string;
  bodyClassName?: string;
  /** Hide the built-in "Table/Chart" pill; the table is then controlled by the caller. */
  hideTableToggle?: boolean;
  /** Controlled table visibility (overrides the internal toggle when provided). */
  showTable?: boolean;
  /** Called when the caller's table toggle or the built-in pill flips the view. */
  onShowTableChange?: (show: boolean) => void;
}) {
  const [internalShowTable, setInternalShowTable] = useState(false);
  const tableVisible = showTable ?? internalShowTable;
  const toggleTable = () => {
    const next = !tableVisible;
    if (onShowTableChange) onShowTableChange(next);
    else setInternalShowTable(next);
  };
  const canToggle = Boolean(table) && !loading && !empty && !hideTableToggle;

  return (
    <section
      className={`relative border border-border bg-paper ${
        clip ? "overflow-hidden" : ""
      } ${compact ? "rounded-[20px]" : "rounded-[var(--radius-card,8px)]"} ${className}`}
    >
      {glow && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 left-[12%] h-64 w-64 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, var(--glow-strong), transparent 70%)" }}
        />
      )}
      <header
        className={`relative flex flex-wrap items-start justify-between gap-3 ${
          compact ? "px-5 pt-4" : "px-5 pt-5 sm:px-6"
        }`}
      >
        <div className="min-w-0">
          <h2
            className={
              compact
                ? "text-xs font-medium text-muted"
                : "text-sm font-medium text-ink"
            }
          >
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {action}
          {canToggle && (
            <button
              type="button"
              aria-pressed={tableVisible}
              onClick={toggleTable}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted transition-colors duration-150 hover:border-border-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {tableVisible ? "Chart" : "Table"}
            </button>
          )}
        </div>
      </header>
      <div
        className={`relative ${
          compact ? "px-5 pb-5 pt-3" : "px-4 pb-5 pt-3 sm:px-5"
        } ${bodyClassName}`}
      >
        {loading ? (
          skeleton ?? <ChartSkeleton height={height} />
        ) : empty ? (
          empty
        ) : tableVisible && table ? (
          <ChartDataTable table={table} />
        ) : (
          <>
            {children}
            {srTable && !tableVisible && (
              <div className="sr-only">
                <ChartDataTable table={srTable} />
              </div>
            )}
          </>
        )}
      </div>
      {footer && (
        <div
          className={`relative text-xs leading-relaxed text-muted ${
            compact ? "px-5 pb-4" : "px-5 pb-5 sm:px-6"
          }`}
        >
          {footer}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Shared axis styling                                                 */
/* ------------------------------------------------------------------ */

const TICK = { fontSize: 11, fill: "var(--muted)" } as const;
const GRID = "rgba(255, 255, 255, 0.06)";
const CURSOR = { stroke: "rgba(255, 255, 255, 0.16)", strokeWidth: 1 };

/** Compact axis labels: 12k rather than 12000. */
export function compactAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(value);
}

/* ------------------------------------------------------------------ */
/* Dual-axis line chart                                                */
/* ------------------------------------------------------------------ */

export interface TrendSeries {
  key: string;
  /** Legend/tooltip label. */
  label: string;
  color: string;
  /** Which Y axis the series reads from. Defaults to the left. */
  axis?: "left" | "right";
  /** Soft gradient fill under the line — reserved for the primary series. */
  area?: boolean;
  /** Thinner, quieter stroke — the second currency. */
  quiet?: boolean;
  dashed?: boolean;
  /** Set false to hide the per-point dots (busy series). */
  dots?: boolean;
  /** Render nothing for this series (used by the Both/Base/Second toggle). */
  hidden?: boolean;
}

export type TrendRow = Record<string, number | string | null>;

export interface TrendLineChartProps {
  data: TrendRow[];
  xKey: string;
  series: TrendSeries[];
  height?: number;
  leftTickFormatter?: (value: number) => string;
  rightTickFormatter?: (value: number) => string;
  xTickFormatter?: (value: string) => string;
  /** Formats one series value for the tooltip (currency-aware). */
  formatValue?: (value: number, seriesKey: string) => string;
  /** Clicking a point hands the whole row back for drill-down. */
  onPointClick?: (row: TrendRow) => void;
  leftDomain?: [number | "auto", number | "auto"];
  rightDomain?: [number | "auto", number | "auto"];
  /** A dot drawn on top of the line, e.g. the day-of-week peak. */
  highlight?: { x: string; y: number; axis?: "left" | "right" } | null;
  className?: string;
}

interface TooltipEntry {
  dataKey?: string | number;
  value?: unknown;
  color?: string;
  name?: string;
}

function TrendTooltip({
  active,
  payload,
  label,
  xTickFormatter,
  formatValue,
  quietKeys,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  xTickFormatter?: (value: string) => string;
  formatValue?: (value: number, seriesKey: string) => string;
  quietKeys: string[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const heading =
    typeof label === "string" && xTickFormatter ? xTickFormatter(label) : String(label ?? "");

  return (
    <div className="min-w-[11rem] rounded-[var(--radius-stock,8px)] border border-border bg-paper px-3 py-2 shadow-2xl">
      {heading && <p className="mb-1.5 text-xs font-medium text-ink">{heading}</p>}
      <ul className="space-y-1">
        {payload.map((entry, index) => {
          const key = String(entry.dataKey ?? index);
          const numeric = typeof entry.value === "number" ? entry.value : Number(entry.value);
          const quiet = quietKeys.includes(key);
          return (
            <li key={key} className="flex items-center justify-between gap-4 text-xs">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className={quiet ? "truncate text-muted" : "truncate text-ink"}>
                  {entry.name ?? key}
                </span>
              </span>
              <span className={`tabular-nums ${quiet ? "text-muted" : "font-medium text-ink"}`}>
                {entry.value == null || Number.isNaN(numeric)
                  ? "—"
                  : formatValue
                    ? formatValue(numeric, key)
                    : String(entry.value)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TrendLineChart({
  data,
  xKey,
  series,
  height = 280,
  leftTickFormatter,
  rightTickFormatter,
  xTickFormatter,
  formatValue,
  onPointClick,
  leftDomain = [0, "auto"],
  rightDomain = ["auto", "auto"],
  highlight = null,
  className = "",
}: TrendLineChartProps) {
  const reduced = usePrefersReducedMotion();
  const rawId = useId();
  const gradientId = `trend-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const visible = series.filter((entry) => !entry.hidden);
  const hasRightAxis = visible.some((entry) => entry.axis === "right");
  const quietKeys = visible.filter((entry) => entry.quiet).map((entry) => entry.key);

  return (
    <div
      className={`${className} ${onPointClick ? "cursor-pointer" : ""}`}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: hasRightAxis ? 0 : 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.34} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey={xKey}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={28}
            interval="preserveStartEnd"
            tickFormatter={xTickFormatter}
          />
          <YAxis
            yAxisId="left"
            tick={TICK}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={leftDomain}
            tickFormatter={leftTickFormatter}
          />
          {hasRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={rightDomain}
              tickFormatter={rightTickFormatter}
            />
          )}
          <Tooltip
            cursor={CURSOR}
            isAnimationActive={false}
            content={
              <TrendTooltip
                xTickFormatter={xTickFormatter}
                formatValue={formatValue}
                quietKeys={quietKeys}
              />
            }
          />
          {visible.map((entry) => {
            const clickable = Boolean(onPointClick);
            const handleClick = clickable
              ? (datum: unknown) => onPointClick?.(datum as TrendRow)
              : undefined;
            const shared = {
              dataKey: entry.key,
              name: entry.label,
              yAxisId: entry.axis ?? "left",
              stroke: entry.color,
              strokeWidth: entry.quiet ? 1.5 : 2.25,
              strokeDasharray: entry.dashed ? "4 4" : undefined,
              type: "monotone" as const,
              connectNulls: false,
              isAnimationActive: !reduced,
              animationDuration: reduced ? 0 : 700,
              dot: entry.dots === false ? (false as const) : { r: 2.5, fill: entry.color, strokeWidth: 0 },
              activeDot: { r: 4.5, strokeWidth: 0 },
              onClick: handleClick,
            };
            if (entry.area) {
              return (
                <Area
                  key={entry.key}
                  {...shared}
                  fill={`url(#${gradientId})`}
                  fillOpacity={1}
                />
              );
            }
            return <Line key={entry.key} {...shared} fill="none" />;
          })}
          {highlight && (
            <ReferenceDot
              x={highlight.x}
              y={highlight.y}
              yAxisId={highlight.axis ?? "left"}
              r={5}
              fill="var(--primary)"
              stroke="var(--canvas)"
              strokeWidth={2}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Comparison chart                                                    */
/* ------------------------------------------------------------------ */

export interface ComparisonRow {
  /** Bucket key: `YYYY-MM-DD` for day buckets, `YYYY-MM` for months. */
  key: string;
  current: number | null;
  previous: number | null;
  currentSecond?: number | null;
  previousSecond?: number | null;
}

function ComparisonTooltip({
  active,
  payload,
  label,
  headingFormatter,
  currentLabel,
  previousLabel,
  formatPrimary,
  formatSecondary,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ComparisonRow }>;
  label?: string | number;
  headingFormatter: (key: string) => string;
  currentLabel: string;
  previousLabel: string;
  formatPrimary: (value: number) => string;
  formatSecondary: (value: number) => string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  const heading = headingFormatter(String(label ?? row.key));
  const diff =
    row.current == null && row.previous == null
      ? null
      : (row.current ?? 0) - (row.previous ?? 0);
  const diffSecond =
    row.currentSecond != null && row.previousSecond != null
      ? row.currentSecond - row.previousSecond
      : null;

  const signed = (value: number) => `${value > 0 ? "+" : ""}${formatPrimary(value)}`;

  return (
    <div className="min-w-[12rem] rounded-[var(--radius-stock,8px)] border border-border bg-paper px-3 py-2 shadow-2xl">
      <p className="mb-1.5 text-xs font-medium text-ink">{heading}</p>
      <ul className="space-y-1">
        <TooltipRow
          dot="var(--primary)"
          label={currentLabel}
          value={row.current == null ? "—" : formatPrimary(row.current)}
          secondary={row.currentSecond == null ? null : formatSecondary(row.currentSecond)}
        />
        <TooltipRow
          dot="var(--chart-secondary)"
          label={previousLabel}
          value={row.previous == null ? "—" : formatPrimary(row.previous)}
          secondary={row.previousSecond == null ? null : formatSecondary(row.previousSecond)}
        />
        <TooltipRow
          dot="transparent"
          label="Difference"
          value={diff == null ? "—" : signed(diff)}
          secondary={diffSecond == null ? null : signed(diffSecond)}
          strong
        />
      </ul>
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
        <span className={`block tabular-nums ${strong ? "font-semibold text-ink" : "font-medium text-ink"}`}>
          {value}
        </span>
        {secondary && <span className="block text-[11px] tabular-nums text-muted">{secondary}</span>}
      </span>
    </li>
  );
}

/**
 * The "this period vs the last one" chart: two cumulative lines, one per
 * window, sharing the left axis. The second-currency axis is opt-in because
 * plotting the same data twice is noisy — when it is on, the same two series
 * are mirrored on the right in a quieter grey.
 */
export function ComparisonChart({
  data,
  currentLabel,
  previousLabel,
  formatPrimary,
  formatSecondary,
  xTickFormatter,
  xHeadingFormatter,
  showSecondAxis = false,
  height = 200,
  leftTickFormatter,
  rightTickFormatter,
  leftDomain,
  latestPoint = null,
  className = "",
}: {
  data: ComparisonRow[];
  currentLabel: string;
  previousLabel: string;
  formatPrimary: (value: number) => string;
  formatSecondary: (value: number) => string;
  xTickFormatter: (key: string) => string;
  xHeadingFormatter: (key: string) => string;
  showSecondAxis?: boolean;
  height?: number;
  leftTickFormatter?: (value: number) => string;
  rightTickFormatter?: (value: number) => string;
  /** Explicit left-axis bounds (e.g. data maximum plus headroom); `[0, "auto"]` when omitted. */
  leftDomain?: [number, number | "auto"];
  /** A dot drawn on the latest point of the current series. */
  latestPoint?: { x: string; y: number } | null;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const rawId = useId();
  const gradientId = `cmp-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const showRight = showSecondAxis && data.some((row) => row.currentSecond != null);

  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: showRight ? 0 : 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.34} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="key"
            tick={TICK}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            interval="preserveStartEnd"
            tickFormatter={xTickFormatter}
          />
          <YAxis
            yAxisId="left"
            tick={TICK}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={leftDomain ?? [0, "auto"]}
            tickFormatter={leftTickFormatter}
          />
          {showRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={[0, "auto"]}
              tickFormatter={rightTickFormatter}
            />
          )}
          <Tooltip
            cursor={CURSOR}
            isAnimationActive={false}
            content={
              <ComparisonTooltip
                headingFormatter={xHeadingFormatter}
                currentLabel={currentLabel}
                previousLabel={previousLabel}
                formatPrimary={formatPrimary}
                formatSecondary={formatSecondary}
              />
            }
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="current"
            name={currentLabel}
            stroke="var(--primary)"
            strokeWidth={2.25}
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            dot={false}
            activeDot={{ r: 4.5, strokeWidth: 0 }}
            connectNulls={true}
            isAnimationActive={!reduced}
            animationDuration={reduced ? 0 : 700}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="previous"
            name={previousLabel}
            stroke="var(--chart-secondary)"
            strokeWidth={1.75}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            connectNulls={true}
            isAnimationActive={!reduced}
            animationDuration={reduced ? 0 : 700}
          />
          {latestPoint && (
            <ReferenceDot
              x={latestPoint.x}
              y={latestPoint.y}
              yAxisId="left"
              r={4.5}
              fill="var(--primary)"
              stroke="var(--canvas)"
              strokeWidth={2}
            />
          )}
          {showRight && (
            <>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="currentSecond"
                name={`${currentLabel} (second)`}
                stroke="var(--muted)"
                strokeWidth={1.25}
                strokeOpacity={0.7}
                dot={false}
                connectNulls={true}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="previousSecond"
                name={`${previousLabel} (second)`}
                stroke="var(--muted)"
                strokeWidth={1.25}
                strokeOpacity={0.45}
                strokeDasharray="5 4"
                dot={false}
                connectNulls={true}
                isAnimationActive={false}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

export function Sparkline({
  data,
  dataKey,
  color = "var(--primary)",
  height = 36,
  className = "",
}: {
  data: TrendRow[];
  dataKey: string;
  color?: string;
  height?: number;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className={className} style={{ height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.75}
            dot={false}
            connectNulls={false}
            isAnimationActive={!reduced}
            animationDuration={reduced ? 0 : 500}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Table helper                                                        */
/* ------------------------------------------------------------------ */

/**
 * Builds the data-table alternative for a line chart so every chart exposes an
 * equivalent, keyboard-reachable reading of the same numbers.
 */
export function chartTable({
  caption,
  firstColumn,
  xKey,
  series,
  rows,
  xFormat,
  valueFormat,
}: {
  caption: string;
  firstColumn: string;
  xKey: string;
  series: Array<{ key: string; label: string }>;
  rows: TrendRow[];
  xFormat?: (value: string) => string;
  valueFormat?: (value: number | null, seriesKey: string) => string;
}): ChartTable {
  const format = valueFormat ?? ((value: number | null) => (value == null ? "—" : String(value)));
  return {
    caption,
    columns: [firstColumn, ...series.map((entry) => entry.label)],
    rows: rows.map((row) => {
      const rawX = row[xKey];
      const label = typeof rawX === "string" && xFormat ? xFormat(rawX) : String(rawX ?? "");
      return [
        label,
        ...series.map((entry) => {
          const value = row[entry.key];
          return format(typeof value === "number" ? value : null, entry.key);
        }),
      ];
    }),
  };
}
