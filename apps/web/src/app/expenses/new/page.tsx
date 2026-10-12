"use client";

import { useRouter } from "next/navigation";
import { ErrorNote, Skeleton } from "@/components/ui";
import { AppPageHeader, BackLink } from "@/components/app-page-header";
import { ExpenseForm } from "../expense-form";
import { useExpenseSetup } from "../use-expenses";

export default function NewExpensePage() {
  const router = useRouter();
  const { categories, currencies, loading, error } = useExpenseSetup();

  const back = () => router.push("/expenses");

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="New expense"
        actions={<BackLink href="/expenses">Back to dashboard</BackLink>}
      />
      {error && <ErrorNote message={error} />}
      {loading ? (
        <div className="space-y-4 rounded-3xl border border-border bg-surface p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      ) : (
        <ExpenseForm
          categories={categories}
          currencies={currencies}
          onSaved={back}
          onCancel={back}
        />
      )}
    </div>
  );
}