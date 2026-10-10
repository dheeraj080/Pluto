"use client";

/**
 * Expense dashboard: this month's totals, a filterable list, and quick delete.
 *
 * Summary and list are fetched together — they describe the same filtered
 * window, so loading them separately would let the two halves disagree while a
 * request is in flight.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { expensesApi, type ExpenseSort } from "@/lib/expenses";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import type { Expense, ExpenseCategory, ExpenseSummary, Paginated } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Input,
  LoadingNote,
  PageHeader,
  Pagination,
  Select,
  StatCard,
  Table,
} from "@/components/ui";
import { useBaseCurrency, useExpenseSetup } from "./use-expenses";

const SORTS = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "amount_desc", label: "Highest amount" },
  { value: "amount_asc", label: "Lowest amount" },
] as const;

export default function ExpensesDashboardPage() {
  const { categories, currencies, loading: setupLoading, error: setupError } = useExpenseSetup();
  const { base, setBase } = useBaseCurrency();

  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [page, setPage] = useState<Paginated<Expense> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("date_desc");
  const [pageNumber, setPageNumber] = useState(1);

  const LIMIT = 10;

  const load = useCallback(async () => {
    setError(null);
    const baseParam = base ?? undefined;
    try {
      const [summaryResult, listResult] = await Promise.all([
        expensesApi.getSummary({ base: baseParam }),
        expensesApi.listExpenses({
          page: pageNumber,
          limit: LIMIT,
          categoryId: categoryId || undefined,
          from: from || undefined,
          to: to || undefined,
          search: search || undefined,
          sort,
        }),
      ]);
      setSummary(summaryResult);
      setPage(listResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load expenses.");
    }
  }, [base, categoryId, from, pageNumber, search, sort, to]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Changing any filter invalidates the current page number. Done in the
  // handlers rather than an effect so the reset lands in the same render pass
  // as the filter change instead of causing an extra one.
  const onSearchChange = (value: string) => {
    setSearch(value);
    setPageNumber(1);
  };
  const onCategoryChange = (value: string) => {
    setCategoryId(value);
    setPageNumber(1);
  };
  const onFromChange = (value: string) => {
    setFrom(value);
    setPageNumber(1);
  };
  const onToChange = (value: string) => {
    setTo(value);
    setPageNumber(1);
  };
  const onSortChange = (value: ExpenseSort) => {
    setSort(value);
    setPageNumber(1);
  };

  const handleDelete = async (expense: Expense) => {
    if (!window.confirm(`Delete “${expense.description ?? expense.categoryName}”?`)) return;
    setBusyId(expense.id);
    try {
      await expensesApi.deleteExpense(expense.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete the expense.");
    } finally {
      setBusyId(null);
    }
  };

  const topCategory = summary?.byCategory[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description={
          summary
            ? `${formatDate(summary.from)} – ${formatDate(summary.to)}`
            : "Track spending across currencies."
        }
        action={
          <div className="flex items-center gap-2">
            <label htmlFor="base-currency" className="text-sm text-muted">
              Base
            </label>
            <Select
              id="base-currency"
              value={base ?? ""}
              onChange={(event) => setBase(event.target.value)}
              className="w-28"
            >
              <option value="">Default</option>
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {setupError && <ErrorNote message={setupError} />}
      {error && <ErrorNote message={error} />}

      {summary && !summary.converted && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Exchange rates are unavailable, so totals are shown per currency only. Category and
          combined totals will appear once rates can be fetched again.
        </p>
      )}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={`Total spent (${summary.baseCurrency})`}
            value={summary.total === null ? "—" : formatMoney(summary.total, summary.baseCurrency)}
          />
          <StatCard label="Expenses" value={summary.count} />
          <StatCard
            label="Average"
            value={
              summary.average === null ? "—" : formatMoney(summary.average, summary.baseCurrency)
            }
          />
          <StatCard
            label="Top category"
            value={
              topCategory ? (
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: topCategory.color }}
                  />
                  <span className="truncate text-lg">{topCategory.categoryName}</span>
                  <span className="text-sm font-normal text-muted">
                    {formatPercent(topCategory.percentage)}
                  </span>
                </span>
              ) : (
                "—"
              )
            }
          />
        </div>
      )}

      {summary && summary.byCurrency.length > 0 && (
        <Card title="By currency">
          <div className="flex flex-wrap gap-2">
            {summary.byCurrency.map((entry) => (
              <Badge key={entry.currency} tone="neutral">
                {entry.currency} {formatMoney(entry.total, entry.currency)} · {entry.count}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <Card
        title="All expenses"
        action={
          <Button onClick={() => void load()} disabled={setupLoading}>
            Refresh
          </Button>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            type="search"
            placeholder="Search description…"
            aria-label="Search description"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <Select
            aria-label="Filter by category"
            value={categoryId}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category: ExpenseCategory) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
          />
          <Input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
          />
          <Select
            aria-label="Sort order"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as ExpenseSort)}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {!page && !error && <LoadingNote label="Loading expenses…" />}

        {page && (
          <>
            {page.items.length === 0 ? (
              <EmptyState
                title="No expenses match these filters"
                description="Record your first expense to start building a picture of where your money goes."
                action={
                  <Link
                    href="/expenses/new"
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                  >
                    Add expense
                  </Link>
                }
              />
            ) : (
              <Table headers={["Date", "Description", "Category", "Amount", ""]}>
                {page.items.map((expense) => (
                  <tr key={expense.id} className="hover:bg-background/60">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm">
                      {formatDate(expense.incurredOn)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{expense.description ?? "—"}</p>
                      {expense.paymentMethod && (
                        <p className="text-xs text-muted">{expense.paymentMethod}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: expense.categoryColor }}
                        />
                        {expense.categoryName}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {formatMoney(expense.amount, expense.currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/expenses/${expense.id}/edit`}
                        className="mr-3 text-sm text-accent underline-offset-2 hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDelete(expense)}
                        disabled={busyId === expense.id}
                        className="text-sm text-danger underline-offset-2 hover:underline disabled:opacity-40"
                      >
                        {busyId === expense.id ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
            <Pagination
              page={page.page}
              total={page.total}
              limit={page.limit}
              onPage={setPageNumber}
            />
          </>
        )}
      </Card>
    </div>
  );
}
