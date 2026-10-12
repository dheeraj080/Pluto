"use client";

/**
 * Reports.
 *
 * A period picked from presets, then read through line charts only — no bars,
 * no donut. Every chart shows the Pair: the Base as a mint line with a soft
 * gradient fill, the Second as a thinner quiet line on its own axis.
 *
 *  1. a KPI row (Total, Expenses, Average, Top category) in both currencies;
 *  2. the 12-month trend, two lines / two axes, with a point click that lists
 *     that month's expenses below;
 *  3. spending by day of week, with the peak marked;
 *  4. spend by category over time, with a toggling legend and a ranked list;
 *  5. the Base ⇄ Second rate.
 *
 * Each chart carries a data-table alternative for keyboard and screen-reader
 * access, and reports "—" rather than zero wherever conversion is impossible.
 */

import { useMemo, useState, type ReactNode } from "react";
import { expensesApi } from "@/lib/expenses";
import { downloadTextFile } from "@/lib/download";
import { dualAmounts } from "@/lib/convert";
import {
  formatDate,
  formatDateRange,
  formatMoney,
  formatMonth,
  formatPercent,
} from "@/lib/format";
import { todayIso } from "@/lib/ranges";
import { Button, ErrorNote, Input, SegmentedControl, Skeleton } from "@/components/ui";
import { AppPageHeader, PairSwitcher } from "@/components/app-page-header";
import { DualAmount } from "@/components/amount";
import { CategorySwatch } from "@/components/category-swatch";
import { TransactionRow } from "@/components/transaction-row";
import {
  ChartFrame,
  TrendLineChart,
  chartTable,
  compactAxis,
  type ChartTable,
  type TrendRow,
  type TrendSeries,
} from "@/components/charts";
import type { Expense, RateSnapshot } from "@/lib/types";
import { useCategoryTrends, usePair, useRateHistory, useRateSnapshot } from "../use-expenses";
import {
  useReportByDayOfWeek,
  useReportExpenses,
  useReportSummary,
  useReportTrends,
} from "../use-reports";
import { ConversionAlert, ConversionPill } from "../conversion-notice";

const TREND_MONTHS = 12;

const PRESETS = [
  { value: "month", label: "This month" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "12m", label: "12M" },
  { value: "custom", label: "Custom" },
] as const;

type Preset = (typeof PRESETS)[number]["value"];

/** First day of the month `monthsBack` months ago, as YYYY-MM-DD (UTC). */
function startOfMonthsAgo(monthsBack: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1))
    .toISOString()
    .slice(0, 10);
}

