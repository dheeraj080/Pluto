"use client";

/**
 * The Reports KPI card: one block answering "how much, how many, how much
 * each, and where".
 *
 * Every figure is driven by one comparison request for the range in force —
 * {@link useReportComparison} pairs the window with the equal-length window
 * before it — so the "vs previous N days" pills always compare like with like
 * and can never disagree with the totals they sit beside.
 *
 * One card, three parts: the headline "Total spent" with its change pill, then
 * the remaining three figures in a stat row under a hairline divider. The
 * shared "vs previous N days" comparison note lives once, in the card subtitle.
 */

import type { ReactNode } from "react";
import { formatPercent } from "@/lib/format";
import { DualAmount } from "@/components/amount";
import { Skeleton } from "@/components/ui";
import { ChangePill } from "@/components/pill";
import { CategorySwatch } from "@/components/category-swatch";
import type { ExpenseComparison } from "@/lib/types";
import { ReportCard } from "./report-card";

/** Percent change versus the previous window, or null when it is not meaningful. */
function pctChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return Number.isFinite(pct) ? pct : null;
}

function Dash() {
  return <span className="text-[1.75rem] font-light leading-none tabular-nums text-muted">—</span>;
}

export function ReportKpis({
  data,
  base,
  second,
  days,
  rangeLabel,
  loading,
  error,
  onRetry,
  className = "",
}: {
  data: ExpenseComparison | null;
  /** Primary currency. */
  base: string | null;
  /** Secondary currency, when one is paired. */
  second: string | null;
  /** Length of the window in days, for the "vs previous …" note. */
  days: number;
  /** The range every card on the page is describing; shown in the card subtitle. */
  rangeLabel: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  className?: string;
}) {
  const current = data?.current ?? null;
  const previous = data?.previous ?? null;
  const caption = `vs previous ${days} ${days === 1 ? "day" : "days"}`;
  const placeholder = loading && !data;
  const failed = Boolean(error) && !loading;

  const total = current?.total ?? null;
  const totalSecond = current?.secondaryTotal ?? null;
  const totalPct = pctChange(total, previous?.total ?? null);
  const average = current?.average ?? null;
  const averageSecond = current?.secondaryAverage ?? null;
  const averagePct = pctChange(average, previous?.average ?? null);
  const count = current?.count ?? null;
  const countPct = pctChange(count, previous?.count ?? null);

  const top = current?.byCategory?.[0] ?? null;
  const topPreviousTotal = top
    ? (previous?.byCategory.find((entry) => entry.categoryId === top.categoryId)?.total ?? null)
    : null;
  const topPct = top ? pctChange(top.total, topPreviousTotal) : null;

  return (
    <section aria-label="Key figures for the selected range" className={className}>
      <ReportCard
        title="Key figures"
        subtitle={`${rangeLabel} · ${caption}`}
        loading={placeholder}
        skeleton={<Skeleton className="h-48" />}
        error={failed ? error : null}
        onRetry={onRetry}
      >
        {/* Headline: Total spent, with its change pill. */}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Total spent</p>
            <div className="mt-2">
              {total !== null && base ? (
                <DualAmount
                  amount={total}
                  currency={base}
                  secondaryAmount={totalSecond}
                  secondaryCurrency={totalSecond != null ? second : null}
                  size="hero"
                  layout="inline"
                />
              ) : (
                <Dash />
              )}
            </div>
          </div>
          {!placeholder && !failed && totalPct != null && <ChangePill percent={totalPct} />}
        </div>

        {/* The remaining three figures under a hairline divider. */}
        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 border-t border-border pt-5 sm:grid-cols-3">
          <Stat label="Expenses" percent={countPct}>
            {count !== null ? (
              <span className="text-base font-semibold tabular-nums text-ink">{count}</span>
            ) : (
              <span className="text-base font-semibold text-muted">—</span>
            )}
          </Stat>

          <Stat label="Average per expense" percent={averagePct}>
            {average !== null && base ? (
              <DualAmount
                amount={average}
                currency={base}
                secondaryAmount={averageSecond}
                secondaryCurrency={averageSecond != null ? second : null}
                size="md"
                layout="inline"
              />
            ) : (
              <span className="text-base font-semibold text-muted">—</span>
            )}
          </Stat>

          <Stat label="Top category" percent={topPct}>
            {top ? (
              <span className="block min-w-0">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <CategorySwatch color={top.color} size={9} />
                  <span className="truncate text-sm font-medium text-ink">{top.categoryName}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {formatPercent(top.percentage)}
                  </span>
                </span>
                {base && (
                  <span className="mt-1 block truncate">
                    <DualAmount
                      amount={top.total}
                      currency={base}
                      secondaryAmount={top.secondaryTotal ?? null}
                      secondaryCurrency={top.secondaryTotal != null ? second : null}
                      size="md"
                      layout="inline"
                    />
                  </span>
                )}
              </span>
            ) : (
              <span className="text-base font-semibold text-muted">—</span>
            )}
          </Stat>
        </dl>
      </ReportCard>
    </section>
  );
}

function Stat({
  label,
  percent,
  children,
}: {
  label: string;
  percent: number | null;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wider text-muted">
          {label}
        </p>
        {percent != null && <ChangePill percent={percent} className="shrink-0" />}
      </div>
      <div className="mt-1.5 min-w-0">{children}</div>
    </div>
  );
}