"use client";

/**
 * Expense dashboard.
 *
 * Built to answer six questions in about five seconds, in three compact rows:
 *
 *  1. how much have I spent this month?          — the spending card
 *  2. am I on budget, and how much per day?      — the budget card
 *  3. faster or slower than last month?          — the comparison card
 *  4. what did I buy recently?                   — the recent card
 *  5. where is the money going?                  — the top-categories card
 *  6. what is today's rate, and what is X worth? — the rate & converter card
 *
 * Every converted figure comes from the server aggregates; the per-row
 * previews are display-only, and a window that cannot be converted reads "—"
 * rather than zero.
 */

import { useState } from "react";
import Link from "next/link";
import { isoDaysAgo, todayIso, type CompareRange } from "@/lib/ranges";
import { formatDateRange } from "@/lib/format";
import { Button, EmptyState } from "@/components/ui";
import { AppPageHeader, PairSwitcher } from "@/components/app-page-header";
import { IconCalendar, IconPlus, IconReceipt, IconRefresh } from "@/components/icons";
import { usePair, useRateHistory, useRateSnapshot } from "./use-expenses";
import {
  comparisonDeltaPct,
  useComparisonSeries,
  useDashboardBudget,
  useMonthComparison,
  useRecentExpenses,
} from "./use-dashboard";
import { ConversionAlert, RateAsOfPill } from "./conversion-notice";
import { SpendingCard } from "./dashboard-spending";
import { BudgetCard } from "./dashboard-budget";
import { ComparisonCard } from "./dashboard-compare";
import { RecentTransactions } from "./dashboard-recent";
import { TopCategories } from "./dashboard-categories";
import { RateConverterCard } from "./dashboard-rate";

export default function ExpensesDashboardPage() {
  const { base, second, swap } = usePair();
  const snapshot = useRateSnapshot();

  const month = useMonthComparison(base, second);
  const {
    window,
    comparison,
    loading: monthLoading,
    error: monthError,
    reload: reloadMonth,
  } = month;
  const monthKey = window.from.slice(0, 7);

  const budget = useDashboardBudget(base, second, monthKey);
  const recent = useRecentExpenses(6);

  const [compareRange, setCompareRange] = useState<CompareRange>("month");
  const [seriesNonce, setSeriesNonce] = useState(0);
  const comparisonSeries = useComparisonSeries(compareRange, base, second, seriesNonce);

  const rateHistory = useRateHistory({
    base,
    quote: second,
    from: isoDaysAgo(29),
    to: todayIso(),
  });

  const summary = comparison?.current ?? null;
  const effectiveBase = base ?? summary?.baseCurrency ?? snapshot?.baseCurrency ?? null;
  const effectiveSecond = second ?? summary?.secondaryCurrency ?? null;
  const delta = comparisonDeltaPct(comparison);
  const estimated = comparison?.rateProvenance?.policies?.includes("estimate") ?? false;

  const refresh = () => {
    reloadMonth();
    budget.reload();
    recent.reload();
    setSeriesNonce((value) => value + 1);
  };
  const refreshing = monthLoading || budget.loading || recent.loading;

  // A brand-new account sees one friendly card, never a grid of empty charts.
  const isEmpty =
    !monthLoading &&
    summary !== null &&
    summary.count === 0 &&
    (recent.data?.items.length ?? 0) === 0;

  return (
    <div className="space-y-5">
      <AppPageHeader
        title="Dashboard"
        dateRange={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted">
            <IconCalendar aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="tabular-nums">{formatDateRange(window.from, window.to)}</span>
          </span>
        }
        info={
          <RateAsOfPill
            snapshot={snapshot}
            base={effectiveBase}
            second={effectiveSecond}
            provenance={comparison?.rateProvenance}
          />
        }
        pair={<PairSwitcher base={base} second={second} onSwap={swap} />}
        actions={
          <>
            <Link
              href="/expenses/new"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary shadow-[0_6px_20px_-10px_rgba(52,211,153,0.7)] transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <IconPlus className="h-4 w-4" />
              Add expense
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={refresh}
              loading={refreshing}
              aria-label="Refresh"
              title="Refresh"
            >
              <IconRefresh className="h-4 w-4" />
            </Button>
          </>
        }
      />

      {comparison && (
        <ConversionAlert
          status={comparison.conversionStatus}
          unconvertedCurrencies={comparison.unconvertedCurrencies}
        />
      )}

      {isEmpty ? (
        <section className="rounded-[20px] border border-border bg-surface p-6">
          <EmptyState
            icon={<IconReceipt className="h-5 w-5" />}
            title="Add your first expense"
            description="Once you record a purchase, this dashboard shows what you spent, how it compares with last month, and where the money went."
            action={
              <Link
                href="/expenses/new"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
              >
                <IconPlus className="h-4 w-4" />
                Add your first expense
              </Link>
            }
          />
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
          <div className="max-lg:contents lg:col-span-8 lg:flex lg:flex-col lg:gap-4">
            <SpendingCard
              summary={summary}
              second={effectiveSecond}
              snapshot={snapshot}
              delta={delta}
              loading={monthLoading}
              error={monthError}
              onRetry={reloadMonth}
            />

            <ComparisonCard
              rows={comparisonSeries.rows}
              range={compareRange}
              onRangeChange={setCompareRange}
              base={effectiveBase ?? ""}
              second={effectiveSecond}
              loading={comparisonSeries.loading}
              error={comparisonSeries.error}
              onRetry={() => setSeriesNonce((value) => value + 1)}
            />

            <RecentTransactions
              data={recent.data}
              loading={recent.loading}
              error={recent.error}
              base={effectiveBase}
              second={effectiveSecond}
              snapshot={snapshot}
              estimated={estimated}
              onRetry={recent.reload}
            />
          </div>

          <div className="max-lg:contents lg:col-span-4 lg:flex lg:flex-col lg:gap-4">
            <BudgetCard
              budget={budget.budget}
              window={window}
              second={effectiveSecond}
              loading={budget.loading}
              error={budget.error}
              onRetry={budget.reload}
            />

            <TopCategories
              entries={summary?.byCategory ?? []}
              base={effectiveBase ?? ""}
              second={effectiveSecond}
              snapshot={snapshot}
              loading={monthLoading}
            />

            <RateConverterCard
              snapshot={snapshot}
              base={effectiveBase}
              second={effectiveSecond}
              history={rateHistory.data}
              loading={rateHistory.loading}
            />
          </div>
        </div>
      )}
    </div>
  );
}
