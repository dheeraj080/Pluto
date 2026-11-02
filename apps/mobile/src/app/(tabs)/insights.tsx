/**
 * Insights.
 *
 * Merges the former Reports and Budgets destinations into one tab so the
 * bottom nav has room for a new component.
 *
 * Top-level toggle: **Reports** (spending over time, by category, by currency)
 * or **Budgets** (limits and month tracking). Each side keeps its own state
 * and queries, so nothing is lost from either screen.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useConfirm } from '@/components/ui/confirm';
import { ConversionNote } from '@/components/ui/conversion-note';
import { AppPageHeader } from '@/components/ui/page-header';
import { BottomNavBar, BAR_HEIGHT, FLOAT_GAP } from '@/components/ui/bottom-nav-bar';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Divider } from '@/components/ui/divider';
import { EmptyState, ErrorNote, Spinner } from '@/components/ui/feedback';
import { MonthStepper } from '@/components/ui/month-stepper';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { IconCalendar, IconChevronDown, IconPlus, IconRefresh } from '@/components/icons';
import { borderWidth, controlHeight, layout, radius, spacing, text } from '@/theme';
import { usePair } from '@/hooks/use-pair';
import { useRateSnapshot } from '@/hooks/use-rates';
import { useReportRange } from '@/hooks/use-report-range';
import {
  useReportByDayOfWeek,
  useReportComparison,
  useReportSeries,
} from '@/hooks/use-reports';
import { useBudgetStatus, useDeleteBudget, type BudgetStatus } from '@/hooks/use-budgets';
import { useScreenPadding } from '@/hooks/use-screen-padding';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import { shareExpensesCsv } from '@/lib/export';
import { queryKeys } from '@/lib/query-keys';
import { activityHref } from '@/lib/routes';
import { buildTrendRows, dayOfWeekRows } from '@/lib/report-utils';
import { currentMonth, formatMonth } from '@/lib/format';
import { monthEndIso, shiftMonth } from '@/lib/ranges';
import { ReportSummary } from '@/components/reports/report-summary';
import { ReportTrend, type TrendMode } from '@/components/reports/report-trend';
import { ReportCategories } from '@/components/reports/report-categories';
import { ReportPaidIn } from '@/components/reports/report-paid-in';
import { RatesNote } from '@/components/reports/report-card';
import { ReportRangeSheet } from '@/components/sheets/report-range-sheet';
import { BudgetRow } from '@/components/budgets/budget-row';
import { DashboardCard } from '@/components/dashboard/card';
import { BudgetSheet } from '@/components/sheets/budget-sheet';

type Side = 'reports' | 'budgets';

const SIDE_OPTIONS: { value: Side; label: string }[] = [
  { value: 'reports', label: 'Reports' },
  { value: 'budgets', label: 'Budgets' },
];

export default function InsightsScreen() {
  const theme = useTheme();
  const screenPadding = useScreenPadding();
  const { base, second } = usePair();
  const queryClient = useQueryClient();

  const [side, setSide] = useState<Side>('reports');

  // ---------------------------------------------------------------- Reports
  const { preset, range, granularity, rangeLabel, days, custom, applyPreset, applyCustom } =
    useReportRange();

  const [tab, setTab] = useState<'overview' | 'breakdown'>('overview');
  const [trendMode, setTrendMode] = useState<TrendMode>('overTime');
  const [compare, setCompare] = useState(true);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { confirm, sheet: confirmSheet } = useConfirm();

  const onOverview = tab === 'overview';
  const showOverTime = onOverview && trendMode === 'overTime';
  const showWeekday = onOverview && trendMode === 'weekday';

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
  const trendError = showWeekday
    ? dayOfWeek.isError
      ? errorMessage(dayOfWeek.error)
      : null
    : seriesError;
  const reloadTrend = useCallback(() => {
    if (showOverTime) {
      void seriesCurrent.refetch();
      if (compare) void seriesPrevious.refetch();
    } else if (showWeekday) {
      void dayOfWeek.refetch();
    }
  }, [showOverTime, showWeekday, compare, seriesCurrent, seriesPrevious, dayOfWeek]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
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

  // ---------------------------------------------------------------- Budgets
  const [month, setMonth] = useState(currentMonth());
  const [sheet, setSheet] = useState<{ target: BudgetStatus | null } | null>(null);

  const budgetStatus = useBudgetStatus({
    month,
    base: base ?? undefined,
    secondary: second ?? undefined,
  });
  const remove = useDeleteBudget();

  const budgetItems = budgetStatus.data?.items ?? [];
  const budgetBaseCurrency = budgetStatus.data?.baseCurrency ?? base ?? 'USD';
  const budgetSecondCurrency = budgetStatus.data?.secondaryCurrency ?? second;

  const overCount = budgetItems.filter((item) => item.overBudget).length;
  const budgetCountLine =
    budgetItems.length === 0
      ? null
      : `${budgetItems.length} ${
          budgetItems.length === 1 ? 'budget' : 'budgets'
        }${overCount > 0 ? ` · ${overCount} over budget` : ''}`;
  const budgetSubtitle = budgetCountLine ? `${formatMonth(month)} · ${budgetCountLine}` : formatMonth(month);

  const openCreateBudget = useCallback(() => setSheet({ target: null }), []);
  const openEditBudget = useCallback((item: BudgetStatus) => setSheet({ target: item }), []);
  const closeBudgetSheet = useCallback(() => setSheet(null), []);

  const openBudgetExpenses = useCallback(
    (item: BudgetStatus) => {
      router.push(
        activityHref({
          categoryId: item.categoryId ?? undefined,
          from: `${month}-01`,
          to: monthEndIso(month),
        }),
      );
    },
    [month],
  );

  const confirmDeleteBudget = useCallback(
    (item: BudgetStatus) => {
      const label = item.categoryName ?? 'all expenses';
      void confirm({
        title: `Delete the budget for ${label}?`,
        message: 'The expenses behind it are not affected.',
        confirmLabel: 'Delete',
      }).then((confirmed) => {
        if (confirmed) remove.mutate(item.budgetId);
      });
    },
    [confirm, remove],
  );

  const onRefreshBudgets = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
  }, [queryClient]);

  // ---------------------------------------------------------------- Render
  const refreshingAny = side === 'reports' ? refreshing : budgetStatus.isFetching;

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <View style={[styles.header, { paddingTop: screenPadding.paddingTop }]}>
        <AppPageHeader title="Insights">
          <SegmentedControl
            options={SIDE_OPTIONS}
            value={side}
            onChange={setSide}
            label="Insights side"
          />
        </AppPageHeader>

        {side === 'reports' ? (
          <View style={styles.controls}>
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

            <Button
              label="Export"
              variant="secondary"
              size="sm"
              busy={exporting}
              onPress={() => void onExport()}
            />
          </View>
        ) : (
          <View style={styles.budgetControls}>
            <MonthStepper
              label={formatMonth(month)}
              onPrevious={() => setMonth((value: string) => shiftMonth(value, -1))}
              onNext={() => setMonth((value: string) => shiftMonth(value, 1))}
            />
            <Button
              label="Add budget"
              size="sm"
              icon={(color) => <IconPlus size={16} color={color} />}
              onPress={openCreateBudget}
            />
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: screenPadding.paddingBottom + BAR_HEIGHT + FLOAT_GAP }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshingAny}
            onRefresh={side === 'reports' ? onRefresh : onRefreshBudgets}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
        }
      >
        {side === 'reports' ? (
          <>
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
          </>
        ) : (
          <>
            <ConversionNote
              status={budgetStatus.data?.conversionStatus}
              unconvertedCurrencies={budgetStatus.data?.unconvertedCurrencies ?? []}
            />
            {budgetStatus.isError ? (
              <ErrorNote message={errorMessage(budgetStatus.error) ?? 'Could not load budgets.'} />
            ) : null}

            <DashboardCard
              title="Progress"
              subtitle={budgetSubtitle}
              loading={budgetStatus.isPending}
              skeletonHeight={200}
              isEmpty={!budgetStatus.isError && budgetItems.length === 0}
              empty={
                <EmptyState
                  title="No budgets yet"
                  message="Add a budget to start tracking spending against a limit."
                >
                  <Button
                    label="Add budget"
                    size="sm"
                    icon={(color) => <IconPlus size={16} color={color} />}
                    onPress={openCreateBudget}
                  />
                </EmptyState>
              }
            >
              {budgetItems.map((item, index) => (
                <View key={item.budgetId}>
                  {index > 0 ? <Divider /> : null}
                  <BudgetRow
                    item={item}
                    baseCurrency={budgetBaseCurrency}
                    secondCurrency={budgetSecondCurrency}
                    onOpen={() => openBudgetExpenses(item)}
                    onEdit={() => openEditBudget(item)}
                    onRemove={() => confirmDeleteBudget(item)}
                    busy={remove.isPending && remove.variables === item.budgetId}
                  />
                </View>
              ))}
            </DashboardCard>

            {remove.isError ? (
              <ErrorNote message={errorMessage(remove.error) ?? 'Could not delete the budget.'} />
            ) : null}
          </>
        )}

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
        {sheet ? <BudgetSheet target={sheet.target} onClose={closeBudgetSheet} /> : null}
      </ScrollView>
      <BottomNavBar />
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
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  budgetControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
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
