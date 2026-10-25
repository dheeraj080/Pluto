"use client";

/**
 * The dashboard's "where is the money going" card.
 *
 * The ranked top five, each a muted dot, the category name, the primary-currency
 * figure with the second-currency value in small grey beneath it, and a thin
 * share bar with the percentage at its right end. The rows stay compact — about
 * 48px — so all five fit without large gaps.
 */

import Link from "next/link";
import { formatMoney, formatPercent } from "@/lib/format";
import { rateBetween } from "@/lib/convert";
import { ChartFrame } from "@/components/charts";
import { CategorySwatch } from "@/components/category-swatch";
import { Skeleton } from "@/components/ui";
import type { CategoryBreakdown, RateSnapshot } from "@/lib/types";

export function TopCategories({
  entries,
  base,
  second,
  snapshot,
  loading,
}: {
  entries: CategoryBreakdown[];
  base: string;
  second: string | null;
  snapshot: RateSnapshot | null;
  loading: boolean;
}) {
  const top = entries.slice(0, 5);
  const max = top.reduce((highest, entry) => Math.max(highest, entry.total), 0);

  return (
    <ChartFrame
      compact
      title="Top categories"
      className="order-5"
      loading={loading && entries.length === 0}
      skeleton={<Skeleton className="h-[176px]" />}
      action={
        <Link
          href="/expenses/reports"
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          View all →
        </Link>
      }
    >
      {top.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          Category breakdowns need a rate to combine currencies.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {top.map((entry) => (
            <CategoryRow
              key={entry.categoryId}
              entry={entry}
              max={max}
              base={base}
              second={second}
              snapshot={snapshot}
            />
          ))}
        </ul>
      )}
    </ChartFrame>
  );
}

export function CategoryRow({
  entry,
  max,
  base,
  second,
  snapshot,
}: {
  entry: CategoryBreakdown;
  /** Largest total in the list, for the share bar. */
  max: number;
  base: string;
  second: string | null;
  snapshot: RateSnapshot | null;
}) {
  const width = max > 0 ? (entry.total / max) * 100 : 0;
  const secondary = (() => {
    if (!second) return null;
    if (entry.secondaryTotal != null) return entry.secondaryTotal;
    if (!snapshot) return null;
    const rate = rateBetween(base, second, snapshot.rates);
    return rate == null ? null : entry.total * rate;
  })();

  return (
    <li>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-2">
          <CategorySwatch color={entry.color} size={9} />
          <span className="truncate text-sm text-ink">{entry.categoryName}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-medium tabular-nums text-ink">
            {formatMoney(entry.total, base)}
          </span>
          <span className="block text-[11px] tabular-nums text-muted">
            {second && secondary != null ? formatMoney(secondary, second) : "\u00A0"}
          </span>
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-paper">
          <div
            className="h-full rounded-full"
            style={{ width: `${width}%`, backgroundColor: entry.color }}
          />
        </div>
        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted">
          {formatPercent(entry.percentage)}
        </span>
      </div>
    </li>
  );
}