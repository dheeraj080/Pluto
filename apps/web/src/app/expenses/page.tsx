"use client";

/**
 * Expense dashboard.
 *
 * Six cards, in the app's graphite/emerald system:
 *  1. the month hero — the Base figure large with the Second beside it, a
 *     change pill, a thin gradient line and the Count / Average / Top category
 *     stats;
 *  2. the recent transactions;
 *  3. Balance — the overall budget minus what has been spent, with a thin
 *     progress line (or a "set a budget" prompt);
 *  4. Analytics — this month / this week / today, each in both currencies with
 *     a sparkline and a quiet rate footer;
 *  5. the top categories, ranked;
 *  6. the Base ⇄ Second rate over time, replacing the old "By currency" list.
 *
 * Every converted figure comes from the server aggregates; per-row previews are
 * display-only, computed from the public snapshot. A window that cannot be
 * converted is shown as "—", never as zero.
 */

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { isoDaysAgo, todayIso, windowFor } from "@/lib/ranges";
import { formatDate, formatDateRange, formatMoney, formatMonth, formatPercent } from "@/lib/format";
import { Button, ErrorNote, Skeleton } from "@/components/ui";
import { AppPageHeader, PairSwitcher } from "@/components/app-page-header";
import { DualAmount } from "@/components/amount";
import { ChangePill } from "@/components/pill";
import { CategorySwatch } from "@/components/category-swatch";
import {
  ChartFrame,
  TrendLineChart,
  chartTable,
  compactAxis,
  type ChartTable,
  type TrendRow,
  type TrendSeries,
} from "@/components/charts";
import { IconPlus, IconTarget } from "@/components/icons";
import type { SeriesPoint } from "@/lib/types";
import {
  usePair,
  useRateHistory,
  useRateSnapshot,
  useReportingSetup,
  useSeries,
} from "./use-expenses";
import {
  comparisonDeltaPct,
  useDashboardBudget,
  useDashboardWindows,
  useRecentExpenses,
} from "./use-dashboard";
import { ConversionAlert, ConversionPill } from "./conversion-notice";
import { DashboardAnalytics, type AnalyticsSparks } from "./dashboard-analytics";
import { RecentTransactions } from "./dashboard-recent";

