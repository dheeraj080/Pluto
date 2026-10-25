"use client";

/**
 * The dashboard's recent-transactions card: the last few things bought.
 *
 * At most six rows, no inner scroll. Each row shows exactly the Pair — the
 * amount in the primary currency with the second-currency value in small grey
 * beneath it. The currency the expense was actually paid in never appears on
 * the row; it is revealed, together with the rate used and its date, on hover
 * or focus. When the month leaned on an estimated rate, one amber pill in the
 * header says so instead of tagging each row.
 */

import Link from "next/link";
import { formatDate } from "@/lib/format";
import { buildConversionPreview, dualAmounts } from "@/lib/convert";
import type { Expense, Paginated, RateSnapshot } from "@/lib/types";
import { ChartFrame } from "@/components/charts";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { TransactionRow } from "@/components/transaction-row";
import { InfoPill } from "@/components/pill";
import { IconPlus, IconReceipt } from "@/components/icons";
import { CardError } from "./dashboard-error";

const MAX_ROWS = 6;

export function RecentTransactions({
  data,
  loading,
  error,
  base,
  second,
  snapshot,
  estimated,
  onRetry,
  onAddExpense,
}: {
  data: Paginated<Expense> | null;
  loading: boolean;
  error: string | null;
  base: string | null;
  second: string | null;
  snapshot: RateSnapshot | null;
  /** True when any figure in the month used an estimated rate. */
  estimated: boolean;
  onRetry: () => void;
  /** When set, the empty-state CTA opens the in-page Add-expense drawer instead of /expenses/new. */
  onAddExpense?: () => void;
}) {
  const items = (data?.items ?? []).slice(0, MAX_ROWS);
  const isEmpty = !loading && !error && items.length === 0;

  return (
    <ChartFrame
      compact
      clip={false}
      title="Recent transactions"
      className="order-4"
      loading={loading && !data}
      skeleton={<RowSkeleton />}
      action={
        estimated ? (
          <InfoPill
            tone="warning"
            label="Includes estimated rates"
            title="Some rates are estimates"
          >
            A few transactions were converted using the closest published rate
            because their exact rate snapshot was unavailable.
          </InfoPill>
        ) : undefined
      }
      empty={
        isEmpty ? (
          <EmptyState
            icon={<IconReceipt className="h-5 w-5" />}
            title="No expenses yet"
            description="Record your first expense to start building a picture of where your money goes."
            action={
              onAddExpense ? (
                <Button variant="primary" onClick={onAddExpense}>
                  <IconPlus className="h-4 w-4" />
                  Add your first expense
                </Button>
              ) : (
                <Link
                  href="/expenses/new"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
                >
                  <IconPlus className="h-4 w-4" />
                  Add your first expense
                </Link>
              )
            }
          />
        ) : undefined
      }
      footer={
        <Link
          href="/expenses/transactions"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          View all transactions
        </Link>
      }
    >
      {error && !data ? (
        <CardError message={error} onRetry={onRetry} />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((expense) => {
            const pair = dualAmounts(expense.amount, expense.currency, base, second, snapshot);
            const primaryCurrency = pair.base !== null ? (base ?? expense.currency) : expense.currency;
            const primaryAmount = pair.base ?? expense.amount;
            const paid =
              expense.currency !== primaryCurrency
                ? { amount: expense.amount, currency: expense.currency }
                : null;
            const secondary =
              pair.second != null && second ? { amount: pair.second, currency: second } : null;
            const conversion = paid
              ? buildConversionPreview(expense.amount, expense.currency, primaryCurrency, snapshot)
              : null;

            return (
              <TransactionRow
                key={expense.id}
                href={`/expenses/${expense.id}`}
                color={expense.categoryColor}
                title={expense.description || expense.categoryName}
                meta={`${expense.categoryName} · ${formatDate(expense.incurredOn)}${
                  expense.recurringExpenseId ? " · recurring" : ""
                }`}
                amount={primaryAmount}
                currency={primaryCurrency}
                paid={paid}
                secondary={secondary}
                beneath="secondary"
                rate={
                  conversion
                    ? {
                        from: conversion.from,
                        to: conversion.to,
                        value: conversion.rate,
                        date: formatDate(conversion.effectiveDate),
                        provider: conversion.provider,
                      }
                    : null
                }
                estimated={estimated && paid !== null}
              />
            );
          })}
        </ul>
      )}
    </ChartFrame>
  );
}

function RowSkeleton() {
  return (
    <div className="space-y-1" aria-busy="true">
      {Array.from({ length: MAX_ROWS }).map((_, index) => (
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