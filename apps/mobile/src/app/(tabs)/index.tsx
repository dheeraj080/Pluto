/**
 * The expense dashboard.
 *
 * Built to answer the questions a person actually asks, in about five seconds:
 *
 *  1. how much have I spent this month, and am I on budget? — the month card
 *  2. what did I buy recently?                             — the recent card
 *  3. what is today's rate?                                — the rate line
 *
 * The deeper analysis — spending over time, the category breakdown, the weekday
 * profile — belongs to the Reports tab, so the dashboard draws no charts and
 * does not repeat them. Each card is a full-width surface in one column.
 *
 * Every converted figure comes from the server aggregates; the per-row previews
 * are display-only, and a window that cannot be converted reads "—" rather than
 * zero.
 */

import { useCallback } from 'react';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RateLine } from '@/components/dashboard/rate-line';
import { RecentCard } from '@/components/dashboard/recent-card';
import { ThisMonthCard } from '@/components/dashboard/this-month-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConversionNote } from '@/components/ui/conversion-note';
import { EmptyState } from '@/components/ui/feedback';
import { AppPageHeader } from '@/components/ui/page-header';
import { IconCalendar, IconPlus } from '@/components/icons';
import { borderWidth, controlHeight, layout, radius, spacing, text } from '@/theme';
import { useBudgetStatus } from '@/hooks/use-budgets';
import { comparisonDeltaPct, useMonthComparison } from '@/hooks/use-dashboard';
import { useExpenseList } from '@/hooks/use-expenses';
import { usePair } from '@/hooks/use-pair';
import { useRateSnapshot } from '@/hooks/use-rates';
import { useTheme } from '@/hooks/use-theme';
import { formatDateRange } from '@/lib/format';

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

  const snapshot = useRateSnapshot(base);

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

  const refreshing = month.loading || budgetStatus.isPending || recent.isRefetching;

  const onRefresh = useCallback(() => {
    month.refetch();
    void budgetStatus.refetch();
    void recent.refetch();
    void snapshot.refetch();
  }, [month, budgetStatus, recent, snapshot]);

  // A brand-new account sees one friendly card, never a grid of empty cards.
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
      <AppPageHeader title="Dashboard">
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
          <ThisMonthCard
            summary={summary}
            second={second}
            delta={delta}
            loading={month.loading}
            error={month.error}
            onRetry={month.refetch}
            budget={budget}
            window={month.window}
            budgetLoading={budgetStatus.isPending}
            budgetError={budgetStatus.isError ? 'Failed to load your budget.' : null}
            onBudgetRetry={() => void budgetStatus.refetch()}
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

          <RateLine
            base={baseCurrency}
            second={second}
            snapshot={snapshot.data ?? null}
            loading={snapshot.isPending}
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
});
