/**
 * The expense dashboard.
 *
 * Built to answer the questions a person actually asks, in about five seconds:
 *
 *  1. how much have I spent this month, and am I on budget? — the month card
 *  2. what did I buy recently?                             — the recent card
 *  3. where is the money going?                            — the top categories card
 *  4. what is today's rate, and can I flip the pair?       — the pair card
 *
 * The deeper analysis — spending over time, the full category breakdown, the
 * weekday profile — belongs to the Reports tab, so the dashboard draws no
 * charts and does not repeat them. Each card is a full-width surface in one
 * column.
 *
 * Every converted figure comes from the server aggregates; the per-row previews
 * are display-only, and a window that cannot be converted reads "—" rather than
 * zero.
 */

import { useCallback } from 'react';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PairCard } from '@/components/dashboard/pair-card';
import { RecentCard } from '@/components/dashboard/recent-card';
import { ThisMonthCard } from '@/components/dashboard/this-month-card';
import { TopCategoriesCard } from '@/components/dashboard/top-categories-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConversionNote } from '@/components/ui/conversion-note';
import { EmptyState } from '@/components/ui/feedback';
import { AppPageHeader } from '@/components/ui/page-header';
import { IconAlert, IconCalendar, IconPlus } from '@/components/icons';
import { borderWidth, controlHeight, layout, radius, spacing, text } from '@/theme';
import { useBudgetStatus } from '@/hooks/use-budgets';
import { comparisonDeltaPct, useMonthComparison } from '@/hooks/use-dashboard';
import { useExpenseList } from '@/hooks/use-expenses';
import { usePair } from '@/hooks/use-pair';
import { useRateSnapshot } from '@/hooks/use-rates';
import { useScreenPadding } from '@/hooks/use-screen-padding';
import { useTheme } from '@/hooks/use-theme';
import { formatDateRange } from '@/lib/format';

export default function DashboardScreen({ navigation }: { navigation: { openDrawer: () => void } }) {
  const theme = useTheme();
  const screenPadding = useScreenPadding();
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

  // Per-category budgets over their limit this month. The dashboard points at
  // the Budgets screen rather than repeating every row here.
  const overCategoryCount =
    budgetStatus.data?.items.filter((item) => item.categoryId != null && item.overBudget)
      .length ?? 0;

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
      contentContainerStyle={[styles.content, screenPadding]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.accent}
          colors={[theme.accent]}
        />
      }
    >
      <AppPageHeader title="Dashboard" onOpenDrawer={() => navigation.openDrawer()}>
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

          {overCategoryCount > 0 ? <OverBudgetNudge count={overCategoryCount} /> : null}

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
            count={summary?.count ?? 0}
            loading={month.loading}
            base={baseCurrency}
            second={second}
            snapshot={snapshot.data ?? null}
            window={month.window}
          />

          <PairCard
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
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
  },
  nudgeText: { flex: 1 },
  nudgePressed: { opacity: 0.7 },
});

/**
 * The "a category is over budget" nudge.
 *
 * A single warning-toned line rather than a full card: the dashboard points at
 * the Budgets screen, where each over-limit row can be acted on.
 */
function OverBudgetNudge({ count }: { count: number }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${count} ${
        count === 1 ? 'category is' : 'categories are'
      } over budget. Open Budgets.`}
      onPress={() => router.push('/budgets')}
      style={({ pressed }) => [
        styles.nudge,
        { backgroundColor: theme.warningSubtle, borderColor: theme.warning },
        pressed && styles.nudgePressed,
      ]}
    >
      <IconAlert size={16} color={theme.warning} />
      <Text style={[text.bodyMedium, styles.nudgeText, { color: theme.ink }]}>
        {count} {count === 1 ? 'category is' : 'categories are'} over budget.
      </Text>
      <Text style={[text.captionMedium, { color: theme.primary }]}>Budgets →</Text>
    </Pressable>
  );
}
