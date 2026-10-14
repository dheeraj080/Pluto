/**
 * The expense dashboard.
 *
 * Built to answer six questions in about five seconds, in one column:
 *
 *  1. how much have I spent this month?          — the spending card
 *  2. am I on budget, and how much per day?      — the budget card
 *  3. faster or slower than last month?          — the comparison card
 *  4. what did I buy recently?                   — the recent card
 *  5. where is the money going?                  — the top-categories card
 *  6. what is today's rate, and what is X worth? — the rate & converter card
 *
 * The web lays these out in a 12-column grid whose `order-*` classes collapse to
 * exactly this sequence below the `lg` breakpoint, so the order is the web's own
 * phone order rather than a new decision.
 *
 * Every converted figure comes from the server aggregates; the per-row previews
 * are display-only, and a window that cannot be converted reads "—" rather than
 * zero.
 */

import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BudgetCard } from '@/components/dashboard/budget-card';
import { ComparisonCard } from '@/components/dashboard/comparison-card';
import { RateCard } from '@/components/dashboard/rate-card';
import { RecentCard } from '@/components/dashboard/recent-card';
import { SpendingCard } from '@/components/dashboard/spending-card';
import { TopCategoriesCard } from '@/components/dashboard/top-categories-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConversionNote } from '@/components/ui/conversion-note';
import { EmptyState } from '@/components/ui/feedback';
import { AppPageHeader } from '@/components/ui/page-header';
import { IconCalendar, IconPlus, IconRefresh } from '@/components/icons';
import { borderWidth, controlHeight, layout, radius, spacing, text } from '@/theme';
import { useBudgetStatus } from '@/hooks/use-budgets';
import { comparisonDeltaPct, useComparisonSeries, useMonthComparison } from '@/hooks/use-dashboard';
import { useExpenseList } from '@/hooks/use-expenses';
import { usePair } from '@/hooks/use-pair';
import { useRateHistory, useRateSnapshot } from '@/hooks/use-rates';
import { useTheme } from '@/hooks/use-theme';
import { formatDateRange, todayIso } from '@/lib/format';
import { isoDaysAgo, type CompareRange } from '@/lib/ranges';

/** Enough history for the rate line to say something; below this it is hidden. */
const RATE_HISTORY_DAYS = 30;

export default function DashboardScreen() {
  const theme = useTheme();
  const { base, second } = usePair();

  const month = useMonthComparison(base, second);
  const budgetStatus = useBudgetStatus({
    month: month.window.from.slice(0, 7),
    base: base ?? undefined,
    secondary: second ?? undefined,
  });
  const recent = useExpenseList({ sort: 'date_desc' });

  const [range, setRange] = useState<CompareRange>('month');
  const comparisonSeries = useComparisonSeries(range, base, second);

  const snapshot = useRateSnapshot(base);
  const history = useRateHistory({
    base,
    quote: second,
    from: isoDaysAgo(RATE_HISTORY_DAYS - 1),
    to: todayIso(),
  });

  const comparison = month.comparison;
  const summary = comparison?.current ?? null;
  // `base` is null only until a profile exists; the server's echoed currency is
  // the honest fallback, so no figure is ever shown in an invented currency.
  const baseCurrency = base ?? summary?.baseCurrency ?? snapshot.data?.baseCurrency ?? null;
  const delta = comparisonDeltaPct(comparison);
  const estimated = comparison?.rateProvenance?.policies?.includes('estimate') ?? false;

  // The overall budget is the one with no category; per-category limits live on
  // the Budgets screen.
  const budget = budgetStatus.data?.items.find((item) => item.categoryId == null) ?? null;

  const refreshing =
    month.loading || budgetStatus.isPending || recent.isRefetching || comparisonSeries.loading;

  const onRefresh = useCallback(() => {
    month.refetch();
    void budgetStatus.refetch();
    void recent.refetch();
    comparisonSeries.refetch();
    void history.refetch();
  }, [month, budgetStatus, recent, comparisonSeries, history]);

  // A brand-new account sees one friendly card, never a grid of empty charts.
  const isEmpty =
    !month.loading && summary !== null && summary.count === 0 && recent.items.length === 0;

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
      <AppPageHeader
        title="Dashboard"
        subtitle="Where your money went this month."
      >
        <View style={[styles.dateChip, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          <IconCalendar size={14} color={theme.muted} />
          <Text style={[text.captionMedium, { color: theme.muted }]}>
            {formatDateRange(month.window.from, month.window.to)}
          </Text>
        </View>

        <Button
          label="Add expense"
          icon={(color) => <IconPlus size={16} color={color} />}
          onPress={() => router.push('/expense/new')}
        />

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

      {comparison ? (
        <ConversionNote
          status={comparison.conversionStatus}
          unconvertedCurrencies={comparison.unconvertedCurrencies}
        />
      ) : null}

      {isEmpty ? (
        <Card>
          <EmptyState
            title="Add your first expense"
            message="Once you record a purchase, this dashboard shows what you spent, how it compares with last month, and where the money went."
          >
            <Button
              label="Add your first expense"
              icon={(color) => <IconPlus size={16} color={color} />}
              onPress={() => router.push('/expense/new')}
            />
          </EmptyState>
        </Card>
      ) : (
        <View style={styles.cards}>
          <SpendingCard
            summary={summary}
            second={second}
            delta={delta}
            loading={month.loading}
            error={month.error}
            onRetry={month.refetch}
          />

          <BudgetCard
            budget={budget}
            window={month.window}
            second={second}
            loading={budgetStatus.isPending}
            error={budgetStatus.isError ? 'Failed to load your budget.' : null}
            onRetry={() => void budgetStatus.refetch()}
          />

          <ComparisonCard
            rows={comparisonSeries.rows}
            range={range}
            onRangeChange={setRange}
            base={baseCurrency ?? ''}
            loading={comparisonSeries.loading}
            error={comparisonSeries.error}
            onRetry={comparisonSeries.refetch}
          />

          <RecentCard
            items={recent.items}
            loading={recent.isPending}
            error={recent.error ? 'Failed to load recent expenses.' : null}
            base={baseCurrency}
            second={second}
            snapshot={snapshot.data ?? null}
            estimated={estimated}
            onRetry={() => void recent.refetch()}
          />

          <TopCategoriesCard
            entries={summary?.byCategory ?? []}
            base={baseCurrency ?? ''}
            second={second}
            snapshot={snapshot.data ?? null}
            loading={month.loading}
          />

          <RateCard
            snapshot={snapshot.data ?? null}
            base={baseCurrency}
            second={second}
            history={history.data ?? null}
            loading={history.isPending}
          />
        </View>
      )}
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
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: controlHeight.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
  },
  refresh: {
    alignItems: 'center',
    justifyContent: 'center',
    width: controlHeight.sm,
    height: controlHeight.sm,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
  },
});
