"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNote, Skeleton } from "@/components/ui";
import { IconArrowLeft } from "@/components/icons";
import { ExpenseForm } from "../expense-form";
import { useExpenseSetup } from "../use-expenses";

export default function NewExpensePage() {
  const router = useRouter();
  const { categories, currencies, loading, error } = useExpenseSetup();

  const back = () => router.push("/expenses");

  return (
    <div className="space-y-6">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        <IconArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
      {error && <ErrorNote message={error} />}
      {loading ? (
        <div className="space-y-4 rounded-2xl border border-border bg-background p-6">
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
          allowRecurrence
        />
      )}
    </div>
  );
}