"use client";

/**
 * Transactions: the full, filterable expense list.
 *
 * Split out of the dashboard so the dashboard can stay a summary. The selected
 * period drives both the list and the "top expenses" panel, and the reporting
 * currency drives the display-only "≈" figures. Deep links from Reports carry
 * `?categoryId` / `?from` / `?to` so a chart element can open a pre-filtered
 * list.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { expensesApi, type ExpenseSort } from "@/lib/expenses";
import { formatDate } from "@/lib/format";
import { buildConversionPreview } from "@/lib/convert";
import { periodRange, type Period } from "@/lib/ranges";
import type {
  Expense,
  ExpenseCategory,
  ExpenseSummary,
  Paginated,
  TopExpensesResponse,
} from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Input,
  Money,
  PageHeader,
  Pagination,
  SegmentedControl,
  Select,
  Table,
  TableSkeleton,
} from "@/components/ui";
import { ConfirmDialog } from "@/components/dialog";
import { downloadTextFile } from "@/lib/download";
import { IconPlus, IconReceipt, IconSearch } from "@/components/icons";
import { useBaseCurrency, useExpenseSetup, useRateSnapshot } from "../use-expenses";
import { ConversionNotice } from "../conversion-notice";

const SORTS: { value: ExpenseSort; label: string }[] = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "amount_desc", label: "Highest amount" },
  { value: "amount_asc", label: "Lowest amount" },
];

const PERIODS = [
  { value: "month", label: "This month" },
  { value: "30d", label: "30 days" },
  { value: "year", label: "This year" },
  { value: "all", label: "All" },
  { value: "custom", label: "Custom" },
];

const LIMIT = 10;

export default function TransactionsPage() {
  const { categories, currencies, error: setupError } = useExpenseSetup();
  const { base, setBase } = useBaseCurrency();
  const snapshot = useRateSnapshot();

  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [list, setList] = useState<Paginated<Expense> | null>(null);
  const [top, setTop] = useState<TopExpensesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [currency, setCurrency] = useState("");
  const [sort, setSort] = useState<ExpenseSort>("date_desc");
  const [pageNumber, setPageNumber] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const range = useMemo(
    () => periodRange(period as Period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const load = useCallback(async () => {
    setError(null);
    const baseParam = base ?? undefined;
    try {
      const [summaryResult, listResult, topResult] = await Promise.all([
        expensesApi.getSummary({ from: range.from, to: range.to, base: baseParam }),
        expensesApi.listExpenses({
          page: pageNumber,
          limit: LIMIT,
          categoryId: categoryId || undefined,
          currency: currency || undefined,
          from: range.from,
          to: range.to,
          search: search || undefined,
          sort,
        }),
        expensesApi.getTop({ from: range.from, to: range.to, limit: 5, base: baseParam }),
      ]);
      setSummary(summaryResult);
      setList(listResult);
      setTop(topResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load expenses.");
    }
  }, [base, categoryId, currency, pageNumber, range, search, sort]);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const csv = await expensesApi.exportCsv({
        from: range.from,
        to: range.to,
        categoryId: categoryId || undefined,
        currency: currency || undefined,
        search: search || undefined,
        base: base ?? undefined,
      });
      downloadTextFile(`expenses-${range.from}_${range.to}.csv`, csv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export expenses.");
    } finally {
      setExporting(false);
    }
  }, [base, categoryId, currency, range, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const urlCategory = params.get("categoryId");
      const urlFrom = params.get("from");
      const urlTo = params.get("to");
      if (urlCategory) setCategoryId(urlCategory);
      if (urlFrom || urlTo) {
        setPeriod("custom");
        if (urlFrom) setCustomFrom(urlFrom);
        if (urlTo) setCustomTo(urlTo);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPageNumber(1);
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryId("");
    setCurrency("");
    setPageNumber(1);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await expensesApi.deleteExpense(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete the expense.");
    } finally {
      setDeleting(false);
    }
  };

  const effectiveBase = base ?? summary?.baseCurrency ?? null;
  const hasFilters = Boolean(search || categoryId || currency);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description={
          summary
            ? `${formatDate(range.from)} – ${formatDate(range.to)} · ${summary.count} ${
                summary.count === 1 ? "expense" : "expenses"
              }`
            : "Every expense, filterable by period."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="tx-base-currency" className="text-sm text-muted">
              Reporting
            </label>
            <Select
              id="tx-base-currency"
              aria-label="Reporting currency"
              value={base ?? ""}
              onChange={(event) => setBase(event.target.value)}
              className="w-32"
            >
              <option value="">{summary?.baseCurrency ?? "Default"}</option>
              {currencies
                .filter((entry) => entry.code !== summary?.baseCurrency)
                .map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.code}
                  </option>
                ))}
            </Select>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void exportCsv()}
              loading={exporting}
              disabled={!list || list.total === 0}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {setupError && <ErrorNote message={setupError} />}
      {error && <ErrorNote message={error} />}

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          options={PERIODS}
          value={period}
          onChange={resetPage(setPeriod)}
          label="Reporting period"
        />
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label="From date"
              value={customFrom}
              onChange={(event) => resetPage(setCustomFrom)(event.target.value)}
              className="w-40"
            />
            <span className="text-sm text-muted">to</span>
            <Input
              type="date"
              aria-label="To date"
              value={customTo}
              onChange={(event) => resetPage(setCustomTo)(event.target.value)}
              className="w-40"
            />
          </div>
        )}
      </div>

      {summary && (
        <ConversionNotice
          status={summary.conversionStatus}
          unconvertedCurrencies={summary.unconvertedCurrencies}
          provenance={summary.rateProvenance}
        />
      )}

      <Card
        title="All expenses"
        action={
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <IconSearch
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              placeholder="Search description…"
              aria-label="Search description"
              value={search}
              onChange={(event) => resetPage(setSearch)(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            aria-label="Filter by category"
            value={categoryId}
            onChange={(event) => resetPage(setCategoryId)(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category: ExpenseCategory) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by currency"
            value={currency}
            onChange={(event) => resetPage(setCurrency)(event.target.value)}
          >
            <option value="">All currencies</option>
            {currencies.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.code}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Sort order"
            value={sort}
            onChange={(event) => resetPage(setSort)(event.target.value as ExpenseSort)}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {!list && !error && <TableSkeleton rows={4} cols={4} />}

        {list && (
          <>
            {list.items.length === 0 ? (
              hasFilters ? (
                <EmptyState
                  icon={<IconSearch className="h-5 w-5" />}
                  title="No expenses match these filters"
                  description="Try a different search, category or currency."
                  action={
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<IconReceipt className="h-5 w-5" />}
                  title="No expenses yet"
                  description="Record your first expense to start building a picture of where your money goes."
                  action={
                    <Link
                      href="/expenses/new"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
                    >
                      <IconPlus className="h-4 w-4" />
                      Add expense
                    </Link>
                  }
                />
              )
            ) : (
              <Table headers={["Date", "Description", "Category", "Amount", ""]}>
                {list.items.map((expense) => {
                  const converted =
                    effectiveBase && effectiveBase !== expense.currency && snapshot
                      ? buildConversionPreview(expense.amount, expense.currency, effectiveBase, snapshot)
                      : null;
                  return (
                    <tr key={expense.id} className="transition-colors hover:bg-surface-muted/60">
                      <td className="whitespace-nowrap px-5 py-3 text-sm text-muted">
                        {formatDate(expense.incurredOn)}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/expenses/${expense.id}`}
                          className="font-medium text-ink underline-offset-2 hover:text-primary hover:underline"
                        >
                          {expense.description ?? "—"}
                        </Link>
                        {expense.paymentMethod && (
                          <p className="text-xs text-muted">{expense.paymentMethod}</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2 text-sm text-ink">
                          <span
                            aria-hidden="true"
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: expense.categoryColor }}
                          />
                          {expense.categoryName}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <span className="font-medium tabular-nums text-ink">
                          <Money amount={expense.amount} currency={expense.currency} />
                        </span>
                        {converted && (
                          <span className="block text-xs text-muted">
                            ≈ <Money amount={converted.amount} currency={converted.to} />
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <Link
                          href={`/expenses/${expense.id}/edit`}
                          className="mr-3 text-sm font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(expense)}
                          className="text-sm font-medium text-danger underline-offset-2 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </Table>
            )}
            <Pagination
              page={list.page}
              total={list.total}
              limit={list.limit}
              onPage={setPageNumber}
            />
          </>
        )}
      </Card>

      {top && top.items.length > 0 && summary && (
        <Card title="Top expenses">
          <ul className="space-y-2.5">
            {top.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/expenses/${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-muted"
                >
                  <span className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {item.description || item.categoryName || "Expense"}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(item.incurredOn)}
                      {item.categoryName ? ` · ${item.categoryName}` : ""}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5">
                      {item.ratePolicy === "estimate" && (
                        <Badge tone="gold" className="text-[10px]">
                          estimate
                        </Badge>
                      )}
                      {item.conversionStatus === "unavailable" && (
                        <Badge tone="warn" className="text-[10px]">
                          unconverted · {item.currency}
                        </Badge>
                      )}
                    </p>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block tabular-nums font-medium text-ink">
                      <Money
                        amount={item.amount ?? item.amountNative}
                        currency={
                          item.amount !== null && item.amount !== undefined
                            ? summary.baseCurrency
                            : item.currency
                        }
                      />
                    </span>
                    {item.amount !== null &&
                      item.amount !== undefined &&
                      item.currency !== summary.baseCurrency && (
                        <span className="block text-xs text-muted">
                          {item.currency} {item.amountNative.toFixed(2)}
                        </span>
                      )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this expense?"
        message={
          deleteTarget
            ? `“${deleteTarget.description ?? deleteTarget.categoryName}” will be permanently removed. This can't be undone.`
            : ""
        }
        confirmLabel="Delete expense"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