/** Inclusive day bounds for a YYYY-MM month. */
function monthBounds(month: string): { from: string; to: string } {
  const [year, monthIndex] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/** Compact axis label for a bucket key (day or month). */
function shortBucket(bucket: string): string {
  if (bucket.length === 7) return formatMonth(bucket);
  return new Date(`${bucket}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatRate(rate: number | null, second: string): string {
  if (rate === null) return "—";
  return `${rate.toFixed(rate >= 100 ? 2 : 4)} ${second}`;
}

/**
 * The Pair as chart series: the Base gets the mint line and gradient fill, the
 * Second a thinner line on the opposite axis — or on the left axis when it is
 * the only series shown.
 */
function pairSeries({
  base,
  second,
  showBase,
  showSecond,
  dots = true,
}: {
  base: string | null;
  second: string | null;
  showBase: boolean;
  showSecond: boolean;
  dots?: boolean;
}): TrendSeries[] {
  const series: TrendSeries[] = [];
  const both = showBase && showSecond;
  if (showBase && base) {
    series.push({ key: "base", label: base, color: "var(--primary)", area: true, dots });
  }
  if (showSecond && second) {
    series.push({
      key: "second",
      label: second,
      color: "var(--chart-secondary)",
      axis: both ? "right" : "left",
      quiet: true,
      dots,
    });
  }
  return series;
}

export default function ReportsPage() {
  const { base, second, swap } = usePair();
  const snapshot = useRateSnapshot();

  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [currencyView, setCurrencyView] = useState<"both" | "base" | "second">("both");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const range = useMemo(() => {
    if (preset === "custom") {
      return {
        from: customFrom || startOfMonthsAgo(0),
        to: customTo || todayIso(),
      };
    }
    const monthsBack = preset === "month" ? 0 : preset === "3m" ? 2 : preset === "6m" ? 5 : 11;
    return { from: startOfMonthsAgo(monthsBack), to: todayIso() };
  }, [preset, customFrom, customTo]);

  const yearRange = useMemo(
    () => ({ from: startOfMonthsAgo(TREND_MONTHS - 1), to: todayIso() }),
    [],
  );

  const summary = useReportSummary({ ...range, base, secondary: second });
  const yearSummary = useReportSummary({ ...yearRange, base, secondary: second });
  const trend = useReportTrends({ months: TREND_MONTHS, base, secondary: second });
  const dow = useReportByDayOfWeek({ ...range, base, secondary: second });
  const categoryTrends = useCategoryTrends({
    months: TREND_MONTHS,
    top: 5,
    base,
    secondary: second,
  });
  const rateHistory = useRateHistory({
    base,
    quote: second,
    from: yearRange.from,
    to: yearRange.to,
  });

  const drillBounds = selectedMonth ? monthBounds(selectedMonth) : null;
  const drill = useReportExpenses({
    from: drillBounds?.from,
    to: drillBounds?.to,
    limit: 25,
  });

  const effectiveBase =
    base ??
    summary.data?.baseCurrency ??
    yearSummary.data?.baseCurrency ??
    snapshot?.baseCurrency ??
    null;
  const effectiveSecond = second ?? summary.data?.secondaryCurrency ?? null;

  const showBase = currencyView !== "second" || !effectiveSecond;
  const showSecond = currencyView !== "base" && Boolean(effectiveSecond);

  const currencyOptions = useMemo(() => {
    const options = [{ value: "both", label: "Both" }];
    if (effectiveBase) options.push({ value: "base", label: effectiveBase });
    if (effectiveSecond) options.push({ value: "second", label: effectiveSecond });
    return options;
  }, [effectiveBase, effectiveSecond]);

  const formatValue = (value: number, key: string) =>
    formatMoney(value, key === "second" ? (effectiveSecond ?? "USD") : (effectiveBase ?? "USD"));

  /* ------------------------------ KPIs ------------------------------ */

  const kpiTotal = summary.data?.total ?? null;
  const kpiSecond = summary.data?.secondaryTotal ?? null;
  const topCategory = summary.data?.byCategory[0];

  /* -------------------------- 12-month trend ------------------------ */

  const trendRows: TrendRow[] = (trend.data?.points ?? []).map((point) => ({
    month: point.month,
    base: point.total,
    second: point.secondaryTotal ?? null,
  }));
  const trendSeries = pairSeries({
    base: effectiveBase,
    second: effectiveSecond,
    showBase: showBase && Boolean(effectiveBase),
    showSecond,
  });
  const trendTable: ChartTable | undefined =
    trendRows.length > 0
      ? chartTable({
          caption: `Monthly spending, last ${TREND_MONTHS} months, in both currencies`,
          firstColumn: "Month",
          xKey: "month",
          series: trendSeries.map((entry) => ({ key: entry.key, label: entry.label })),
          rows: trendRows,
          xFormat: formatMonth,
          valueFormat: (value, key) => (value == null ? "—" : formatValue(value, key)),
        })
      : undefined;

  /* ------------------------ Day of week ----------------------------- */

  const dowItems = dow.data?.items ?? [];
  const dowRows: TrendRow[] = dowItems.map((item) => ({
    label: item.label,
    base: item.total,
    second: item.secondaryTotal ?? null,
  }));
  const dowPeak =
    dowItems.length > 0
      ? dowItems.reduce((max, item) => (item.total > max.total ? item : max))
      : null;
  const dowHighlight =
    dowPeak && showBase
      ? { x: dowPeak.label, y: dowPeak.total, axis: "left" as const }
      : dowPeak && showSecond && dowPeak.secondaryTotal != null
        ? { x: dowPeak.label, y: dowPeak.secondaryTotal, axis: "left" as const }
        : null;
  const dowTable: ChartTable | undefined =
    dowRows.length > 0
      ? chartTable({
          caption: "Spending by day of week, in both currencies",
          firstColumn: "Day",
          xKey: "label",
          series: pairSeries({
            base: effectiveBase,
            second: effectiveSecond,
            showBase,
            showSecond,
          }).map((entry) => ({ key: entry.key, label: entry.label })),
          rows: dowRows,
          valueFormat: (value, key) => (value == null ? "—" : formatValue(value, key)),
        })
      : undefined;

  /* -------------------------- By category --------------------------- */

  const categorySeries = useMemo(
    () => categoryTrends.data?.series ?? [],
    [categoryTrends.data],
  );
  const categoryRows: TrendRow[] = useMemo(() => {
    const months = categorySeries[0]?.points.map((point) => point.month) ?? [];
    return months.map((month) => {
      const row: TrendRow = { month };
      for (const entry of categorySeries) {
        row[entry.categoryId] =
          entry.points.find((point) => point.month === month)?.total ?? null;
      }
      return row;
    });
  }, [categorySeries]);
  const categoryChartSeries: TrendSeries[] = categorySeries.map((entry) => ({
    key: entry.categoryId,
    label: entry.categoryName,
    color: entry.color,
    dots: false,
    hidden: hiddenCategories.includes(entry.categoryId),
  }));
  const categoryTable: ChartTable | undefined =
    categoryRows.length > 0
      ? chartTable({
          caption: "Monthly spend by category, last 12 months",
          firstColumn: "Month",
          xKey: "month",
          series: categorySeries.map((entry) => ({ key: entry.categoryId, label: entry.categoryName })),
          rows: categoryRows,
          xFormat: formatMonth,
          valueFormat: (value) => (value == null ? "—" : formatMoney(value, effectiveBase ?? "USD")),
        })
      : undefined;

  const yearCategories = yearSummary.data?.byCategory ?? [];

  /* ----------------------------- Rate ------------------------------- */

  const rateRows: TrendRow[] = (rateHistory.data?.points ?? []).map((point) => ({
    date: point.date,
    rate: point.rate,
  }));
  const rateTable: ChartTable | undefined =
    effectiveBase && effectiveSecond && rateRows.length > 0
      ? chartTable({
          caption: `Exchange rate, 1 ${effectiveBase} in ${effectiveSecond}`,
          firstColumn: "Date",
          xKey: "date",
          series: [{ key: "rate", label: `${effectiveBase} → ${effectiveSecond}` }],
          rows: rateRows,
          xFormat: formatDate,
          valueFormat: (value) =>
            value == null || !effectiveSecond ? "—" : formatRate(value, effectiveSecond),
        })
      : undefined;

  /* --------------------------- Actions ------------------------------ */

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const csv = await expensesApi.exportCsv({
        from: range.from,
        to: range.to,
        base: base ?? undefined,
        secondary: second ?? undefined,
      });
      downloadTextFile(`expenses-${range.from}_${range.to}.csv`, csv);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export expenses.");
    } finally {
      setExporting(false);
    }
  }

  function toggleCategory(id: string) {
    setHiddenCategories((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Reports"
        dateRange={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              label="Date range"
              options={PRESETS.map((entry) => ({ value: entry.value, label: entry.label }))}
              value={preset}
              onChange={(value) => setPreset(value as Preset)}
            />
            {preset === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  aria-label="From date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="h-9 w-36"
                />
                <span aria-hidden="true" className="text-muted">
                  –
                </span>
                <Input
                  type="date"
                  aria-label="To date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="h-9 w-36"
                />
              </div>
            )}
          </div>
        }
        info={
          summary.data ? <ConversionPill provenance={summary.data.rateProvenance} /> : undefined
        }
        pair={<PairSwitcher base={base} second={second} onSwap={swap} />}
        actions={
          <Button variant="secondary" size="sm" onClick={exportCsv} loading={exporting}>
            Export CSV
          </Button>
        }
      />

      {exportError && <ErrorNote message={exportError} />}
      {summary.error && <ErrorNote message={summary.error} />}
      {summary.data && (
        <ConversionAlert
          status={summary.data.conversionStatus}
          unconvertedCurrencies={summary.data.unconvertedCurrencies}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total spent">
          {summary.loading && !summary.data ? (
            <Skeleton className="h-8 w-28" />
          ) : kpiTotal === null || !effectiveBase ? (
            <span className="text-2xl font-semibold text-muted">—</span>
          ) : (
            <DualAmount
              amount={kpiTotal}
              currency={effectiveBase}
              secondaryAmount={kpiSecond}
              secondaryCurrency={kpiSecond !== null ? effectiveSecond : null}
              size="lg"
              layout="stack"
            />
          )}
        </KpiCard>

        <KpiCard label="Expenses">
          {summary.loading && !summary.data ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <span className="text-2xl font-semibold tabular-nums text-ink">
              {summary.data?.count ?? "—"}
            </span>
          )}
        </KpiCard>

        <KpiCard label="Average">
          {summary.loading && !summary.data ? (
            <Skeleton className="h-8 w-24" />
          ) : summary.data?.average == null || !effectiveBase ? (
            <span className="text-2xl font-semibold text-muted">—</span>
          ) : (
            <DualAmount
              amount={summary.data.average}
              currency={effectiveBase}
              secondaryAmount={summary.data.secondaryAverage ?? null}
              secondaryCurrency={summary.data.secondaryAverage != null ? effectiveSecond : null}
              size="lg"
              layout="stack"
            />
          )}
        </KpiCard>

        <KpiCard label="Top category">
          {summary.loading && !summary.data ? (
            <Skeleton className="h-8 w-32" />
          ) : topCategory ? (
            <div className="flex flex-col gap-1">
              <span className="inline-flex min-w-0 items-center gap-2">
                <CategorySwatch color={topCategory.color} size={9} />
                <span className="truncate text-base font-medium text-ink">
                  {topCategory.categoryName}
                </span>
              </span>
              {effectiveBase && (
                <DualAmount
                  amount={topCategory.total}
                  currency={effectiveBase}
                  secondaryAmount={topCategory.secondaryTotal ?? null}
                  secondaryCurrency={topCategory.secondaryTotal != null ? effectiveSecond : null}
                  size="sm"
                  layout="stack"
                />
              )}
            </div>
          ) : (
            <span className="text-2xl font-semibold text-muted">—</span>
          )}
        </KpiCard>
      </div>

      {/* 12-month trend */}
      <ChartFrame
        title="Monthly spending"
        subtitle={`Last ${TREND_MONTHS} months · click a point to list that month`}
        table={trendTable}
        loading={trend.loading}
        action={
          effectiveSecond ? (
            <SegmentedControl
              label="Series to show"
              options={currencyOptions}
              value={currencyView}
              onChange={(value) => setCurrencyView(value as "both" | "base" | "second")}
            />
          ) : undefined
        }
        empty={
          !trend.loading && !trend.data?.converted ? (
            <EmptyChart message="Converted totals appear once exchange rates are available." />
          ) : undefined
        }
      >
        <TrendLineChart
          data={trendRows}
          xKey="month"
          series={trendSeries}
          height={280}
          leftTickFormatter={compactAxis}
          rightTickFormatter={compactAxis}
          xTickFormatter={formatMonth}
          formatValue={formatValue}
          leftDomain={[0, "auto"]}
          rightDomain={[0, "auto"]}
          onPointClick={(row) => {
            const month = row.month;
            if (typeof month === "string") setSelectedMonth(month);
          }}
        />
      </ChartFrame>

      {selectedMonth && (
        <ChartFrame
          title={`${formatMonth(selectedMonth)} expenses`}
          subtitle="Click another month above to change this list"
          loading={drill.loading}
          action={
            <Button variant="ghost" size="sm" onClick={() => setSelectedMonth(null)}>
              Close
            </Button>
          }
        >
          {drill.error ? (
            <p className="py-6 text-sm text-danger">{drill.error}</p>
          ) : drill.data && drill.data.items.length > 0 ? (
            <ul className="divide-y divide-border">
              {drill.data.items.map((expense) => (
                <DrillRow key={expense.id} expense={expense} base={effectiveBase} second={second} snapshot={snapshot} />
              ))}
            </ul>
          ) : (
            <p className="py-6 text-sm text-muted">No expenses recorded in this month.</p>
          )}
        </ChartFrame>
      )}

      {/* Day of week */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartFrame
          title="Spending by day of week"
          subtitle={formatDateRange(range.from, range.to)}
          table={dowTable}
          loading={dow.loading}
          empty={
            !dow.loading && dow.data && !dow.data.converted ? (
              <EmptyChart message="This chart needs a rate to combine currencies." />
            ) : undefined
          }
        >
          <TrendLineChart
            data={dowRows}
            xKey="label"
            series={pairSeries({
              base: effectiveBase,
              second: effectiveSecond,
              showBase,
              showSecond,
            })}
            height={240}
            leftTickFormatter={compactAxis}
            rightTickFormatter={compactAxis}
            formatValue={formatValue}
            leftDomain={[0, "auto"]}
            rightDomain={[0, "auto"]}
            highlight={dowHighlight}
          />
        </ChartFrame>

        <ChartFrame
          title="By category"
          subtitle={`Top ${categorySeries.length || 5} over the last ${TREND_MONTHS} months`}
          table={categoryTable}
          loading={categoryTrends.loading}
          empty={
            !categoryTrends.loading && categorySeries.length === 0 ? (
              <EmptyChart message="No categorised spending in this window yet." />
            ) : undefined
          }
        >
          <div className="mb-3 flex flex-wrap gap-2">
            {categorySeries.map((entry) => {
              const on = !hiddenCategories.includes(entry.categoryId);
              return (
                <button
                  key={entry.categoryId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCategory(entry.categoryId)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    on
                      ? "border-border-strong text-ink"
                      : "border-border text-muted opacity-60"
                  }`}
                >
                  <CategorySwatch color={entry.color} size={8} />
                  {entry.categoryName}
                </button>
              );
            })}
          </div>
          <TrendLineChart
            data={categoryRows}
            xKey="month"
            series={categoryChartSeries}
            height={220}
            leftTickFormatter={compactAxis}
            xTickFormatter={formatMonth}
            leftDomain={[0, "auto"]}
            formatValue={(value) => formatMoney(value, effectiveBase ?? "USD")}
          />
        </ChartFrame>
      </div>

      {/* Ranked categories (replaces the donut) */}
      <ChartFrame
        title="Category ranking"
        subtitle={formatDateRange(range.from, range.to)}
        loading={yearSummary.loading && !yearSummary.data}
      >
        {yearCategories.length === 0 ? (
          <EmptyChart message="No categorised spending in this period." compact />
        ) : (
          <ul className="space-y-4">
            {yearCategories.map((entry) => {
              const max = yearCategories[0]?.total ?? 0;
              const width = max > 0 ? (entry.total / max) * 100 : 0;
              return (
                <li key={entry.categoryId}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <CategorySwatch color={entry.color} size={9} />
                      <span className="truncate text-sm font-medium text-ink">
                        {entry.categoryName}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {entry.count} {entry.count === 1 ? "expense" : "expenses"}
                      </span>
                    </span>
                    {effectiveBase && (
                      <DualAmount
                        amount={entry.total}
                        currency={effectiveBase}
                        secondaryAmount={entry.secondaryTotal ?? null}
                        secondaryCurrency={entry.secondaryTotal != null ? effectiveSecond : null}
                        size="sm"
                        layout="stack"
                        align="right"
                        className="shrink-0"
                      />
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${width}%`, backgroundColor: entry.color }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">
                      {formatPercent(entry.percentage)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ChartFrame>

      {/* Rate */}
      <ChartFrame
        title="Base vs Second"
        subtitle={
          effectiveBase && effectiveSecond
            ? `1 ${effectiveBase} in ${effectiveSecond}, last ${TREND_MONTHS} months`
            : "The rate between your two currencies"
        }
        table={rateTable}
        loading={Boolean(second) && rateHistory.loading}
      >
        {!effectiveSecond || !effectiveBase ? (
          <EmptyChart
            message="Set a second currency to see the rate between your pair over time."
            compact
          />
        ) : rateHistory.error ? (
          <p className="py-10 text-center text-sm text-muted">{rateHistory.error}</p>
        ) : rateRows.length < 2 ? (
          <p className="py-10 text-center text-sm text-muted">
            Not enough published rates in this window to draw a line.
          </p>
        ) : (
          <TrendLineChart
            data={rateRows}
            xKey="date"
            series={[
              {
                key: "rate",
                label: `${effectiveBase} in ${effectiveSecond}`,
                color: "var(--primary)",
                area: true,
                dots: false,
              },
            ]}
            height={240}
            leftDomain={["auto", "auto"]}
            leftTickFormatter={(value) =>
              value.toLocaleString(undefined, { maximumFractionDigits: value >= 100 ? 1 : 3 })
            }
            xTickFormatter={shortBucket}
            formatValue={(value) => formatRate(value, effectiveSecond)}
          />
        )}
      </ChartFrame>
    </div>
  );
}

function KpiCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EmptyChart({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl border border-dashed border-border-strong px-6 text-center ${
        compact ? "py-8" : "py-14"
      }`}
    >
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

function DrillRow({
  expense,
  base,
  second,
  snapshot,
}: {
  expense: Expense;
  base: string | null;
  second: string | null;
  snapshot: RateSnapshot | null;
}) {
  const pair = dualAmounts(expense.amount, expense.currency, base, second, snapshot);
  const primaryCurrency = pair.base !== null ? (base ?? expense.currency) : expense.currency;
  const primaryAmount = pair.base ?? expense.amount;
  return (
    <li>
      <TransactionRow
        href={`/expenses/${expense.id}`}
        color={expense.categoryColor}
        title={expense.description || expense.categoryName}
        meta={`${formatDate(expense.incurredOn)} · ${expense.categoryName}`}
        amount={primaryAmount}
        currency={primaryCurrency}
        secondAmount={pair.second}
        secondCurrency={pair.second !== null ? second : null}
        recorded={
          expense.currency !== primaryCurrency
            ? { amount: expense.amount, currency: expense.currency }
            : null
        }
      />
    </li>
  );
}
