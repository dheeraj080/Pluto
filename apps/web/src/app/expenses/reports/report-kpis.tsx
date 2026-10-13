"use client";

/**
 * The Reports KPI row: four compact tiles answering "how much, how many, how
 * much each, and where".
 *
 * Every tile is driven by one comparison request for the range in force —
 * {@link useReportComparison} pairs the window with the equal-length window
 * before it — so the "vs previous N days" pills always compare like with like
 * and can never disagree with the totals they sit beside.
 *
 * Layout: a horizontal scroller on phones (cards keep a fixed width and snap),
 * a 2-up grid on tablets and a 4-up grid on desktop. Each tile is only as tall
 * as its content needs, with the label and change pill on the top line, the
 * figure beneath it, and the comparison caption on its own line at the bottom.
 */

import type { ReactNode } from "react";
import { formatPercent } from "@/lib/format";
import { DualAmount } from "@/components/amount";
import { ChangePill } from "@/components/pill";
import { CategorySwatch } from "@/components/category-swatch";
import { Skeleton } from "@/components/ui";
import type { ExpenseComparison } from "@/lib/types";
import { InlineError } from "./report-card";

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
  /** Length of the window in days, for the "vs previous …" caption. */
  days: number;
  /** The range every card on the page is describing; shown in the header row. */
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
  const average = current?.average ?? null;
  const averageSecond = current?.secondaryAverage ?? null;
  const count = current?.count ?? null;

  const top = current?.byCategory?.[0] ?? null;
  const topPreviousTotal = top
    ? (previous?.byCategory.find((entry) => entry.categoryId === top.categoryId)?.total ?? null)
    : null;

  return (
    <section aria-label="Key figures for the selected range" className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1 sm:px-0">
        <h2 className="text-sm font-medium text-ink">Key figures</h2>
        <p className="text-xs tabular-nums text-muted">{rangeLabel}</p>
      </div>
      {failed && error && <InlineError message={error} onRetry={onRetry} />}

      <div className="-mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        <KpiCard
          label="Total spent"
          caption={caption}
          percent={pctChange(total, previous?.total ?? null)}
          placeholder={placeholder}
          failed={failed}
        >
          {total !== null && base ? (
            <DualAmount
              amount={total}
              currency={base}
              secondaryAmount={totalSecond}
              secondaryCurrency={totalSecond != null ? second : null}
              size="kpi"
              layout="inline"
            />
          ) : (
            <Dash />
          )}
        </KpiCard>

        <KpiCard
          label="Expenses"
          caption={caption}
          percent={pctChange(count, previous?.count ?? null)}
          placeholder={placeholder}
          failed={failed}
        >
          {count !== null ? (
            <span className="text-[1.75rem] font-light leading-none tabular-nums text-ink">
              {count}
            </span>
          ) : (
            <Dash />
          )}
        </KpiCard>

        <KpiCard
          label="Average per expense"
          caption={caption}
          percent={pctChange(average, previous?.average ?? null)}
          placeholder={placeholder}
          failed={failed}
        >
          {average !== null && base ? (
            <DualAmount
              amount={average}
              currency={base}
              secondaryAmount={averageSecond}
              secondaryCurrency={averageSecond != null ? second : null}
              size="kpi"
              layout="inline"
            />
          ) : (
            <Dash />
          )}
        </KpiCard>

        <KpiCard
          label="Top category"
          caption={caption}
          percent={top ? pctChange(top.total, topPreviousTotal) : null}
          placeholder={placeholder}
          failed={failed}
        >
          {top ? (
            <span className="flex flex-col gap-1">
              <span className="flex items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <CategorySwatch color={top.color} size={9} />
                  <span className="truncate text-sm font-medium text-ink">{top.categoryName}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {formatPercent(top.percentage)}
                </span>
              </span>
              {base && (
                <DualAmount
                  amount={top.total}
                  currency={base}
                  secondaryAmount={top.secondaryTotal ?? null}
                  secondaryCurrency={top.secondaryTotal != null ? second : null}
                  size="kpi"
                  layout="inline"
                />
              )}
            </span>
          ) : (
            <Dash />
          )}
        </KpiCard>
      </div>
    </section>
  );
}

function KpiCard({
  label,
  percent,
  caption,
  placeholder,
  failed,
  children,
}: {
  label: string;
  percent: number | null;
  caption: string;
  placeholder: boolean;
  failed: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[112px] w-[17rem] shrink-0 snap-start flex-col gap-4 rounded-[20px] border border-border bg-surface p-6 sm:w-auto">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wider text-muted">
          {label}
        </p>
        {!placeholder && !failed && percent != null && (
          <ChangePill percent={percent} className="shrink-0" />
        )}
      </div>
      <div className="min-w-0">
        {failed ? <Dash /> : placeholder ? <Skeleton className="h-7 w-24" /> : children}
      </div>
      {!placeholder && !failed && percent != null && (
        <p className="text-[11px] leading-none text-muted">{caption}</p>
      )}
    </div>
  );
}
