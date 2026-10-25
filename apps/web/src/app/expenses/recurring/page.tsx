"use client";

/**
 * Recurring expenses.
 *
 * Two surfaces: due-now occurrences (confirm to post an expense, skip to
 * dismiss), and the rules list (add/edit/delete, pause/resume). Everything is
 * loaded on the client using the same no-query-library pattern as Budgets.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog, Dialog } from "@/components/dialog";
import { AppPageHeader, PairSwitcher } from "@/components/app-page-header";
import { recurringApi } from "@/lib/expenses";
import { describeCadence, formatDate, formatMoney } from "@/lib/format";
import type {
  RecurrenceFrequency,
  RecurringExpense,
  RecurringOccurrence,
} from "@/lib/types";
import {
  Button,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Select,
  Skeleton,
} from "@/components/ui";
import { useExpenseSetup, usePair } from "../use-expenses";
import { CategorySwatch } from "@/components/category-swatch";

interface RuleFormState {
  categoryId: string;
  amount: string;
  currency: string;
  frequency: RecurrenceFrequency;
  interval: string;
  startDate: string;
  endDate: string;
  description: string;
  paymentMethod: string;
  status?: RecurringExpense["status"];
}

function emptyForm(currency?: string): RuleFormState {
  return {
    categoryId: "",
    amount: "",
    currency: currency || "",
    frequency: "MONTHLY",
    interval: "1",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    description: "",
    paymentMethod: "",
  };
}

export default function RecurringPage() {
  const { categories, currencies, error: setupError } = useExpenseSetup();
  const { base, second, swap } = usePair();

  const [rules, setRules] = useState<RecurringExpense[]>([]);
  const [occurrences, setOccurrences] = useState<RecurringOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [form, setForm] = useState<RuleFormState>(() => emptyForm(base ?? undefined));
  const [confirm, setConfirm] = useState<{ type: "delete" | "confirm-one" | "skip-one"; id: string; label?: string } | null>(null);
  const [working, setWorking] = useState(false);

  const currencyOptions = useMemo(() => currencies.map((c) => c.code), [currencies]);
  const effectiveCurrency = form.currency || currencyOptions[0] || "";

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [ruleList, occList] = await Promise.all([
        recurringApi.listRules(),
        recurringApi.listOccurrences({ status: "PENDING", limit: 100 }),
      ]);
      setRules(ruleList);
      setOccurrences(occList.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recurring expenses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(base ?? effectiveCurrency));
    setSheetOpen(true);
  };

  const openEdit = (rule: RecurringExpense) => {
    setEditing(rule);
    setForm({
      categoryId: rule.categoryId,
      amount: String(rule.amount),
      currency: rule.currency,
      frequency: rule.frequency,
      interval: String(rule.interval),
      startDate: rule.startDate,
      endDate: rule.endDate ?? "",
      description: rule.description ?? "",
      paymentMethod: rule.paymentMethod ?? "",
      status: rule.status,
    });
    setSheetOpen(true);
  };

  const save = async () => {
    setError(null);
    setWorking(true);
    try {
      if (editing) {
        await recurringApi.updateRule(editing.id, {
          categoryId: form.categoryId,
          amount: Number(form.amount),
          currency: effectiveCurrency,
          frequency: form.frequency,
          interval: Number(form.interval),
          startDate: form.startDate,
          endDate: form.endDate || null,
          description: form.description || undefined,
          paymentMethod: form.paymentMethod || undefined,
          status: form.status,
        });
      } else {
        await recurringApi.createRule({
          categoryId: form.categoryId,
          amount: Number(form.amount),
          currency: effectiveCurrency,
          frequency: form.frequency,
          interval: Number(form.interval) || 1,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          description: form.description || undefined,
          paymentMethod: form.paymentMethod || undefined,
        });
      }
      setSheetOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the rule.");
    } finally {
      setWorking(false);
    }
  };

  const perform = async () => {
    if (!confirm) return;
    setWorking(true);
    try {
      if (confirm.type === "delete") {
        await recurringApi.deleteRule(confirm.id);
      } else if (confirm.type === "confirm-one") {
        await recurringApi.confirmOccurrence(confirm.id);
      } else if (confirm.type === "skip-one") {
        await recurringApi.skipOccurrence(confirm.id);
      }
      setConfirm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setWorking(false);
    }
  };

  const confirmAll = async () => {
    setBusy("confirm-all");
    try {
      await recurringApi.confirmManyOccurrences();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm occurrences.");
    } finally {
      setBusy(null);
    }
  };

  const togglePaused = async (rule: RecurringExpense) => {
    setBusy(`pause-${rule.id}`);
    try {
      await recurringApi.updateRule(rule.id, {
        status: rule.status === "PAUSED" ? "ACTIVE" : "PAUSED",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Recurring"
        pair={<PairSwitcher base={base} second={second} onSwap={swap} />}
        actions={
          <Button variant="primary" onClick={openCreate}>
            Add recurring
          </Button>
        }
      />

      {setupError && <ErrorNote message={setupError} />}
      {error && <ErrorNote message={error} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="rounded-3xl border border-border bg-surface lg:col-span-7">
          <div className="flex items-start justify-between px-5 pt-5 sm:px-6">
            <div>
              <h2 className="text-sm font-medium text-ink">Due now</h2>
              <p className="mt-0.5 text-xs text-muted">Confirm to post, or skip.</p>
            </div>
            {occurrences.length > 1 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={confirmAll}
                loading={busy === "confirm-all"}
              >
                Confirm all
              </Button>
            )}
          </div>
          <div className="px-4 pb-5 pt-4 sm:px-5">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : occurrences.length === 0 ? (
              <EmptyState
                title="Nothing due"
                description="Nothing is posted until you confirm it."
              />
            ) : (
              <ul className="divide-y divide-border">
                {occurrences.map((occ) => (
                  <li key={occ.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="flex items-center gap-2">
                          <CategorySwatch color={occ.categoryColor} size={9} />
                          <span className="text-sm font-medium text-ink">
                            {occ.description || occ.categoryName}
                          </span>
                        </span>
                        <p className="mt-0.5 text-xs text-muted">
                          {occ.categoryName} · due {formatDate(occ.dueOn)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-ink">
                          {formatMoney(occ.amount, occ.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirm({ type: "skip-one", id: occ.id })}
                      >
                        Skip
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setConfirm({ type: "confirm-one", id: occ.id })}
                      >
                        Confirm
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-surface lg:col-span-5">
          <div className="px-5 pt-5 sm:px-6">
            <h2 className="text-sm font-medium text-ink">Rules</h2>
            <p className="mt-0.5 text-xs text-muted">Manage repeating expenses.</p>
          </div>
          <div className="px-4 pb-5 pt-4 sm:px-5">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : rules.length === 0 ? (
              <EmptyState
                title="No recurring expenses"
                description="Add one to repeat a charge."
                action={
                  <Button variant="primary" onClick={openCreate}>
                    Add recurring
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {rules.map((rule) => (
                  <li key={rule.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="flex items-center gap-2">
                          <CategorySwatch color={rule.categoryColor} size={9} />
                          <span className="text-sm font-medium text-ink">
                            {rule.description || rule.categoryName}
                          </span>
                          {rule.status === "PAUSED" && (
                            <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted">paused</span>
                          )}
                        </span>
                        <p className="mt-0.5 text-xs text-muted">
                          {rule.categoryName} · {describeCadence(rule.frequency, rule.interval)}
                          {rule.pendingCount > 0 && ` · ${rule.pendingCount} due`}
                        </p>
                        {rule.nextDueOn && (
                          <p className="mt-0.5 text-xs text-muted">next {formatDate(rule.nextDueOn)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-ink">
                          {formatMoney(rule.amount, rule.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePaused(rule)}
                        loading={busy === `pause-${rule.id}`}
                      >
                        {rule.status === "PAUSED" ? "Resume" : "Pause"}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => openEdit(rule)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirm({ type: "delete", id: rule.id, label: rule.description || rule.categoryName })}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? "Edit recurring" : "Add recurring"}
        width="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSheetOpen(false)} disabled={working}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={working}>
              {editing ? "Save changes" : "Add recurring"}
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted">
          The amount and category are copied onto each occurrence as it is generated.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="rec-category">
            <Select id="rec-category" value={form.categoryId} onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
              <option value="">Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Amount" htmlFor="rec-amount">
            <Input id="rec-amount" type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </Field>
          <Field label="Currency" htmlFor="rec-currency">
            <Select id="rec-currency" value={effectiveCurrency} onChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </Select>
          </Field>
          <Field label="Frequency" htmlFor="rec-freq">
            <Select id="rec-freq" value={form.frequency} onChange={(v) => setForm((f) => ({ ...f, frequency: v as RecurrenceFrequency }))}>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </Select>
          </Field>
          <Field label="Every (periods)" htmlFor="rec-interval" hint="1 = every period; max 12.">
            <Input id="rec-interval" type="number" min="1" max="12" value={form.interval} onChange={(e) => setForm((f) => ({ ...f, interval: e.target.value }))} />
          </Field>
          <Field label="Starts" htmlFor="rec-start">
            <Input id="rec-start" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          </Field>
          <Field label="Ends (optional)" htmlFor="rec-end">
            <Input id="rec-end" type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description (optional)" htmlFor="rec-desc">
              <Input id="rec-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Payment method (optional)" htmlFor="rec-pay">
              <Input id="rec-pay" value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))} />
            </Field>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.type === "delete" ? "Delete this recurring expense?" : confirm?.type === "skip-one" ? "Skip this occurrence?" : "Record this expense?"}
        message={
          confirm?.type === "delete"
            ? `This removes the rule and its pending occurrences. Expenses already recorded are kept.`
            : confirm?.type === "skip-one"
              ? "This dismisses the occurrence without posting an expense."
              : "This posts the occurrence to Activity for the amount shown."
        }
        confirmLabel={confirm?.type === "delete" ? "Delete" : confirm?.type === "skip-one" ? "Skip" : "Confirm"}
        variant={confirm?.type === "delete" ? "danger" : confirm?.type === "skip-one" ? "secondary" : "primary"}
        busy={working}
        onConfirm={perform}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
