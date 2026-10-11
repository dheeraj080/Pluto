"use client";

/**
 * Expense detail: a single recorded expense, its native amount and — when the
 * reporting currency differs — the display-only "≈" conversion the rest of the
 * app shows. Edit and delete live here as well.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { expensesApi } from "@/lib/expenses";
import type { Expense } from "@/lib/types";
import { Badge, Button, Card, ErrorNote, Money, PageHeader, Skeleton } from "@/components/ui";
import { IconArrowLeft, IconEdit, IconTrash } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { buildConversionPreview } from "@/lib/convert";
import { ConfirmDialog } from "@/components/dialog";
import { useBaseCurrency, useRateSnapshot } from "../use-expenses";

const BACK_HREF = "/expenses/transactions";

export default function ExpenseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const { base } = useBaseCurrency();
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
    <Link href={BACK_HREF}>
      <Button variant="secondary" size="sm">
        <span className="flex items-center gap-2">
          <IconArrowLeft className="h-4 w-4" />
          Back to transactions
        </span>
      </Button>
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Expense details" description="Loading…" action={back} />
        <Card>
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        </Card>
      </div>
    );
  }

  if (error && !expense) {
    return (
      <div className="space-y-6">
        <PageHeader title="Expense details" description="Expense could not be loaded" action={back} />
        <ErrorNote message={error} />
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="space-y-6">
        <PageHeader title="Expense details" description="Expense not found" action={back} />
        <ErrorNote message="Expense not found" />
      </div>
    );
  }

  const converted =
    base && base !== expense.currency
      ? buildConversionPreview(expense.amount, expense.currency, base, snapshot)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense details"
        description={formatDate(expense.incurredOn)}
        action={back}
      />

      {error && <ErrorNote message={error} />}

      <Card>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight text-ink">
                {expense.description || "Untitled expense"}
              </h2>
              <p className="mt-1.5 inline-flex items-center gap-2 text-sm text-muted">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: expense.categoryColor }}
                />
                {expense.categoryName}
              </p>
            </div>
            <Badge tone="neutral">{formatDate(expense.incurredOn)}</Badge>
          </div>

          <div className="rounded-xl border border-border bg-surface-muted/50 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Amount</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-ink">
              <Money amount={expense.amount} currency={expense.currency} />
            </p>
            {converted && (
              <p className="mt-1.5 text-sm text-muted">
                ≈ <Money amount={converted.amount} currency={converted.to} /> at{" "}
                {converted.rate.toFixed(4)} · {converted.provider} {converted.effectiveDate}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Meta label="Date" value={formatDate(expense.incurredOn)} />
            <Meta
              label="Category"
              value={
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: expense.categoryColor }}
                  />
                  {expense.categoryName}
                </span>
              }
            />
            <Meta label="Payment method" value={expense.paymentMethod || "—"} />
          </dl>

          <div className="flex flex-wrap gap-3 border-t border-border pt-5">
            <Link href={`/expenses/${expense.id}/edit`}>
              <Button variant="primary">
                <span className="flex items-center gap-2">
                  <IconEdit className="h-4 w-4" />
                  Edit expense
                </span>
              </Button>
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
      </Card>

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

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
