"use client";

/**
 * Create/edit form shared by /expenses/new and /expenses/[id]/edit.
 *
 * Option lists arrive asynchronously from the parent, so sensible defaults are
 * applied in an effect rather than at initial state — otherwise the selects
 * would render empty and a user submitting quickly could send an empty
 * categoryId.
 */

import { useState, type FormEvent } from "react";
import { Button, Card, ErrorNote, Field, Input, Select } from "@/components/ui";
import { expensesApi } from "@/lib/expenses";
import type { Expense, ExpenseCategory, SupportedCurrency } from "@/lib/types";

/** UTC "today", matching the YYYY-MM-DD the server stores for `incurredOn`. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseForm({
  expense,
  categories,
  currencies,
  onSaved,
  onCancel,
}: {
  /** Present when editing; absent when creating. */
  expense?: Expense;
  categories: ExpenseCategory[];
  currencies: SupportedCurrency[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEditing = expense !== undefined;

  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [currency, setCurrency] = useState(expense?.currency ?? "");
  const [incurredOn, setIncurredOn] = useState(expense?.incurredOn ?? todayIso());
  const [description, setDescription] = useState(expense?.description ?? "");
  const [paymentMethod, setPaymentMethod] = useState(expense?.paymentMethod ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An empty selection means "not chosen yet": fall back to the first loaded
  // option, so the selects are never blank while the lists resolve. Derived
  // during render rather than synced in an effect, which would cause an extra
  // render pass and can submit an empty categoryId if the user is quick.
  const effectiveCategoryId = categoryId || categories[0]?.id || "";
  const effectiveCurrency = currency || currencies[0]?.code || "";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!effectiveCategoryId || !effectiveCurrency || !(Number(amount) > 0)) return;

    setSaving(true);
    setError(null);
    const payload = {
      categoryId: effectiveCategoryId,
      amount: Number(amount),
      currency: effectiveCurrency,
      incurredOn,
      description: description.trim() || undefined,
      paymentMethod: paymentMethod.trim() || undefined,
    };

    try {
      if (expense) await expensesApi.updateExpense(expense.id, payload);
      else await expensesApi.createExpense(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the expense.");
    } finally {
      setSaving(false);
    }
  };

  if (categories.length === 0) {
    return (
      <Card>
        <ErrorNote message="No categories are available yet. Try reloading the page." />
      </Card>
    );
  }

  return (
    <Card title={isEditing ? "Edit expense" : "New expense"}>
      <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4 sm:grid-cols-2">
        {error && <div className="sm:col-span-2">{<ErrorNote message={error} />}</div>}

        <Field label="Category" htmlFor="expense-category">
          <Select
            id="expense-category"
            value={effectiveCategoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Currency" htmlFor="expense-currency">
          <Select
            id="expense-currency"
            value={effectiveCurrency}
            onChange={(event) => setCurrency(event.target.value)}
            required
          >
            {currencies.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.code} — {entry.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Amount" htmlFor="expense-amount">
          <Input
            id="expense-amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </Field>

        <Field label="Date" htmlFor="expense-date">
          <Input
            id="expense-date"
            type="date"
            value={incurredOn}
            onChange={(event) => setIncurredOn(event.target.value)}
            required
          />
        </Field>

        <Field label="Description" htmlFor="expense-description">
          <Input
            id="expense-description"
            maxLength={280}
            placeholder="e.g. Weekly groceries"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <Field label="Payment method" htmlFor="expense-payment" hint="Optional">
          <Input
            id="expense-payment"
            maxLength={32}
            placeholder="e.g. CARD, CASH"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
          />
        </Field>

        <div className="flex gap-3 sm:col-span-2">
          <Button type="submit" tone="accent" disabled={saving}>
            {saving ? "Saving…" : isEditing ? "Save changes" : "Add expense"}
          </Button>
          <Button onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
