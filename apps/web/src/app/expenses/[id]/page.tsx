"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { expensesApi } from "@/lib/expenses";
import type { Expense } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  ErrorNote,

  Money,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { IconArrowLeft, IconEdit, IconTrash } from "@/components/icons";
import { useBaseCurrency } from "../use-expenses";
import { formatDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/dialog";

export default function ExpenseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { base } = useBaseCurrency();
  const id = params?.id;

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
      const data = await expensesApi.getExpense(id);
      setExpense(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load expense";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadExpense();
  }, [loadExpense]);

  const handleDelete = async () => {
    if (!expense) return;
    try {
      setDeleting(true);
      await expensesApi.deleteExpense(expense.id);
      router.push("/expenses");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete expense";
      setError(message);
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Expense details"
          description="Loading expense details"
          action={
            <Link href="/expenses">
              <Button variant="ghost">
                <span className="flex items-center gap-2">
                  <IconArrowLeft className="h-4 w-4" />
                  Back to expenses
                </span>
              </Button>
            </Link>
          }
        />
        <Card>
          <div className="flex flex-col gap-4 p-6">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-1/4" />
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Expense details"
          description="Expense could not be loaded"
          action={
            <Link href="/expenses">
              <Button variant="ghost">
                <span className="flex items-center gap-2">
                  <IconArrowLeft className="h-4 w-4" />
                  Back to expenses
                </span>
              </Button>
            </Link>
          }
        />
        <ErrorNote message={error} />
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Expense details"
          description="Expense not found"
          action={
            <Link href="/expenses">
              <Button variant="ghost">
                <span className="flex items-center gap-2">
                  <IconArrowLeft className="h-4 w-4" />
                  Back to expenses
                </span>
              </Button>
            </Link>
          }
        />
        <ErrorNote message="Expense not found" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expense details"
        description={formatDate(expense.incurredOn)}
        action={
          <Link href="/expenses">
            <Button variant="ghost">
              <span className="flex items-center gap-2">
                <IconArrowLeft className="h-4 w-4" />
                Back to expenses
              </span>
            </Button>
          </Link>
        }
      />
      <Card>
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {expense.description || "Unnamed expense"}
            </h2>
            {expense.paymentMethod && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Payment method: {expense.paymentMethod}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Amount
              </span>
              <Money
                amount={expense.amount}
                currency={expense.currency}
                className="text-lg font-semibold"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Category
              </span>
              <Badge tone="neutral">{expense.categoryName}</Badge>
            </div>
            {expense.paymentMethod && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Payment
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {expense.paymentMethod}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`/expenses/${expense.id}/edit`}>
              <Button>
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
                {deleting ? "Deleting…" : "Delete expense"}
              </span>
            </Button>
            <Link href="/expenses">
              <Button variant="ghost">
                <span className="flex items-center gap-2">
                  <IconArrowLeft className="h-4 w-4" />
                  Back to expenses
                </span>
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onClose={() => setConfirmOpen(false)}
        variant="danger"
        busy={deleting}
      />
    </div>
  );
}
