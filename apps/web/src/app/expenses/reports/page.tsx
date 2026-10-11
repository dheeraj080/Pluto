"use client";

/**
 * Reports: period summary, monthly trend, and category breakdown.
 *
 * Charts are only rendered when the server could convert into the base
 * currency. When conversion is completely impossible (no rate snapshot) the
 * summary returns null totals, and plotting those as zeroes would invent data
 * — so the charts are replaced by an explanatory banner and the native
 * per-currency subtotals. Partially converted payloads still chart the
 * converted rows, with a notice naming the excluded currencies.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { expensesApi } from "@/lib/expenses";
import { downloadTextFile } from "@/lib/download";
import { formatMoney, formatMonth, formatPercent } from "@/lib/format";
import type { ByDayOfWeekResponse, ExpenseSummary, ExpenseTrend } from "@/lib/types";
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Input,
  LoadingNote,
  PageHeader,
  Select,
  StatCard,
} from "@/components/ui";
import { useBaseCurrency, useExpenseSetup } from "../use-expenses";
import { ConversionNotice } from "../conversion-notice";

/** Months of history drawn alongside the selected summary range. */
const TREND_MONTHS = 12;

/** Y-axis ticks are plain numbers; the currency symbol lives in the tooltip. */
function axisTick(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : String(value);
}

/**
 * Recharts' Tooltip `formatter` value is `number | string | Array<...> | undefined`.
 * This series is scalar, but the union still has to be normalised before it can
 * be formatted as money.
 */
function toNumber(value: unknown): number {
  if (Array.isArray(value)) return Number(value[0] ?? 0);
  return Number(value ?? 0);
}

