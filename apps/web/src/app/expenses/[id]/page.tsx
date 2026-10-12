"use client";

/**
 * Expense detail: one recorded expense, read through the Pair.
 *
 * The headline is the Base value with the Second beside it; the amount as it
 * was actually paid stays visible as a small "Paid …" label, never rewritten.
 * The rate line underneath records which snapshot produced the converted
 * values, so a figure can always be traced back to its rate.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { expensesApi } from "@/lib/expenses";
import type { Expense } from "@/lib/types";
import { Button, ErrorNote, Skeleton } from "@/components/ui";
import { AppPageHeader, PairSwitcher } from "@/components/app-page-header";
import { DualAmount } from "@/components/amount";
import { CategorySwatch } from "@/components/category-swatch";
import { IconArrowLeft, IconEdit, IconTrash } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { buildConversionPreview, dualAmounts } from "@/lib/convert";
import { ConfirmDialog } from "@/components/dialog";
import { usePair, useRateSnapshot } from "../use-expenses";

const BACK_HREF = "/expenses/transactions";

export default function ExpenseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const { base, second, swap } = usePair();
  const snapshot = useRateSnapshot();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadExpense = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      setExpense(await expensesApi.getExpense(id));
    } catch (err) {
      // 404 also covers an expense belonging to another account.
      setError(err instanceof Error ? err.message : "Failed to load the expense.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => void loadExpense(), 0);
    return () => clearTimeout(timer);
  }, [loadExpense]);

  const handleDelete = async () => {
    if (!expense) return;
    setDeleting(true);
    try {
      await expensesApi.deleteExpense(expense.id);
      router.push(BACK_HREF);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete the expense.");
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const back = (
    <Link
      href={BACK_HREF}
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface-muted px-3.5 text-sm font-medium text-ink transition-colors duration-150 hover:border-border-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <IconArrowLeft className="h-4 w-4" />
      Back to transactions
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <AppPageHeader title="Expense details" actions={back} />
        <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        </section>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="space-y-6">
        <AppPageHeader title="Expense details" actions={back} />
        <ErrorNote message={error ?? "Expense not found"} />
      </div>
    );
  }

  const pair = dualAmounts(expense.amount, expense.currency, base, second, snapshot);
  const primaryCurrency = pair.base !== null ? (base ?? expense.currency) : expense.currency;
  const primaryAmount = pair.base ?? expense.amount;
  const recorded =
    expense.currency !== primaryCurrency
      ? { amount: expense.amount, currency: expense.currency }
      : null;

  const toBase =
    base && base !== expense.currency
      ? buildConversionPreview(expense.amount, expense.currency, base, snapshot)
      : null;
  const baseToSecond =
    base && second && base !== second
      ? buildConversionPreview(1, base, second, snapshot)
      : null;

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Expense details"
        dateRange={<span className="text-sm text-muted">{formatDate(expense.incurredOn)}</span>}
        pair={<PairSwitcher base={base} second={second} onSwap={swap} />}
        actions={back}
      />

      {error && <ErrorNote message={error} />}

      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-semibold tracking-tight text-ink">
                {expense.description || "Untitled expense"}
              </h2>
              <p className="mt-1.5 inline-flex items-center gap-2 text-sm text-muted">
                <CategorySwatch color={expense.categoryColor} size={10} />
                {expense.categoryName}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface-muted/50 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Amount</p>
            <div className="mt-1.5">
              <DualAmount
                amount={primaryAmount}
                currency={primaryCurrency}
                secondaryAmount={pair.second}
                secondaryCurrency={pair.second !== null ? second : null}
                recorded={recorded}
                size="hero"
                layout="inline"
              />
            </div>
            {(toBase || baseToSecond) && (
              <p className="mt-3 text-xs text-muted">
                {toBase && (
                  <>
                    1 {toBase.from} = {toBase.rate.toFixed(4)} {toBase.to} · {toBase.provider}{" "}
                    {toBase.effectiveDate}
                  </>
                )}
                {toBase && baseToSecond && " · "}
                {baseToSecond && !toBase && (
                  <>
                    1 {baseToSecond.from} = {baseToSecond.rate.toFixed(4)} {baseToSecond.to} ·{" "}
                    {baseToSecond.provider} {baseToSecond.effectiveDate}
                  </>
                )}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Meta label="Date" value={formatDate(expense.incurredOn)} />
            <Meta
              label="Category"
              value={
                <span className="inline-flex items-center gap-2">
                  <CategorySwatch color={expense.categoryColor} size={10} />
                  {expense.categoryName}
                </span>
              }
            />
            <Meta label="Payment method" value={expense.paymentMethod || "—"} />
          </dl>

          <div className="flex flex-wrap gap-3 border-t border-border pt-5">
            <Link
              href={`/expenses/${expense.id}/edit`}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <IconEdit className="h-4 w-4" />
              Edit expense
            </Link>
            <Button
              variant="danger"
              onClick={() => setConfirmOpen(true)}
              disabled={deleting}
              loading={deleting}
            >
              <span className="flex items-center gap-2">
                <IconTrash className="h-4 w-4" />
                Delete expense
              </span>
            </Button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this expense?"
        message={
          expense.description
            ? `“${expense.description}” will be permanently removed. This can't be undone.`
            : "This expense will be permanently removed. This can't be undone."
        }
        confirmLabel="Delete expense"
        cancelLabel="Cancel"
        onConfirm={() => void handleDelete()}
        onClose={() => setConfirmOpen(false)}
        variant="danger"
        busy={deleting}
      />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
