/**
 * "Recent transactions": the last few things bought.
 *
 * At most five rows, no inner scroll. Each row shows exactly two figures: the
 * amount as it was recorded, with the same amount in the home currency beneath
 * it (or the Second when the expense is already in home). The recorded amount is
 * never rewritten. When the month leaned on an estimated rate, one amber note in
 * the header says so instead of tagging every row.
 */

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Schemas } from '@pluto/api-client';

import { DualAmount } from '@/components/amount';
import { CardError, DashboardCard } from '@/components/dashboard/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { IconPlus } from '@/components/icons';
import { spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { recordedAmounts, type RateSnapshot } from '@/lib/convert';
import { formatDate } from '@/lib/format';
import { expenseHref } from '@/lib/routes';

const MAX_ROWS = 5;

export function RecentCard({
  items,
  loading,
  error,
  base,
  second,
  snapshot,
  estimated,
  onRetry,
}: {
  items: Schemas['ExpenseDto'][];
  loading: boolean;
  error: string | null;
  base: string | null;
  second: string | null;
  snapshot: RateSnapshot | null;
  /** True when any figure in the month used an estimated rate. */
  estimated: boolean;
  onRetry: () => void;
}) {
  const theme = useTheme();
  const rows = items.slice(0, MAX_ROWS);
  const isEmpty = !loading && !error && rows.length === 0;

  return (
    <DashboardCard
      title="Recent transactions"
      skeletonHeight={240}
      loading={loading && rows.length === 0}
      isEmpty={isEmpty}
      action={
        estimated ? (
          <View
            style={[styles.estimate, { backgroundColor: theme.warningSubtle }]}
            accessible
            accessibilityLabel="Some figures use estimated rates"
          >
            <Text style={[text.captionMedium, { color: theme.warning }]}>
              Includes estimated rates
            </Text>
          </View>
        ) : undefined
      }
      empty={
        <EmptyState
          title="No expenses yet"
          message="Record your first expense to start building a picture of where your money goes."
        >
          <Button
            label="Add your first expense"
            icon={(color) => <IconPlus size={16} color={color} />}
            onPress={() => router.push('/expense/new')}
          />
        </EmptyState>
      }
      footer={
        <Pressable hitSlop={8} onPress={() => router.push('/transactions')}>
          <Text style={[text.captionMedium, { color: theme.primary }]}>
            View all transactions
          </Text>
        </Pressable>
      }
    >
      {error ? (
        <CardError message={error} onRetry={onRetry} />
      ) : (
        <>
          {rows.map((expense) => (
            <Pressable
              key={expense.id}
              onPress={() => router.push(expenseHref(expense.id))}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.dot, { backgroundColor: expense.categoryColor }]} />

              <View style={styles.details}>
                <Text numberOfLines={1} style={[text.bodyStrong, { color: theme.ink }]}>
                  {expense.description?.trim() || expense.categoryName}
                </Text>
                <Text numberOfLines={1} style={[text.caption, { color: theme.muted }]}>
                  {expense.categoryName} · {formatDate(expense.incurredOn)}
                </Text>
              </View>

              <RowAmount expense={expense} home={base} second={second} snapshot={snapshot} />
            </Pressable>
          ))}
        </>
      )}
    </DashboardCard>
  );
}

/**
 * The two figures for one row: the amount as recorded, and its companion in the
 * home currency — or, when the expense was already recorded in home, the Second.
 *
 * The recorded currency always leads. A row whose rate is unavailable shows a
 * single value.
 */
function RowAmount({
  expense,
  home,
  second,
  snapshot,
}: {
  expense: Schemas['ExpenseDto'];
  /** Home currency the recorded amount is shown in beneath it. */
  home: string | null;
  /** Second currency, the companion when the expense is already in home. */
  second: string | null;
  snapshot: RateSnapshot | null;
}) {
  const amounts = recordedAmounts(expense.amount, expense.currency, home, snapshot, second);

  return (
    <DualAmount
      amount={amounts.amount}
      currency={amounts.currency}
      secondaryAmount={amounts.companionAmount}
      secondaryCurrency={amounts.companionCurrency}
      size="md"
      layout="stack"
      align="right"
    />
  );
}

const styles = StyleSheet.create({
  estimate: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  details: { flex: 1, gap: spacing.xs / 2 },
});