/** Inclusive day bounds for a `YYYY-MM` month, for drilling into that month. */
function monthRangeIso(month: string): { from: string; to: string } {
  const [year, monthIndex] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export default function ReportsPage() {
  const { currencies, error: setupError } = useExpenseSetup();
  const { base, setBase } = useBaseCurrency();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const router = useRouter();
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [trend, setTrend] = useState<ExpenseTrend | null>(null);
  const [dow, setDow] = useState<ByDayOfWeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [summaryResult, trendResult, dowResult] = await Promise.all([
        expensesApi.getSummary({
          from: from || undefined,
          to: to || undefined,
          base: base ?? undefined,
        }),
        expensesApi.getTrends({ months: TREND_MONTHS, base: base ?? undefined }),
        expensesApi.getByDayOfWeek({
          from: from || undefined,
          to: to || undefined,
          base: base ?? undefined,
        }),
      ]);
      setSummary(summaryResult);
      setTrend(trendResult);
      setDow(dowResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the report.");
    } finally {
      setLoading(false);
    }
  }, [base, from, to]);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const csv = await expensesApi.exportCsv({
        from: from || undefined,
        to: to || undefined,
        base: base ?? undefined,
      });
      downloadTextFile(`expenses-${from || "all"}_${to || "now"}.csv`, csv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export expenses.");
    } finally {
      setExporting(false);
    }
  }, [base, from, to]);

  const drillDown = useCallback(
    (params: { categoryId?: string; from?: string; to?: string }) => {
      const search = new URLSearchParams();
      if (params.categoryId) search.set("categoryId", params.categoryId);
      if (params.from) search.set("from", params.from);
      if (params.to) search.set("to", params.to);
      router.push(`/expenses?${search.toString()}`);
    },
    [router],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const summaryStatus = summary?.conversionStatus;
  const trendStatus = trend?.conversionStatus;
  /**
   * Charts need real totals in both the summary and the trend series. When
   * either is `unavailable` they have null points and plotting zeroes would
   * invent data; `partially_converted` still charts the converted rows and
   * the notice below names the exclusions.
   */
  const chartable =
    Boolean(summary && trend) &&
    summaryStatus !== "unavailable" &&
    trendStatus !== "unavailable";
  const topCategory = summary?.byCategory[0];

  const trendData =
    trend?.points.map((point) => ({
      month: formatMonth(point.month),
      rawMonth: point.month,
      total: point.total ?? 0,
    })) ?? [];

  const dowData =
    dow?.items.map((item) => ({
      label: item.label,
      total: item.total,
      average: item.average,
    })) ?? [];

  const pieData =
    summary?.byCategory.map((entry) => ({
      name: entry.categoryName,
      value: entry.total,
      color: entry.color,
      categoryId: entry.categoryId,
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={
          summary
            ? `Figures converted into ${summary.baseCurrency}`
            : "Spending over time, by category and currency."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label="From date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-40"
            />
            <Input
              type="date"
              aria-label="To date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-40"
            />
            <Select
              aria-label="Base currency"
              value={base ?? ""}
              onChange={(event) => setBase(event.target.value)}
              className="w-28"
            >
              <option value="">Default</option>
              {currencies.map((entry) => (
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
              disabled={!summary || summary.count === 0}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      {setupError && <ErrorNote message={setupError} />}
      {error && <ErrorNote message={error} />}
      {loading && <LoadingNote label="Building report…" />}

      {summary && summaryStatus === "unavailable" && (
        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <p>
            Exchange rates are unavailable, so spending cannot be combined across currencies.
            Totals and charts are hidden rather than estimated; per-currency subtotals are listed
            below.
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.byCurrency.map((entry) => (
              <span
                key={entry.currency}
                className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs font-medium"
              >
                {entry.currency} {formatMoney(entry.total, entry.currency)} · {entry.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {summary && chartable && (
        <>
          <ConversionNotice
            status={summaryStatus}
            unconvertedCurrencies={summary?.unconvertedCurrencies}
            provenance={summary?.rateProvenance}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={`Total (${summary.baseCurrency})`}
              value={
                summary.total === null ? "—" : formatMoney(summary.total, summary.baseCurrency)
              }
            />
            <StatCard label="Expenses" value={summary.count} />
            <StatCard
              label="Average"
              value={
                summary.average === null
                  ? "—"
                  : formatMoney(summary.average, summary.baseCurrency)
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

          <Card title={`Spending, last ${TREND_MONTHS} months`}>
            {summary.count === 0 && trendData.every((point) => point.total === 0) ? (
              <EmptyState
                title="Nothing to chart yet"
                description="No expenses fall inside this range. Widen the dates or record a few expenses first."
              />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                      tickLine={false}
                    />
                    <YAxis tickFormatter={axisTick} tick={{ fontSize: 11 }} width={44} />
                    <Tooltip
                      formatter={(value) => [
                        formatMoney(toNumber(value), summary.baseCurrency),
                        "Spent",
                      ]}
                    />
                    <Bar
                      dataKey="total"
                      fill="var(--accent)"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(data) => {
                        const point = data as { rawMonth?: string } | undefined;
                        if (point?.rawMonth) drillDown(monthRangeIso(point.rawMonth));
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-2 text-xs text-muted">Select a bar to see that month&apos;s expenses.</p>
          </Card>

          <Card title="Spending by day of week">
            {dowData.every((entry) => entry.total === 0) ? (
              <EmptyState title="No day-of-week data" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dowData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tickFormatter={axisTick} tick={{ fontSize: 11 }} width={44} />
                    <Tooltip
                      formatter={(value) => [
                        formatMoney(toNumber(value), dow?.baseCurrency ?? summary.baseCurrency),
                        "Spent",
                      ]}
                    />
                    <Bar dataKey="total" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="By category">
              {pieData.length === 0 ? (
                <EmptyState title="No category data" />
              ) : (
                <>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={1}
                          className="cursor-pointer"
                          onClick={(entry) => {
                            const point = entry as { payload?: { categoryId?: string } } | null;
                            const categoryId = point?.payload?.categoryId;
                            if (categoryId) {
                              drillDown({ categoryId, from: from || undefined, to: to || undefined });
                            }
                          }}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [
                            formatMoney(toNumber(value), summary.baseCurrency),
                            "Spent",
                          ]}
                        />
                        <Legend
                          formatter={(value: string) => (
                            <span className="text-xs text-muted">{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {summary.byCategory.map((entry) => (
                      <li key={entry.categoryId}>
                        <button
                          type="button"
                          onClick={() =>
                            drillDown({
                              categoryId: entry.categoryId,
                              from: from || undefined,
                              to: to || undefined,
                            })
                          }
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-muted"
                        >
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden
                              className="inline-block size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="truncate">{entry.categoryName}</span>
                            <span className="shrink-0 text-muted">×{entry.count}</span>
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {formatMoney(entry.total, summary.baseCurrency)}
                            <span className="ml-2 text-muted">
                              {formatPercent(entry.percentage)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card title="By currency">
              <ul className="space-y-3">
                {summary.byCurrency.map((entry) => (
                  <li
                    key={entry.currency}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="font-medium">{entry.currency}</span>
                      <span className="text-muted">{entry.count} expense(s)</span>
                    </span>
                    <span className="tabular-nums font-medium">
                      {formatMoney(entry.total, entry.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted">
                Native amounts as recorded. Converted totals are combined across these currencies
                into {summary.baseCurrency}.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
