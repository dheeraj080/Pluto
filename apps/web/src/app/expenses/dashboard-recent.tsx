"use client";

/**
 * The dashboard's left column: the most recent transactions, newest first.
 *
 * Each row shows the native amount as recorded and, when the reporting
 * currency differs, an "≈" converted figure from the public rate snapshot —
 * display-only, exactly like the transactions table.
 */

import Link from "next/link";
import { buildConversionPreview } from "@/lib/convert";
import { formatDate, formatMoney } from "@/lib/format";
import type { Expense, Paginated, RateSnapshot } from "@/lib/types";
import { BentoTile } from "@/components/bento";
import { EmptyState, Skeleton } from "@/components/ui";
import { IconPlus, IconReceipt } from "@/components/icons";

export function RecentTransactions({
  data,
  loading,
  error,
  base,
  snapshot,
}: {
  data: Paginated<Expense> | null;
  loading: boolean;
  error: string | null;
  base: string | null;
  snapshot: RateSnapshot | null;
}) {
  return (
    <BentoTile
      title="Recent transactions"
      className="lg:col-span-5"
      action={
        <Link
          href="/expenses/transactions"
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          View all →
        </Link>
      }
      bodyClassName="flex flex-col"
    >
      {loading && !data ? (
        <div className="space-y-3.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<IconReceipt className="h-5 w-5" />}
          title="No expenses yet"
          description="Record your first expense to start building a picture of where your money goes."
          action={
            <Link
              href="/expenses/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
            >
              <IconPlus className="h-4 w-4" />
              Add expense
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-1 flex-col divide-y divide-border">
          {data.items.map((expense) => {
            const converted =
              base && base !== expense.currency && snapshot
                ? buildConversionPreview(expense.amount, expense.currency, base, snapshot)
                : null;
            return (
              <li key={expense.id} className="flex-1">
                <Link
                  href={`/expenses/${expense.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-muted"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: expense.categoryColor }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {expense.description || expense.categoryName}
                    </span>
                    <span className="block text-xs text-muted">
                      {formatDate(expense.incurredOn)} · {expense.categoryName}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-medium tabular-nums text-ink">
                      {formatMoney(expense.amount, expense.currency)}
                    </span>
                    {converted && (
                      <span className="block text-xs text-muted">
                        ≈ {formatMoney(converted.amount, converted.to)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </BentoTile>
  );
}
