"use client";

/**
 * Expense dashboard: a bento layout.
 *
 * The month headline sits across the top; below it the recent transactions
 * (left) pair with an analytics box (right) that breaks spending down by
 * month / week / day in both the reporting currency and the native currencies
 * it was recorded in, and names the rate behind today's conversions. A final
 * row mirrors the month's category and currency breakdowns.
 *
 * Every converted figure comes from the server aggregates; the per-row "≈"
 * amounts are display-only, computed from the public ECB snapshot. When a
 * window cannot be converted its total is withheld rather than shown as zero.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { formatDateRange, formatPercent } from "@/lib/format";
import { Badge, Button, ErrorNote, Money, PageHeader, Select, Skeleton } from "@/components/ui";
import { BentoGrid, BentoTile } from "@/components/bento";
import { IconGlobe, IconPlus } from "@/components/icons";
import {
  useBaseCurrency,
  useExpenseSetup,
  useRateSnapshot,
  useReportingSetup,
} from "./use-expenses";
import {
  comparisonDeltaPct,
  useDashboardWindows,
  useRecentExpenses,
} from "./use-dashboard";
import { ConversionNotice } from "./conversion-notice";
import { AnalyticsBox } from "./dashboard-analytics";
import { RecentTransactions } from "./dashboard-recent";

export default function ExpensesDashboardPage() {
  const { base, setBase } = useBaseCurrency();
  const { currencies, error: setupError } = useExpenseSetup();
  const { needsSetup, dismiss } = useReportingSetup();
  const snapshot = useRateSnapshot();
  const { windows, loading: windowsLoading, error: windowsError, reload } = useDashboardWindows(base);
  const { data: recent, loading: recentLoading, error: recentError } = useRecentExpenses(8);

  const month = windows?.month ?? null;
  const monthSummary = month?.comparison.current ?? null;
  const effectiveBase = base ?? monthSummary?.baseCurrency ?? null;
  const monthDelta = month ? comparisonDeltaPct(month.comparison) : null;
  const topCategory = monthSummary?.byCategory[0];
  const maxCategoryTotal =
    monthSummary?.byCategory.reduce((max, entry) => Math.max(max, entry.total), 0) ?? 0;
  const monthConvertedTotal =
    month?.comparison.converted && monthSummary?.total !== null && monthSummary?.total !== undefined
      ? monthSummary.total
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          monthSummary
            ? `${formatDateRange(month!.range.from, month!.range.to)} · totals in ${effectiveBase}`
            : "Track spending across currencies."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="base-currency" className="text-sm text-muted">
              Reporting
            </label>
            <Select
              id="base-currency"
              aria-label="Reporting currency"
              value={base ?? ""}
              onChange={(event) => setBase(event.target.value)}
              className="w-32"
            >
              <option value="">{monthSummary?.baseCurrency ?? "Default"}</option>
              {currencies
                .filter((entry) => entry.code !== monthSummary?.baseCurrency)
                .map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.code}
                  </option>
                ))}
            </Select>
          </div>
        }
      />

      {needsSetup && (
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary-subtle/60 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background text-primary">
              <IconGlobe className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Choose your reporting currency</p>
              <p className="text-sm text-muted">
                Pick the currency your totals and reports should be shown in.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/onboarding"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
            >
              Set up
            </Link>
            <Button variant="ghost" onClick={dismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {setupError && <ErrorNote message={setupError} />}
      {windowsError && <ErrorNote message={windowsError} />}

      {month && (
        <ConversionNotice
          status={month.comparison.conversionStatus}
          unconvertedCurrencies={month.comparison.unconvertedCurrencies}
          provenance={month.comparison.rateProvenance}
        />
      )}

      <BentoGrid>
        <BentoTile className="lg:col-span-12">
          {!monthSummary ? (
            <div className="space-y-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-56" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Spent this month
                  </p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                    <span className="text-4xl font-semibold tracking-tight text-ink">
                      {monthConvertedTotal === null ? (
                        "—"
                      ) : (
                        <Money amount={monthConvertedTotal} currency={effectiveBase ?? monthSummary.baseCurrency} />
                      )}
                    </span>
                    {effectiveBase && <span className="text-sm text-muted">in {effectiveBase}</span>}
                    {monthDelta !== null && (
                      <Badge tone={monthDelta <= 0 ? "ok" : "warn"}>
                        {monthDelta <= 0 ? "↓" : "↑"} {Math.abs(monthDelta).toFixed(1)}% vs previous
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {formatDateRange(month!.range.from, month!.range.to)} · {monthSummary.count}{" "}
                    {monthSummary.count === 1 ? "expense" : "expenses"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/expenses/new"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary shadow-[0_1px_2px_rgba(23,33,27,0.18)] transition-colors hover:bg-primary-hover"
                  >
                    <IconPlus className="h-4 w-4" />
                    Add expense
                  </Link>
                  <Link
                    href="/expenses/transactions"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
                  >
                    All transactions
                  </Link>
                  <Button variant="ghost" onClick={reload} loading={windowsLoading}>
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-6 sm:grid-cols-3 sm:gap-6">
                <MiniStat label="Expenses">{monthSummary.count}</MiniStat>
                <MiniStat label={`Average${effectiveBase ? ` (${effectiveBase})` : ""}`}>
                  {monthSummary.average === null ? (
                    "—"
                  ) : (
                    <Money
                      amount={monthSummary.average}
                      currency={effectiveBase ?? monthSummary.baseCurrency}
                    />
                  )}
                </MiniStat>
                <MiniStat label="Top category">
                  {topCategory ? (
                    <span className="flex items-center gap-2 text-base font-medium">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: topCategory.color }}
                      />
                      <span className="truncate">{topCategory.categoryName}</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </MiniStat>
              </div>
            </>
          )}
        </BentoTile>

        <RecentTransactions
          data={recent}
          loading={recentLoading}
          error={recentError}
          base={effectiveBase}
          snapshot={snapshot}
        />

        <AnalyticsBox windows={windows} base={base} snapshot={snapshot} loading={windowsLoading} />

        {monthSummary && monthSummary.count > 0 && (
          <>
            <BentoTile title="Top categories" className="lg:col-span-6">
              {month?.comparison.conversionStatus === "unavailable" ? (
                <p className="text-sm text-muted">
                  Category breakdowns need a rate to combine currencies; only per-currency totals are
                  available.
                </p>
              ) : monthSummary.byCategory.length === 0 ? (
                <p className="text-sm text-muted">No spending in this period.</p>
              ) : (
                <ul className="space-y-3.5">
                  {monthSummary.byCategory.map((entry) => {
                    const width = maxCategoryTotal > 0 ? (entry.total / maxCategoryTotal) * 100 : 0;
                    return (
                      <li key={entry.categoryId}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="truncate font-medium text-ink">
                              {entry.categoryName}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-ink">
                            <Money
                              amount={entry.total}
                              currency={effectiveBase ?? monthSummary.baseCurrency}
                            />
                            <span className="ml-2 text-xs text-muted">
                              {formatPercent(entry.percentage)}
                            </span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${width}%`, backgroundColor: entry.color }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </BentoTile>

            <BentoTile title="By currency" className="lg:col-span-6">
              <ul className="space-y-3">
                {monthSummary.byCurrency.map((entry) => (
                  <li key={entry.currency} className="flex items-center justify-between gap-3 text-sm">
                    <span className="inline-flex items-center gap-2">
                      <span className="font-semibold text-ink">{entry.currency}</span>
                      <span className="text-muted">
                        {entry.count} {entry.count === 1 ? "expense" : "expenses"}
                      </span>
                    </span>
                    <span className="tabular-nums font-medium text-ink">
                      <Money amount={entry.total} currency={entry.currency} />
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-muted">
                Native amounts as recorded. Combined totals above are converted into{" "}
                {effectiveBase ?? monthSummary.baseCurrency}.
              </p>
            </BentoTile>
          </>
        )}
      </BentoGrid>
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
