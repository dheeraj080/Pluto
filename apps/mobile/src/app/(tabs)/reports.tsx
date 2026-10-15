/**
 * Reports.
 *
 * One range control in the header drives every card below, and every figure it
 * reports is compared with the equal-length window before it:
 *
 *  1. a KPI card (Total, Expenses, Average, Top category) in both currencies;
 *  2. "Spending over time" — the selected range as an emerald line with a soft
 *     gradient fill against the equal-length previous period, bucketed daily /
 *     weekly / monthly to match the range;
 *  3. "Spending by day of week" (average per weekday) beside a one-line insight
 *     naming the busiest and quietest days;
 *  4. the category share donut (or its over-time alternative) and ranking;
 *  5. which original currencies the money was paid in ("Paid in").
 *
 * Every converted figure comes from the server aggregates; the range's own rate
 * provenance is named under the header so "as of" is never a guess.
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ConversionNote } from '@/components/ui/conversion-note';
import { AppPageHeader } from '@/components/ui/page-header';
import { IconRefresh } from '@/components/icons';
import { ReportRangeControl } from '@/components/reports/range-control';
import { ReportKpis } from '@/components/reports/report-kpis';
import { RatesNote } from '@/components/reports/report-card';
import { SpendingOverTime } from '@/components/reports/spending-over-time';
import { DayOfWeekCard, DayOfWeekInsight } from '@/components/reports/day-of-week';
import { ReportCategories } from '@/components/reports/categories';
import { ReportPaidIn } from '@/components/reports/paid-in';
import { borderWidth, controlHeight, layout, radius, spacing } from '@/theme';
import { usePair } from '@/hooks/use-pair';
import { useRateSnapshot } from '@/hooks/use-rates';
import {
  useReportByDayOfWeek,
  useReportComparison,
  useReportSeries,
  useReportSummary,
} from '@/hooks/use-reports';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { formatDateRange, isValidIsoDate } from '@/lib/format';
import { diffDays, granularityFor, reportRange, type ReportPreset } from '@/lib/ranges';
import { buildTrendRows, dayOfWeekRows } from '@/lib/report-utils';

export default function ReportsScreen() {
  const theme = useTheme();
  const { base, second } = usePair();

  const [preset, setPreset] = useState<ReportPreset>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const fromValid = !customFrom || isValidIsoDate(customFrom);
  const toValid = !customTo || isValidIsoDate(customTo);
  const effectiveFrom = isValidIsoDate(customFrom) ? customFrom : '';
  const effectiveTo = isValidIsoDate(customTo) ? customTo : '';

  const range = useMemo(
    () => reportRange(preset, effectiveFrom, effectiveTo),
    [preset, effectiveFrom, effectiveTo],
  );
  const granularity = useMemo(() => granularityFor(range.from, range.to), [range.from, range.to]);
  const rangeLabel = formatDateRange(range.from, range.to);
  const days = diffDays(range.from, range.to) + 1;

  const selectPreset = useCallback(
    (next: ReportPreset) => {
      if (next === 'custom') {
        setCustomFrom((value) => value || range.from);
        setCustomTo((value) => value || range.to);
      }
      setPreset(next);
    },
    [range.from, range.to],
  );

  const summary = useReportSummary({ from: range.from, to: range.to, base, secondary: second });
  const comparison = useReportComparison({ from: range.from, to: range.to, base, secondary: second });
  const seriesCurrent = useReportSeries({
    from: range.from,
    to: range.to,
    base,
    secondary: second,
    granularity,
  });
  const seriesPrevious = useReportSeries({
    from: range.prevFrom,
    to: range.prevTo,
    base,
    secondary: second,
    granularity,
  });
  const dayOfWeek = useReportByDayOfWeek({ from: range.from, to: range.to, base, secondary: second });
  const snapshot = useRateSnapshot(base);

  // `base` is null only until a profile exists; the server's echoed currency is
  // the honest fallback, so no figure is ever shown in an invented currency.
  const baseCurrency = base ?? summary.data?.baseCurrency ?? snapshot.data?.baseCurrency ?? null;

  const trendRows = useMemo(
    () => buildTrendRows(seriesCurrent.data?.points ?? [], seriesPrevious.data?.points ?? []),
    [seriesCurrent.data, seriesPrevious.data],
  );
  const dowRows = useMemo(
    () => dayOfWeekRows(dayOfWeek.data?.items ?? [], range.from, range.to),
    [dayOfWeek.data, range.from, range.to],
  );

  const summaryError = summary.isError ? errorMessage(summary.error) : null;
  const comparisonError = comparison.isError ? errorMessage(comparison.error) : null;
  const dowError = dayOfWeek.isError ? errorMessage(dayOfWeek.error) : null;
  const seriesError = seriesCurrent.isError
    ? errorMessage(seriesCurrent.error)
    : seriesPrevious.isError
      ? errorMessage(seriesPrevious.error)
      : null;
  const seriesLoading = seriesCurrent.isPending || seriesPrevious.isPending;

  const refreshing =
    summary.isFetching ||
    comparison.isFetching ||
    seriesCurrent.isFetching ||
    seriesPrevious.isFetching ||
    dayOfWeek.isFetching;

  const onRefresh = useCallback(() => {
    void summary.refetch();
    void comparison.refetch();
    void seriesCurrent.refetch();
    void seriesPrevious.refetch();
    void dayOfWeek.refetch();
    void snapshot.refetch();
  }, [summary, comparison, seriesCurrent, seriesPrevious, dayOfWeek, snapshot]);

  const reloadSeries = useCallback(() => {
    void seriesCurrent.refetch();
    void seriesPrevious.refetch();
  }, [seriesCurrent, seriesPrevious]);

  const provenance = summary.data?.rateProvenance ?? comparison.data?.rateProvenance ?? null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.accent}
          colors={[theme.accent]}
        />
      }
    >
      <AppPageHeader title="Reports" subtitle="Where your money goes, over any period.">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          onPress={onRefresh}
          disabled={refreshing}
          style={({ pressed }) => [
            styles.refresh,
            {
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              opacity: refreshing ? 0.45 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <IconRefresh size={16} color={theme.ink} />
        </Pressable>
      </AppPageHeader>

      <ReportRangeControl
        preset={preset}
        rangeLabel={rangeLabel}
        customFrom={customFrom}
        customTo={customTo}
        fromError={fromValid ? undefined : 'Enter a date like 2026-10-01'}
        toError={toValid ? undefined : 'Enter a date like 2026-10-01'}
        onSelectPreset={selectPreset}
        onCustomFrom={setCustomFrom}
        onCustomTo={setCustomTo}
      />

      <RatesNote provenance={provenance} fallbackDate={snapshot.data?.effectiveDate ?? null} />

      {summary.data ? (
        <ConversionNote
          status={summary.data.conversionStatus}
          unconvertedCurrencies={summary.data.unconvertedCurrencies}
        />
      ) : null}

      <View style={styles.cards}>
        <ReportKpis
          data={comparison.data ?? null}
          base={baseCurrency}
          second={second}
          days={days}
          rangeLabel={rangeLabel}
          loading={comparison.isPending}
          error={comparisonError}
          onRetry={() => void comparison.refetch()}
        />

        <SpendingOverTime
          rows={trendRows}
          granularity={granularity}
          base={baseCurrency}
          second={second}
          rangeLabel={rangeLabel}
          loading={seriesLoading}
          error={seriesError}
          onRetry={reloadSeries}
        />

        <DayOfWeekCard
          rows={dowRows}
          base={baseCurrency}
          second={second}
          rangeLabel={rangeLabel}
          loading={dayOfWeek.isPending}
          error={dowError}
          onRetry={() => void dayOfWeek.refetch()}
        />

        <DayOfWeekInsight
          rows={dowRows}
          base={baseCurrency}
          second={second}
          rangeLabel={rangeLabel}
          loading={dayOfWeek.isPending}
          error={dowError}
          onRetry={() => void dayOfWeek.refetch()}
        />

        <ReportCategories
          from={range.from}
          to={range.to}
          granularity={granularity}
          rangeLabel={rangeLabel}
          categories={summary.data?.byCategory ?? []}
          count={summary.data?.count ?? 0}
          total={summary.data?.total ?? null}
          secondaryTotal={summary.data?.secondaryTotal ?? null}
          base={baseCurrency}
          second={second}
          loading={summary.isPending}
          error={summaryError}
          onRetry={() => void summary.refetch()}
        />

        <ReportPaidIn
          rangeLabel={rangeLabel}
          currencies={summary.data?.byCurrency ?? []}
          total={summary.data?.total ?? null}
          base={baseCurrency}
          loading={summary.isPending}
          error={summaryError}
          onRetry={() => void summary.refetch()}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: layout.gutter,
    paddingBottom: layout.tabBarInset + spacing.xl,
    gap: spacing.lg,
  },
  cards: { gap: spacing.lg },
  refresh: {
    alignItems: 'center',
    justifyContent: 'center',
    width: controlHeight.sm,
    height: controlHeight.sm,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
  },
});
