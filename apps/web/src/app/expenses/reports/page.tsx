"use client";

/**
 * Reports.
 *
 * One range control in the header drives every card below, and every figure it
 * reports is compared with the equal-length window before it:
 *
 *  1. a KPI row (Total, Expenses, Average, Top category) in both currencies;
 *  2. which original currencies the money was paid in ("Paid in");
 *  3. "Spending over time", full width — the selected range as an emerald line
 *     with a soft gradient fill against the equal-length previous period in a
 *     dashed grey-blue line, bucketed daily / weekly / monthly to match the
 *     range;
 *  4. "Spending by day of week" (average per weekday) next to a one-line
 *     insight naming the busiest and quietest days;
 *  5. the category ranking.
 *
 * On phones the same five sections run in order 1–4 above with "Paid in"
 * moved to the end; on tablets the KPI tiles and the day-of-week pair share
 * two columns while the line chart, categories and Paid-in stay full width.
 *
 * Charts carry a data-table alternative for keyboard and screen-reader access,
 * and report "—" rather than zero wherever conversion is impossible.
 */

import { useEffect, useMemo, useState } from "react";
import { expensesApi } from "@/lib/expenses";
import { downloadTextFile } from "@/lib/download";
import { formatDateRange } from "@/lib/format";
import {
  diffDays,
  granularityFor,
  reportRange,
  type ReportPreset,
} from "@/lib/ranges";
import { Button, ErrorNote } from "@/components/ui";
import { AppPageHeader, PairSwitcher } from "@/components/app-page-header";
import { usePair, useRateSnapshot } from "../use-expenses";
import {
  useReportByDayOfWeek,
  useReportComparison,
  useReportSeriesComparison,
  useReportSummary,
} from "../use-reports";
import { ConversionAlert } from "../conversion-notice";
import { RangeControl } from "./range-control";
import { ReportKpis } from "./report-kpis";
import { ReportPaidIn } from "./report-paid-in";
import { RatesPill } from "./report-pills";
import { IconDownload } from "./report-icons";
import { SpendingOverTime, buildTrendRows } from "./spending-over-time";
import { DayOfWeekCard, DayOfWeekInsight, dayOfWeekRows } from "./report-day-of-week";
import { ReportCategories } from "./report-categories";

