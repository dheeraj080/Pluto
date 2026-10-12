"use client";

/**
 * The dashboard's recent-transactions card, newest first.
 *
 * Each row shows the recorded amount re-expressed in the Pair: Base bold, the
 * Second smaller and grey, and a quiet "Paid …" label when the expense was
 * recorded in a third currency. The per-row values come from the public rate
 * snapshot and are display-only; the server aggregates own every total.
 */

import Link from "next/link";
import { formatDate } from "@/lib/format";
import { dualAmounts } from "@/lib/convert";
import type { Expense, Paginated, RateSnapshot } from "@/lib/types";
import { ChartFrame } from "@/components/charts";
import { EmptyState, Skeleton } from "@/components/ui";
import { TransactionRow } from "@/components/transaction-row";
import { IconPlus, IconReceipt } from "@/components/icons";

export function RecentTransactions({
  data,
  loading,
  error,
  base,
  second,
  snapshot,
}: {
  data: Paginated<Expense> | null;
  loading: boolean;
  error: string | null;
  base: string | null;
  second: string | null;
  snapshot: RateSnapshot | null;
}) {
  const items = data?.items ?? [];
  const isEmpty = !loading && items.length === 0;

  return (
    <ChartFrame
      title="Recent transactions"
      className="flex flex-col lg:col-span-7"
      bodyClassName="flex flex-1 flex-col pt-2"
      loading={loading && !data}
      skeleton={<RowSkeleton />}
      empty={
        isEmpty ? (
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
                Add your first expense
              </Link>
            }
          />
        ) : undefined
      }
      action={
        <Link
          href="/expenses/transactions"
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          View all →
        </Link>
      }
      footer={error ? <span className="text-danger">{error}</span> : undefined}
    >
      <ul className="flex flex-1 flex-col divide-y divide-border">
        {items.map((expense) => {
          const pair = dualAmounts(expense.amount, expense.currency, base, second, snapshot);
          const primaryCurrency = pair.base !== null ? (base ?? expense.currency) : expense.currency;
          const primaryAmount = pair.base ?? expense.amount;
          const secondAmount = pair.second !== null ? pair.second : null;
          const recorded =
            expense.currency !== primaryCurrency
              ? { amount: expense.amount, currency: expense.currency }
              : null;

          return (
            <li key={expense.id} className="flex-1">
              <TransactionRow
                href={`/expenses/${expense.id}`}
                color={expense.categoryColor}
                title={expense.description || expense.categoryName}
                meta={`${formatDate(expense.incurredOn)} · ${expense.categoryName}`}
                amount={primaryAmount}
                currency={primaryCurrency}
                secondAmount={secondAmount}
                secondCurrency={secondAmount !== null ? second : null}
                recorded={recorded}
              />
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}

function RowSkeleton() {
  return (
    <div className="space-y-1 px-2" aria-busy="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 py-2.5">
          <Skeleton className="size-2.5 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
