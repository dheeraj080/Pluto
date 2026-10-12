"use client";

/**
 * The dashboard's headline card: what the user spent this month.
 *
 * One number answers the first question in five seconds — the month-to-date
 * total in the Pair — with a fair "vs same days last month" pill beside it and
 * the three supporting figures (count, average, top category) tucked under a
 * hairline divider rather than in cards of their own.
 */

import type { ReactNode } from "react";
import { formatMoney } from "@/lib/format";
import { rateBetween } from "@/lib/convert";
import { ChartFrame } from "@/components/charts";
import { DualAmount } from "@/components/amount";
import { ChangePill } from "@/components/pill";
import { CategorySwatch } from "@/components/category-swatch";
import { Skeleton } from "@/components/ui";
import { CardError } from "./dashboard-error";
import type { ExpenseSummary, RateSnapshot } from "@/lib/types";

export function SpendingCard({
  summary,
  second,
  snapshot,
  delta,
  loading,
  error,
  onRetry,
}: {
  summary: ExpenseSummary | null;
  /** Second currency, when the user has chosen a pair. */
  second: string | null;
  /** Latest published snapshot, used to price the top category in the second currency. */
  snapshot: RateSnapshot | null;
  /** Percent change against the same days of last month. */
  delta: number | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const currency = summary?.baseCurrency ?? null;
  const total = summary?.converted ? summary.total : null;
  const secondaryTotal = summary?.converted ? (summary.secondaryTotal ?? null) : null;
  const topCategory = summary?.byCategory?.[0] ?? null;

  const topAmount = topCategory && currency ? topCategory.total : null;
  const topSecond = (() => {
    if (topAmount == null || !second) return null;
    const known = topCategory?.secondaryTotal;
    if (known != null) return known;
    if (!snapshot || !currency) return null;
    const rate = rateBetween(currency, second, snapshot.rates);
    return rate == null ? null : topAmount * rate;
  })();

  return (
    <ChartFrame
      compact
      glow
      title="Spent this month"
      className="order-1"
      loading={loading && !summary}
      skeleton={<Skeleton className="h-[128px]" />}
    >
      {error && !summary ? (
        <CardError message={error} onRetry={onRetry} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {currency ? (
                total === null ? (
                  <span className="text-[2.75rem] font-light leading-none text-muted">—</span>
                ) : (
                  <DualAmount
                    amount={total}
                    currency={currency}
                    secondaryAmount={secondaryTotal}
                    secondaryCurrency={secondaryTotal != null ? second : null}
                    size="display"
                    layout="inline"
                  />
                )
              ) : (
                <Skeleton className="h-11 w-44" />
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                {delta !== null && <ChangePill percent={delta} caption="vs same days last month" />}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
            <Stat label="Expenses">{summary ? summary.count : "—"}</Stat>
            <Stat label="Average">
              {!summary || summary.average == null || !currency ? (
                <span className="text-muted">—</span>
              ) : (
                <DualAmount
                  amount={summary.average}
                  currency={currency}
                  secondaryAmount={summary.secondaryAverage ?? null}
                  secondaryCurrency={summary.secondaryAverage != null ? second : null}
                  size="sm"
                  layout="stack"
                />
              )}
            </Stat>
            <Stat label="Top category">
              {topCategory ? (
                <span className="block min-w-0">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <CategorySwatch color={topCategory.color} size={9} />
                    <span className="truncate">{topCategory.categoryName}</span>
                  </span>
                  {topAmount != null && currency && (
                    <span className="mt-0.5 block truncate text-xs tabular-nums text-muted">
                      {formatMoney(topAmount, currency)}
                      {topSecond != null && second && <> · {formatMoney(topSecond, second)}</>}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted">—</span>
              )}
            </Stat>
          </div>
        </>
      )}
    </ChartFrame>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-1 truncate text-sm font-medium text-ink">{children}</div>
    </div>
  );
}