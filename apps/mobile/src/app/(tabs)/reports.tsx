/**
 * Reports.
 *
 * Two fixed tabs over one range:
 *
 *  - **Overview** — a dense Summary block (total, count, average, top
 *    category, each against the equal-length window before it) and one Trend
 *    card that reads the range either over time or by weekday.
 *  - **Breakdown** — where the money went: the category share/over-time block
 *    and the original currencies it was paid in.
 *
 * Every figure comes from a single `GET /expenses/comparison`, whose `current`
 * summary already carries the per-category and per-currency breakdowns, so the
 * two tabs can never disagree with each other or with the "vs previous" pills.
 * The heavier charts are fetched lazily — a hidden tab, or a chart view the user
 * has not opened, fires no request.
 *
 * The range control lives in the header and opens a sheet; the header (range,
 * tabs, compare and export) stays put while the cards scroll beneath it.
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useConfirm } from '@/components/ui/confirm';
import { ConversionNote } from '@/components/ui/conversion-note';
import { AppPageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { IconCalendar, IconChevronDown, IconRefresh } from '@/components/icons';
import { ReportSummary } from '@/components/reports/report-summary';
import { ReportTrend, type TrendMode } from '@/components/reports/report-trend';
import { ReportCategories } from '@/components/reports/report-categories';
import { ReportPaidIn } from '@/components/reports/report-paid-in';
import { RatesNote } from '@/components/reports/report-card';
import { ReportRangeSheet } from '@/components/sheets/report-range-sheet';
import { borderWidth, controlHeight, layout, radius, spacing, text } from '@/theme';
import { usePair } from '@/hooks/use-pair';
import { useRateSnapshot } from '@/hooks/use-rates';
import { useReportRange } from '@/hooks/use-report-range';
import {
  useReportByDayOfWeek,
  useReportComparison,
  useReportSeries,
} from '@/hooks/use-reports';
import { useScreenPadding } from '@/hooks/use-screen-padding';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { shareExpensesCsv } from '@/lib/export';
import { queryKeys } from '@/lib/query-keys';
import { activityHref } from '@/lib/routes';
import { buildTrendRows, dayOfWeekRows } from '@/lib/report-utils';

type Tab = 'overview' | 'breakdown';

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'breakdown', label: 'Breakdown' },
];

export default function ReportsScreen() {
  const theme = useTheme();
  const screenPadding = useScreenPadding('tab');
  const { base, second } = usePair();
  const queryClient = useQueryClient();

  const { preset, range, granularity, rangeLabel, days, custom, applyPreset, applyCustom } =
    useReportRange();

  const [tab, setTab] = useState<Tab>('overview');
  const [trendMode, setTrendMode] = useState<TrendMode>('overTime');
  const [compare, setCompare] = useState(true);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { confirm, sheet: confirmSheet } = useConfirm();

  const onOverview = tab === 'overview';
  const showOverTime = onOverview && trendMode === 'overTime';
  const showWeekday = onOverview && trendMode === 'weekday';

  // The anchor request: the Overview's figures and the Breakdown's categories
  // and currencies all read from its `current` summary.
  const comparison = useReportComparison({ from: range.from, to: range.to, base, secondary: second });

  const seriesCurrent = useReportSeries({
    from: range.from,
    to: range.to,
    base,
    secondary: second,
    granularity,
    enabled: showOverTime,
  });
  const seriesPrevious = useReportSeries({
    from: range.prevFrom,
    to: range.prevTo,
    base,
    secondary: second,
    granularity,
    enabled: showOverTime && compare,
  });
  const dayOfWeek = useReportByDayOfWeek({
    from: range.from,
    to: range.to,
    base,
    secondary: second,
    enabled: showWeekday,
  });
  const snapshot = useRateSnapshot(base);

  // `base` is null only until a profile exists; the server's echoed currency is
  // the honest fallback, so no figure is ever shown in an invented currency.
  const baseCurrency =
    base ?? comparison.data?.baseCurrency ?? snapshot.data?.baseCurrency ?? null;

  const trendRows = useMemo(
    () => buildTrendRows(seriesCurrent.data?.points ?? [], seriesPrevious.data?.points ?? []),
    [seriesCurrent.data, seriesPrevious.data],
  );
  const dowRows = useMemo(
    () => dayOfWeekRows(dayOfWeek.data?.items ?? [], range.from, range.to),
    [dayOfWeek.data, range.from, range.to],
  );

  const comparisonError = comparison.isError ? errorMessage(comparison.error) : null;
  const seriesError = seriesCurrent.isError
    ? errorMessage(seriesCurrent.error)
    : seriesPrevious.isError
      ? errorMessage(seriesPrevious.error)
      : null;
  const trendLoading = showOverTime
    ? seriesCurrent.isPending || (compare && seriesPrevious.isPending)
    : dayOfWeek.isPending;
  const trendError = showWeekday ? (dayOfWeek.isError ? errorMessage(dayOfWeek.error) : null) : seriesError;
  const reloadTrend = useCallback(() => {
    if (showOverTime) {
      void seriesCurrent.refetch();
      if (compare) void seriesPrevious.refetch();
    } else if (showWeekday) {
      void dayOfWeek.refetch();
    }
  }, [showOverTime, showWeekday, compare, seriesCurrent, seriesPrevious, dayOfWeek]);

  // Pull-to-refresh reflects the *user's* refresh, not every background
  // refetch: a range change or a focus refetch must not pop the spinner.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Invalidating the whole group also refreshes the Breakdown's lazily-loaded
    // category series, which the screen does not own directly.
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
      snapshot.refetch(),
    ]).finally(() => setRefreshing(false));
  }, [queryClient, snapshot]);

  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      const shared = await shareExpensesCsv({
        from: range.from,
        to: range.to,
        base: baseCurrency,
      });
      if (!shared) {
        void confirm({
          title: 'Export',
          message: 'Sharing is not available on this device.',
          confirmLabel: 'OK',
          tone: 'primary',
          cancelable: false,
        });
      }
    } catch (error) {
      void confirm({
        title: 'Export failed',
        message: errorMessage(error) ?? 'Could not export this range.',
        confirmLabel: 'OK',
        tone: 'primary',
        cancelable: false,
      });
    } finally {
      setExporting(false);
    }
  }, [range.from, range.to, baseCurrency, confirm]);

  const openCategory = useCallback(
    (categoryId: string) => router.push(activityHref({ categoryId, from: range.from, to: range.to })),
    [range.from, range.to],
  );
  const openCurrency = useCallback(
    (currency: string) => router.push(activityHref({ currency, from: range.from, to: range.to })),
    [range.from, range.to],
  );

  const provenance = comparison.data?.rateProvenance ?? null;

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { paddingTop: screenPadding.paddingTop }]}>
        <AppPageHeader title="Reports">
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

        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Date range: ${rangeLabel}`}
            onPress={() => setRangeOpen(true)}
            style={({ pressed }) => [
              styles.range,
              {
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <IconCalendar size={16} color={theme.muted} />
            <Text style={[text.bodyMedium, styles.rangeLabel, { color: theme.ink }]} numberOfLines={1}>
              {rangeLabel}
            </Text>
            <IconChevronDown size={16} color={theme.muted} />
          </Pressable>

          <Chip label="Compare" selected={compare} onPress={() => setCompare((value) => !value)} />
        </View>

        <View style={styles.tabsRow}>
          <SegmentedControl options={TAB_OPTIONS} value={tab} onChange={setTab} label="Report view" />
          <Button
            label="Export"
            variant="secondary"
            size="sm"
            busy={exporting}
            onPress={() => void onExport()}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: screenPadding.paddingBottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        <RatesNote provenance={provenance} fallbackDate={snapshot.data?.effectiveDate ?? null} />

        {comparison.data ? (
          <ConversionNote
            status={comparison.data.conversionStatus}
            unconvertedCurrencies={comparison.data.unconvertedCurrencies}
          />
        ) : null}

        <View style={styles.cards}>
          {onOverview ? (
            <>
              <ReportSummary
                data={comparison.data ?? null}
                base={baseCurrency}
                second={second}
                days={days}
                rangeLabel={rangeLabel}
                compare={compare}
                loading={comparison.isPending}
                error={comparisonError}
                onRetry={() => void comparison.refetch()}
                onOpenCategory={openCategory}
              />

              <ReportTrend
                mode={trendMode}
                onModeChange={setTrendMode}
                compare={compare}
                rows={trendRows}
                dowRows={dowRows}
                granularity={granularity}
                base={baseCurrency}
                second={second}
                rangeLabel={rangeLabel}
                loading={trendLoading}
                error={trendError}
                onRetry={reloadTrend}
              />
            </>
          ) : (
            <>
              <ReportCategories
                from={range.from}
                to={range.to}
                granularity={granularity}
                rangeLabel={rangeLabel}
                categories={comparison.data?.current.byCategory ?? []}
                count={comparison.data?.current.count ?? 0}
                total={comparison.data?.current.total ?? null}
                secondaryTotal={comparison.data?.current.secondaryTotal ?? null}
                base={baseCurrency}
                second={second}
                loading={comparison.isPending}
                error={comparisonError}
                onRetry={() => void comparison.refetch()}
                onOpenCategory={openCategory}
              />

              <ReportPaidIn
                rangeLabel={rangeLabel}
                currencies={comparison.data?.current.byCurrency ?? []}
                total={comparison.data?.current.total ?? null}
                base={baseCurrency}
                loading={comparison.isPending}
                error={comparisonError}
                onRetry={() => void comparison.refetch()}
                onOpenCurrency={openCurrency}
              />
            </>
          )}
        </View>
      </ScrollView>

      {rangeOpen ? (
        <ReportRangeSheet
          visible
          onClose={() => setRangeOpen(false)}
          preset={preset}
          customFrom={custom.from}
          customTo={custom.to}
          onApplyPreset={applyPreset}
          onApplyCustom={applyCustom}
        />
      ) : null}

      {confirmSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  range: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: controlHeight.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
  },
  rangeLabel: { flex: 1 },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  refresh: {
    alignItems: 'center',
    justifyContent: 'center',
    width: controlHeight.lg,
    height: controlHeight.lg,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
  },
  scroll: { flex: 1 },
  content: {
    padding: layout.gutter,
    paddingTop: 0,
    gap: spacing.lg,
  },
  cards: { gap: spacing.lg },
});