/** Compact axis label for a bucket key (day/month), e.g. "12 Oct" or "Oct". */
function shortBucket(bucket: string): string {
  if (bucket.length === 7) return formatMonth(bucket);
  const date = new Date(`${bucket}T00:00:00Z`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** YYYY-MM-DD turned into a readable rate value. */
function formatRate(rate: number | null, second: string): string {
  if (rate === null) return "—";
  const digits = rate >= 100 ? 2 : 4;
  return `${rate.toFixed(digits)} ${second}`;
}

function seriesRows(points: SeriesPoint[]): TrendRow[] {
  return points.map((point) => ({
    bucket: point.bucket,
    base: point.total,
    second: point.secondaryTotal ?? null,
  }));
}

function sparkRows(points: SeriesPoint[]): TrendRow[] {
  return points.map((point) => ({ value: point.total }));
}

export default function ExpensesDashboardPage() {
  const { base, second, swap } = usePair();
  const { needsSetup, dismiss } = useReportingSetup();
  const snapshot = useRateSnapshot();
  const { windows, loading: windowsLoading, error: windowsError, reload } = useDashboardWindows(
    base,
    second,
  );
  const { data: recent, loading: recentLoading, error: recentError } = useRecentExpenses(8);

  const ranges = useMemo(() => {
    const now = new Date();
    const monthsAgo = (count: number) =>
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count, 1))
        .toISOString()
        .slice(0, 10);
    return {
      month: windowFor("month"),
      daySpark: { from: isoDaysAgo(13), to: todayIso() },
      weekSpark: { from: isoDaysAgo(55), to: todayIso() },
      monthSpark: { from: monthsAgo(5), to: todayIso() },
      rate: { from: monthsAgo(6), to: todayIso() },
    };
  }, []);

  const monthKey = ranges.month.from.slice(0, 7);
  const { budget, loading: budgetLoading } = useDashboardBudget(base, second, monthKey);

  const heroSeries = useSeries({
    from: ranges.month.from,
    to: ranges.month.to,
    granularity: "day",
    base,
    secondary: second,
  });
  const daySpark = useSeries({
    ...ranges.daySpark,
    granularity: "day",
    base,
    secondary: second,
  });
  const weekSpark = useSeries({
    ...ranges.weekSpark,
    granularity: "week",
    base,
    secondary: second,
  });
  const monthSpark = useSeries({
    ...ranges.monthSpark,
    granularity: "month",
    base,
    secondary: second,
  });
  const rateHistory = useRateHistory({
    base,
    quote: second,
    from: ranges.rate.from,
    to: ranges.rate.to,
  });

  const month = windows?.month ?? null;
  const monthSummary = month?.comparison.current ?? null;
  const effectiveBase = base ?? monthSummary?.baseCurrency ?? snapshot?.baseCurrency ?? null;
  const effectiveSecond = second ?? monthSummary?.secondaryCurrency ?? null;

  const monthTotal = monthSummary?.total ?? null;
  const monthSecond = monthSummary?.secondaryTotal ?? null;
  const monthDelta = month ? comparisonDeltaPct(month.comparison) : null;
  const topCategory = monthSummary?.byCategory[0];
  const byCategory = monthSummary?.byCategory ?? [];
  const maxCategory = byCategory.reduce((max, entry) => Math.max(max, entry.total), 0);

  const sparks: AnalyticsSparks = {
    day: sparkRows(daySpark.data?.points ?? []),
    week: sparkRows(weekSpark.data?.points ?? []),
    month: sparkRows(monthSpark.data?.points ?? []),
  };

  const heroRows = seriesRows(heroSeries.data?.points ?? []);

  const heroSeriesDefs: TrendSeries[] = [{ key: "base", label: effectiveBase ?? "Base", color: "var(--primary)", area: true, dots: false }];
  if (effectiveSecond && effectiveBase) {
    heroSeriesDefs.push({
      key: "second",
      label: effectiveSecond,
      color: "var(--chart-secondary)",
      axis: "right",
      quiet: true,
      dots: false,
    });
  }

  const heroTable: ChartTable | undefined =
    effectiveBase && effectiveSecond && heroRows.length > 0
      ? chartTable({
          caption: "Spending by day this month, in both currencies",
          firstColumn: "Day",
          xKey: "bucket",
          series: [
            { key: "base", label: effectiveBase },
            { key: "second", label: effectiveSecond },
          ],
          rows: heroRows,
          xFormat: shortBucket,
          valueFormat: (value, key) =>
            value == null ? "—" : formatMoney(value, key === "second" ? effectiveSecond : effectiveBase),
        })
      : undefined;

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
          xFormat: (value) => formatDate(value),
          valueFormat: (value) =>
            value == null || !effectiveSecond ? "—" : formatRate(value, effectiveSecond),
        })
      : undefined;

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Dashboard"
        dateRange={
          month ? (
            <span className="text-sm text-muted">
              {formatDateRange(month.range.from, month.range.to)}
            </span>
          ) : undefined
        }
        info={month ? <ConversionPill provenance={month.comparison.rateProvenance} /> : undefined}
        pair={<PairSwitcher base={base} second={second} onSwap={swap} />}
        actions={
          <>
            <Link
              href="/expenses/new"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <IconPlus className="h-4 w-4" />
              Add expense
            </Link>
            <Button variant="secondary" size="sm" onClick={reload} loading={windowsLoading}>
              Refresh
            </Button>
          </>
        }
      />

      {windowsError && <ErrorNote message={windowsError} />}
      {month && (
        <ConversionAlert
          status={month.comparison.conversionStatus}
          unconvertedCurrencies={month.comparison.unconvertedCurrencies}
        />
      )}

      {needsSetup && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary-subtle/50 px-4 py-3">
          <p className="text-sm text-ink">
            Choose your reporting currencies — every figure is shown as a Base with a Second beside
            it.
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/expenses/settings"
              className="inline-flex h-9 items-center rounded-xl bg-primary px-3.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
            >
              Open settings
            </Link>
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <ChartFrame
          glow
          title="Spent this month"
          className="lg:col-span-12"
          srTable={heroTable}
          loading={windowsLoading && !monthSummary}
          skeleton={<Skeleton className="h-40" />}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {monthSummary && effectiveBase ? (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                  {monthTotal === null ? (
                    <span className="text-4xl font-light tracking-tight text-muted">—</span>
                  ) : (
                    <DualAmount
                      amount={monthTotal}
                      currency={effectiveBase}
                      secondaryAmount={monthSecond}
                      secondaryCurrency={monthSecond !== null ? effectiveSecond : null}
                      size="hero"
                      layout="inline"
                    />
                  )}
                  {monthDelta !== null && (
                    <ChangePill percent={monthDelta} caption="vs last month" />
                  )}
                </div>
              ) : (
                <Skeleton className="h-12 w-56" />
              )}
              <p className="mt-2 text-sm text-muted">
                {month
                  ? `${formatDateRange(month.range.from, month.range.to)} · ${monthSummary?.count ?? 0} ${
                      monthSummary?.count === 1 ? "expense" : "expenses"
                    }`
                  : "Loading this month…"}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-3 sm:gap-6">
            <MiniStat label="Expenses">{monthSummary?.count ?? "—"}</MiniStat>
            <MiniStat label="Average">
              {monthSummary?.average == null || !effectiveBase ? (
                "—"
              ) : (
                <DualAmount
                  amount={monthSummary.average}
                  currency={effectiveBase}
                  secondaryAmount={monthSummary.secondaryAverage ?? null}
                  secondaryCurrency={
                    monthSummary.secondaryAverage != null ? effectiveSecond : null
                  }
                  size="sm"
                  layout="stack"
                />
              )}
            </MiniStat>
            <MiniStat label="Top category">
              {topCategory ? (
                <span className="inline-flex min-w-0 items-center gap-2">
                  <CategorySwatch color={topCategory.color} size={9} />
                  <span className="truncate text-base font-medium text-ink">
                    {topCategory.categoryName}
                  </span>
                </span>
              ) : (
                "—"
              )}
            </MiniStat>
          </div>

          <div className="mt-5">
            {heroSeries.loading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : monthSummary && monthSummary.count === 0 ? (
              <NoSpending />
            ) : !heroSeries.data?.converted ? (
              <p className="py-16 text-center text-sm text-muted">
                The trend appears once exchange rates are available.
              </p>
            ) : heroSeries.data.points.length < 2 ? (
              <p className="py-16 text-center text-sm text-muted">
                The trend appears as the month progresses.
              </p>
            ) : (
              <TrendLineChart
                data={heroRows}
                xKey="bucket"
                series={heroSeriesDefs}
                height={200}
                leftTickFormatter={compactAxis}
                rightTickFormatter={compactAxis}
                xTickFormatter={shortBucket}
                formatValue={(value, key) =>
                  formatMoney(value, key === "second" ? (effectiveSecond ?? "USD") : (effectiveBase ?? "USD"))
                }
                leftDomain={[0, "auto"]}
                rightDomain={[0, "auto"]}
              />
            )}
          </div>
        </ChartFrame>

        <RecentTransactions
          data={recent}
          loading={recentLoading}
          error={recentError}
          base={base ?? monthSummary?.baseCurrency ?? null}
          second={second}
          snapshot={snapshot}
        />

        <ChartFrame
          title="Balance"
          subtitle="Overall budget minus what you have spent this month"
          className="lg:col-span-5"
          loading={budgetLoading && !budget}
          skeleton={<Skeleton className="h-28" />}
          action={
            <Link
              href="/expenses/budgets"
              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Budgets →
            </Link>
          }
        >
          {!budget ? (
            <div className="flex flex-col items-start gap-3 py-6">
              <p className="text-sm text-muted">
                No overall budget yet, so there is no balance to show. Set one to track what is left
                this month.
              </p>
              <Link
                href="/expenses/budgets"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
              >
                <IconTarget className="h-4 w-4" />
                Set a budget
              </Link>
            </div>
          ) : !budget.applied ? (
            <p className="py-6 text-sm text-muted">
              This budget has not started yet, so there is nothing to compare for this month.
            </p>
          ) : budget.convertedAmount === null ? (
            <p className="py-6 text-sm text-muted">
              The budget target could not be converted, so a balance cannot be shown.
            </p>
          ) : (
            <>
              {effectiveBase && (
                <DualAmount
                  amount={budget.remaining}
                  currency={effectiveBase}
                  secondaryAmount={budget.secondaryRemaining ?? null}
                  secondaryCurrency={budget.secondaryRemaining != null ? effectiveSecond : null}
                  size="lg"
                  layout="inline"
                  className={budget.overBudget ? "[&_span]:text-warning" : ""}
                />
              )}
              <p className="mt-2 text-sm text-muted">
                {formatMoney(budget.spent, effectiveBase ?? budget.currency)} spent of{" "}
                {formatMoney(budget.budgetAmount, effectiveBase ?? budget.currency)}
              </p>
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, budget.percentage))}%`,
                      backgroundColor: budget.overBudget ? "var(--warning)" : "var(--primary)",
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {formatPercent(budget.percentage)} of budget used
                </p>
              </div>
            </>
          )}
        </ChartFrame>

        <DashboardAnalytics
          windows={windows}
          base={base}
          second={second}
          sparks={sparks}
          snapshot={snapshot}
          loading={windowsLoading}
        />

        <ChartFrame
          title="Top categories"
          subtitle="Ranked by spend this month"
          className="lg:col-span-5"
          loading={windowsLoading && !monthSummary}
          skeleton={<Skeleton className="h-40" />}
        >
          {!monthSummary || monthSummary.count === 0 ? (
            <NoSpending compact />
          ) : byCategory.length === 0 ? (
            <p className="py-6 text-sm text-muted">
              Category breakdowns need a rate to combine currencies.
            </p>
          ) : (
            <ul className="space-y-4">
              {byCategory.map((entry) => {
                const width = maxCategory > 0 ? (entry.total / maxCategory) * 100 : 0;
                return (
                  <li key={entry.categoryId}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <CategorySwatch color={entry.color} size={9} />
                        <span className="truncate text-sm font-medium text-ink">
                          {entry.categoryName}
                        </span>
                      </span>
                      {effectiveBase && (
                        <DualAmount
                          amount={entry.total}
                          currency={effectiveBase}
                          secondaryAmount={entry.secondaryTotal ?? null}
                          secondaryCurrency={
                            entry.secondaryTotal != null ? effectiveSecond : null
                          }
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

        <ChartFrame
          title="Base vs Second"
          subtitle={
            effectiveBase && effectiveSecond
              ? `1 ${effectiveBase} in ${effectiveSecond}, last 6 months`
              : "The rate between your two currencies"
          }
          className="lg:col-span-12"
          table={rateTable}
          loading={Boolean(second) && rateHistory.loading}
          skeleton={<Skeleton className="h-[220px] w-full" />}
        >
          {!effectiveSecond || !effectiveBase ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted">
                Set a second currency to see the rate between your pair over time.
              </p>
              <Link
                href="/expenses/settings"
                className="inline-flex h-9 items-center rounded-xl border border-border px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
              >
                Choose currencies
              </Link>
            </div>
          ) : rateHistory.error ? (
            <p className="py-12 text-center text-sm text-muted">{rateHistory.error}</p>
          ) : rateRows.length < 2 ? (
            <p className="py-12 text-center text-sm text-muted">
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
              height={220}
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
    </div>
  );
}

/** A calm stand-in for a card with nothing to plot, never an empty grid. */
function NoSpending({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-strong text-center ${
        compact ? "px-4 py-8" : "px-6 py-12"
      }`}
    >
      <p className="text-sm text-muted">No spending here yet.</p>
      <Link
        href="/expenses/new"
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
      >
        <IconPlus className="h-4 w-4" />
        Add your first expense
      </Link>
    </div>
  );
}

function MiniStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-ink">{children}</p>
    </div>
  );
}
