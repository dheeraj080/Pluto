"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { expensesApi } from "@/lib/expenses";
import type { Expense } from "@/lib/types";
import { ErrorNote, Skeleton } from "@/components/ui";
import { IconArrowLeft } from "@/components/icons";
import { ExpenseForm } from "../../expense-form";
import { useExpenseSetup } from "../../use-expenses";

export default function EditExpensePage() {
  const router = useRouter();
  // Client-side dynamic segment access; `id` is always present for this route.
  const { id } = useParams<{ id: string }>();

  const { categories, currencies, loading: setupLoading, error: setupError } = useExpenseSetup();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const back = () => router.push("/expenses");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setError(null);
      expensesApi
        .getExpense(id)
        .then((result) => {
          if (!cancelled) setExpense(result);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          // 404 also covers an expense belonging to another account.
          setError(err instanceof Error ? err.message : "Failed to load the expense.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  const combinedError = error ?? setupError;
  const ready = !loading && !setupLoading && expense !== null;

  return (
    <div className="space-y-6">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <IconArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
      {combinedError && <ErrorNote message={combinedError} />}
      {!ready && !combinedError && (
        <div className="space-y-4 rounded-[var(--radius-card,8px)] border border-border bg-background p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      )}
      {ready && expense && (
        <ExpenseForm
          expense={expense}
          categories={categories}
          currencies={currencies}
          onSaved={back}
          onCancel={back}
        />
      )}
    </div>
  );
}
