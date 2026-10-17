"use client";

/**
 * Create/edit form shared by /expenses/new, /expenses/[id]/edit and the
 * in-page Add-expense drawer.
 *
 * Option lists arrive asynchronously from the parent, so sensible defaults are
 * derived during render (not synced in an effect) — otherwise the selects would
 * render empty and a quick submit could send an empty categoryId.
 *
 * The live conversion preview is display-only: it is computed from the public
 * ECB snapshot and never changes the amount that gets stored.
 */

import { useState, type FormEvent } from "react";
import { Button, ErrorNote, Field, Input, Select } from "@/components/ui";
import { IconSwap } from "@/components/icons";
import { expensesApi } from "@/lib/expenses";
import { buildConversionPreview, dualAmounts, formatRateValue } from "@/lib/convert";
import { formatMoney } from "@/lib/format";
import { todayIso } from "@/lib/ranges";
import type { Expense, ExpenseCategory, RecurrenceFrequency, SupportedCurrency } from "@/lib/types";
import { usePair, useRateSnapshot } from "./use-expenses";

export function ExpenseForm({
  expense,
  categories,
  currencies,
  onSaved,
  onCancel,
  variant = "card",
  allowRecurrence = false,
}: {
  /** Present when editing; absent when creating. */
  expense?: Expense;
  categories: ExpenseCategory[];
  currencies: SupportedCurrency[];
  onSaved: () => void;
  onCancel: () => void;
  /** "card" is the standalone page shell; "panel" drops it for drawers/modals. */
  variant?: "card" | "panel";
  /** Show the "Repeat this expense" toggle for create flows. */
  allowRecurrence?: boolean;
}) {
  const isEditing = expense !== undefined;
  const { base, second } = usePair();
  const snapshot = useRateSnapshot();

  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [currency, setCurrency] = useState(expense?.currency ?? "");
  const [incurredOn, setIncurredOn] = useState(expense?.incurredOn ?? todayIso());
  const [description, setDescription] = useState(expense?.description ?? "");
  const [paymentMethod, setPaymentMethod] = useState(expense?.paymentMethod ?? "");

  const [repeat, setRepeat] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("MONTHLY");
  const [interval, setInterval] = useState("1");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An empty selection means "not chosen yet": fall back to the reporting
  // currency (a sensible default) then the first loaded option.
  const effectiveCategoryId = categoryId || categories[0]?.id || "";
  const effectiveCurrency = currency || base || currencies[0]?.code || "";

  const amountNumber = Number(amount);
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0;
  const canSubmit = Boolean(effectiveCategoryId && effectiveCurrency && amountValid) && !saving;

  // The preview is only meaningful when the amount is recorded in a currency
  // other than the Base — otherwise the recorded amount already is the headline.
  const showsPreview = Boolean(
    base && effectiveCurrency && base !== effectiveCurrency && amountValid,
  );
  const toBase = showsPreview
    ? buildConversionPreview(amountNumber, effectiveCurrency, base as string, snapshot)
    : null;
  const pair = toBase
    ? dualAmounts(amountNumber, effectiveCurrency, base, second, snapshot)
    : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !canSubmit) return;

    setSaving(true);
    setError(null);
    const payload = {
      categoryId: effectiveCategoryId,
      amount: amountNumber,
      currency: effectiveCurrency,
      incurredOn,
      description: description.trim() || undefined,
      paymentMethod: paymentMethod.trim() || undefined,
      ...(allowRecurrence && !isEditing && repeat
        ? {
            recurrence: {
              frequency,
              interval: Number(interval) > 0 ? Number(interval) : 1,
            },
          }
        : {}),
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

  // No categories is a fatal state for a form: there is nothing to pick.
  const emptyNotice = (
    <ErrorNote message="No categories are available yet. Try reloading the page." />
  );
  if (categories.length === 0) {
    return variant === "panel" ? (
      emptyNotice
    ) : (
      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        {emptyNotice}
      </section>
    );
  }

  const form = (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-5">
      {error && <ErrorNote message={error} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label="Amount"
              htmlFor="expense-amount"
              hint="Record it exactly as you paid — Pluto converts only for reports."
            >
              <div className="flex gap-2">
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
                  className="min-w-0 flex-1"
                  aria-invalid={amount !== "" && !amountValid}
                />
                <Select
                  aria-label="Currency you paid in"
                  value={effectiveCurrency}
                  onChange={setCurrency}
                  className="w-40 shrink-0"
                >
                  {currencies.map((entry) => (
                    <option key={entry.code} value={entry.code}>
                      {entry.code}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>

            {toBase && pair && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-border bg-surface-muted/60 px-4 py-3">
                <span className="inline-flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  <IconSwap aria-hidden="true" className="h-4 w-4 text-primary" />
                  <span className="font-normal text-muted">≈</span>
                  <span className="tabular-nums">{formatMoney(pair.base ?? 0, toBase.to)}</span>
                  {pair.second !== null && second && (
                    <span className="tabular-nums font-normal text-muted">
                      · {formatMoney(pair.second, second)}
                    </span>
                  )}
                  <span className="font-normal text-muted">in your pair</span>
                </span>
                <span className="text-xs text-muted">
                  1 {toBase.from} = {formatRateValue(toBase.rate)} {toBase.to} · {toBase.provider}{" "}
                  {toBase.effectiveDate}
                </span>
              </div>
            )}
          </div>

          <Field label="Category" htmlFor="expense-category">
            <Select
              id="expense-category"
              value={effectiveCategoryId}
              onChange={setCategoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
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

          <Field label="Description" htmlFor="expense-description" optional>
            <Input
              id="expense-description"
              maxLength={280}
              placeholder="e.g. Weekly groceries"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          <Field label="Payment method" htmlFor="expense-payment" optional>
            <Input
              id="expense-payment"
              maxLength={32}
              placeholder="e.g. CARD, CASH"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            />
          </Field>
        </div>

        {allowRecurrence && !isEditing && (
          <div className="rounded-2xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">Repeat this expense</p>
                <p className="mt-0.5 text-xs text-muted">
                  Recorded now, then confirm each occurrence when it falls due.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRepeat((value) => !value)}
                className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors ${
                  repeat
                    ? "bg-primary-subtle text-primary"
                    : "border border-border bg-surface-muted text-muted hover:text-ink"
                }`}
                aria-pressed={repeat}
              >
                {repeat ? "Repeating" : "Off"}
              </button>
            </div>

            {repeat && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Frequency" htmlFor="recurrence-frequency">
                  <Select
                    id="recurrence-frequency"
                    value={frequency}
                    onChange={(value) => setFrequency(value as RecurrenceFrequency)}
                  >
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </Select>
                </Field>
                <Field
                  label="Every"
                  htmlFor="recurrence-interval"
                  hint="Periods between occurrences (1 = every period)."
                >
                  <Input
                    id="recurrence-interval"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="12"
                    step="1"
                    value={interval}
                    onChange={(event) => setInterval(event.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-border pt-5">
          <Button type="submit" variant="primary" loading={saving} disabled={!canSubmit}>
            {isEditing ? "Save changes" : "Add expense"}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
    </form>
  );

  if (variant === "panel") return form;

  return (
    <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-sm font-medium text-ink">{isEditing ? "Edit expense" : "New expense"}</h2>
      {form}
    </section>
  );
}