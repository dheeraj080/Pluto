"use client";

/**
 * The dashboard's budget card: how much is left this month, and whether the
 * pace is sustainable.
 *
 * It is deliberately compact — a progress line plus the two facts that make it
 * actionable: the share used, and a plain per-day allowance for the rest of the
 * month. With no budget it invites one instead of showing an empty bar.
 */

import Link from "next/link";
import { formatMoney, formatPercent } from "@/lib/format";
import { ChartFrame } from "@/components/charts";
import { DualAmount } from "@/components/amount";
import { Skeleton } from "@/components/ui";
import { IconTarget } from "@/components/icons";
import { CardError } from "./dashboard-error";
import type { BudgetStatus } from "@/lib/types";
import type { MonthWindow } from "@/lib/ranges";

export function BudgetCard({
  budget,
  window,
  second,
  loading,
  error,
  onRetry,
}: {
  budget: BudgetStatus | null;
  window: MonthWindow;
  second: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const currency = budget?.convertedCurrency ?? budget?.currency ?? null;

  return (
    <ChartFrame
      compact
      title="Left to spend"
      className="order-2"
      loading={loading && !budget}
      skeleton={<Skeleton className="h-[128px]" />}
      action={
        <Link
          href="/expenses/budgets"
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Budgets →
        </Link>
      }
    >
      {error && !budget ? (
        <CardError message={error} onRetry={onRetry} />
      ) : !budget ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted">
            Set a monthly budget to see what is left to spend and a per-day allowance.
          </p>
          <Link
            href="/expenses/budgets"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface-muted px-3.5 text-sm font-medium text-ink transition-colors duration-150 hover:border-border-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <IconTarget className="h-4 w-4" />
            Set a monthly budget
          </Link>
        </div>
      ) : !budget.applied ? (
        <p className="text-sm text-muted">This budget has not started yet.</p>
      ) : budget.convertedAmount === null || !currency ? (
        <p className="text-sm text-muted">
          The budget target could not be converted, so a balance cannot be shown.
        </p>
      ) : (
        <>
          <DualAmount
            amount={budget.remaining}
            currency={currency}
            secondaryAmount={budget.secondaryRemaining ?? null}
            secondaryCurrency={budget.secondaryRemaining != null ? second : null}
            size="lg"
            layout="inline"
            className={budget.overBudget ? "[&_span]:text-warning" : ""}
          />

          <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, budget.percentage))}%`,
                backgroundColor: budget.overBudget ? "var(--warning)" : "var(--primary)",
              }}
            />
          </div>

          <p className="mt-2.5 text-sm text-muted">
            <span className="tabular-nums text-ink">{formatPercent(budget.percentage)}</span> of{" "}
            <span className="tabular-nums">{formatMoney(budget.budgetAmount, currency)}</span> used
          </p>

          <p className="mt-1 text-sm text-muted">
            {budget.overBudget ? (
              <>
                Over budget by{" "}
                <span className="tabular-nums text-warning">
                  {formatMoney(Math.abs(budget.remaining), currency)}
                </span>
                .
              </>
            ) : window.daysLeft > 0 ? (
              <>
                About{" "}
                <span className="tabular-nums text-ink">
                  {formatMoney(budget.remaining / window.daysLeft, currency)}
                </span>{" "}
                per day for the next {window.daysLeft}{" "}
                {window.daysLeft === 1 ? "day" : "days"}.
              </>
            ) : (
              "The month is over."
            )}
          </p>
        </>
      )}
    </ChartFrame>
  );
}
