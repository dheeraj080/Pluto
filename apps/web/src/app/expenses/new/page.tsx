"use client";

import { useRouter } from "next/navigation";
import { ErrorNote, LoadingNote, PageHeader } from "@/components/ui";
import { ExpenseForm } from "../expense-form";
import { useExpenseSetup } from "../use-expenses";

export default function NewExpensePage() {
  const router = useRouter();
  const { categories, currencies, loading, error } = useExpenseSetup();

  const back = () => router.push("/expenses");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add expense"
        description="Amounts are stored in the currency you spend, then converted for reports."
      />
      {error && <ErrorNote message={error} />}
      {loading && <LoadingNote label="Loading form…" />}
      {!loading && (
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
