"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { expensesApi } from "@/lib/expenses";
import type { Expense } from "@/lib/types";
import { ErrorNote, LoadingNote, PageHeader } from "@/components/ui";
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
      <PageHeader title="Edit expense" description="Update the details or move it to another category." />
      {combinedError && <ErrorNote message={combinedError} />}
      {!ready && !combinedError && <LoadingNote label="Loading expense…" />}
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