export default function ReportsPage() {
  const { base, second, swap } = usePair();
  const snapshot = useRateSnapshot();

  const [preset, setPreset] = useState<ReportPreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);

  /** The one range in force: every card below reads these same two bounds. */
  const range = useMemo(
    () => reportRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );
  const rangeLabel = useMemo(
    () => formatDateRange(range.from, range.to),
    [range.from, range.to],
  );

  /** Bucket size follows the range: days for ~a month, weeks through a quarter, months beyond. */
  const granularity = useMemo(
    () => granularityFor(range.from, range.to),
    [range.from, range.to],
  );

  const summary = useReportSummary({ ...range, base, secondary: second });
  const comparison = useReportComparison({
    from: range.from,
    to: range.to,
    base,
    secondary: second,
  });
  const series = useReportSeriesComparison({
    from: range.from,
    to: range.to,
    granularity,
    base,
    secondary: second,
  });
  const dow = useReportByDayOfWeek({ ...range, base, secondary: second });

  const effectiveBase =
    base ?? summary.data?.baseCurrency ?? snapshot?.baseCurrency ?? null;
  const effectiveSecond = second ?? summary.data?.secondaryCurrency ?? null;

  /* ------------------------ Spending over time ---------------------- */

  const seriesRows = buildTrendRows(series.current, series.previous);
  const estimated = series.current?.rateProvenance.policies.includes("estimate") ?? false;

  /* ------------------------ Day of week ----------------------------- */

  const dowRows = dayOfWeekRows(dow.data?.items ?? [], range.from, range.to);

  /* --------------------------- Actions ------------------------------ */

  /** Custom seeds from the range already on screen, so the window never jumps. */
  function selectPreset(next: ReportPreset) {
    if (next === "custom") {
      setCustomFrom((value) => value || range.from);
      setCustomTo((value) => value || range.to);
    }
    setPreset(next);
  }

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const csv = await expensesApi.exportCsv({
        from: range.from,
        to: range.to,
        base: base ?? undefined,
      });
      downloadTextFile(`expenses-${range.from}_${range.to}.csv`, csv);
      const rowCount = Math.max(
        0,
        csv.split(/\r?\n/).filter((line) => line.trim() !== "").length - 1,
      );
      setExportToast(
        `Exported ${rowCount} ${rowCount === 1 ? "expense" : "expenses"} to CSV for ${rangeLabel}.`,
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export expenses.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-12">
      <AppPageHeader
        title="Reports"
        className="md:col-span-2 lg:col-span-12"
        dateRange={
          <RangeControl
            preset={preset}
            from={range.from}
            to={range.to}
            customFrom={customFrom}
            customTo={customTo}
            onPreset={selectPreset}
            onCustomFrom={setCustomFrom}
            onCustomTo={setCustomTo}
          />
        }
        info={
          <RatesPill
            provenance={summary.data?.rateProvenance}
            fallbackDate={snapshot?.effectiveDate}
          />
        }
        pair={<PairSwitcher base={base} second={second} onSwap={swap} />}
        actions={
          <Button variant="secondary" size="sm" onClick={exportCsv} loading={exporting}>
            {!exporting && <IconDownload className="h-4 w-4" />}
            Export CSV
          </Button>
        }
      />

      {(exportError || summary.error || summary.data) && (
        <div className="space-y-3 md:col-span-2 lg:col-span-12">
          {exportError && <ErrorNote message={exportError} />}
          {summary.error && <ErrorNote message={summary.error} />}
          {summary.data && (
            <ConversionAlert
              status={summary.data.conversionStatus}
              unconvertedCurrencies={summary.data.unconvertedCurrencies}
            />
          )}
        </div>
      )}

      {/* KPIs — one comparison request drives all four tiles. order-1 on phones
          so the range control (header) is followed by the figures. */}
      <ReportKpis
        data={comparison.data}
        base={effectiveBase}
        second={effectiveSecond}
        days={diffDays(range.from, range.to) + 1}
        rangeLabel={rangeLabel}
        loading={comparison.loading}
        error={comparison.error}
        onRetry={comparison.reload}
        className="order-1 md:col-span-2 lg:order-none lg:col-span-12"
      />

      {/* Spending over time — full width, daily/weekly/monthly buckets */}
      <SpendingOverTime
        rows={seriesRows}
        granularity={granularity}
        base={effectiveBase}
        second={effectiveSecond}
        snapshot={snapshot}
        estimated={estimated}
        rangeLabel={rangeLabel}
        loading={series.loading}
        error={series.error}
        onRetry={series.reload}
        className="order-2 md:col-span-2 lg:order-none lg:col-span-12"
      />

      {/* Day of week + one-line insight */}
      <div className="order-3 grid grid-cols-1 gap-6 md:col-span-2 md:grid-cols-2 lg:order-none lg:col-span-12">
        <DayOfWeekCard
          rows={dowRows}
          base={effectiveBase}
          second={effectiveSecond}
          rangeLabel={rangeLabel}
          loading={dow.loading}
          error={dow.error}
          onRetry={dow.reload}
        />
        <DayOfWeekInsight
          rows={dowRows}
          base={effectiveBase}
          rangeLabel={rangeLabel}
          loading={dow.loading}
          error={dow.error}
          onRetry={dow.reload}
        />
      </div>

      {/* Categories — donut / stacked area + ranked list, one 12-col grid */}
      <ReportCategories
        from={range.from}
        to={range.to}
        granularity={granularity}
        rangeLabel={rangeLabel}
        categories={summary.data?.byCategory ?? []}
        count={summary.data?.count ?? 0}
        total={summary.data?.total ?? null}
        secondaryTotal={summary.data?.secondaryTotal ?? null}
        base={effectiveBase}
        second={effectiveSecond}
        snapshot={snapshot}
        loading={summary.loading}
        error={summary.data ? null : summary.error}
        onRetry={summary.reload}
        className="order-4 md:col-span-2 lg:order-none lg:col-span-12"
      />

      {/* Paid in — the original currencies behind the KPI total. Last on
          phones and tablets, directly under the KPIs on desktop. */}
      <ReportPaidIn
        rangeLabel={rangeLabel}
        currencies={summary.data?.byCurrency ?? []}
        total={summary.data?.total ?? null}
        base={effectiveBase}
        loading={summary.loading}
        error={summary.data ? null : summary.error}
        onRetry={summary.reload}
        className="order-5 md:col-span-2 lg:order-none lg:col-span-12"
      />

      <ExportToast message={exportToast} onClose={() => setExportToast(null)} />
    </div>
  );
}

/** A one-line confirmation after a successful CSV export; auto-dismisses. */
function ExportToast({
  message,
  onClose,
}: {
  message: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3 shadow-2xl">
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 8.5l3.5 3.5L13 4.5" />
          </svg>
        </span>
        <p className="text-sm text-ink">{message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}