/**
 * "Left to spend": the whole-account budget against the current month.
 *
 * A thin progress line, the share used, and — the part people actually act on —
 * a per-day allowance for the rest of the month. With no budget it invites one
 * instead of showing an empty bar.
 *
 * The whole-account budget is the one whose `categoryId` is null; per-category
 * limits belong to the Budgets screen.
 */

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Schemas } from '@pluto/api-client';

import { DualAmount } from '@/components/amount';
import { CardError, DashboardCard } from '@/components/dashboard/card';
import { Button } from '@/components/ui/button';
import { IconTarget } from '@/components/icons';
import { radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney, formatPercent } from '@/lib/format';
import type { MonthWindow } from '@/lib/ranges';

export function BudgetCard({
  budget,
  window,
  second,
  loading,
  error,
  onRetry,
}: {
  budget: Schemas['BudgetStatusDto'] | null;
  window: MonthWindow;
  second: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const theme = useTheme();

  const currency = budget?.convertedCurrency ?? budget?.currency ?? null;
  const percentage = budget ? Math.min(100, Math.max(0, budget.percentage)) : 0;

  return (
    <DashboardCard
      title="Left to spend"
      skeletonHeight={128}
      loading={loading && !budget}
      action={
        <Pressable hitSlop={8} onPress={() => router.push('/budgets')}>
          <Text style={[text.captionMedium, { color: theme.primary }]}>Budgets →</Text>
        </Pressable>
      }
    >
      {error && !budget ? (
        <CardError message={error} onRetry={onRetry} />
      ) : !budget ? (
        <View style={styles.invite}>
          <Text style={[text.body, { color: theme.muted }]}>
            Set a monthly budget to see what is left to spend and a per-day allowance.
          </Text>
          <Button
            label="Set a monthly budget"
            variant="secondary"
            icon={(color) => <IconTarget size={16} color={color} />}
            onPress={() => router.push('/budgets')}
          />
        </View>
      ) : !budget.applied ? (
        <Text style={[text.body, { color: theme.muted }]}>
          This budget has not started yet.
        </Text>
      ) : budget.convertedAmount == null || !currency ? (
        <Text style={[text.body, { color: theme.muted }]}>
          The budget target could not be converted, so a balance cannot be shown.
        </Text>
      ) : (
        <>
          <DualAmount
            amount={budget.remaining}
            currency={currency}
            secondaryAmount={budget.secondaryRemaining ?? null}
            secondaryCurrency={budget.secondaryRemaining != null ? second : null}
            size="lg"
            layout="inline"
            tone={budget.overBudget ? 'warning' : 'ink'}
          />

          {/*
            Two children rather than a percentage width: React Native's
            `DimensionValue` will not take a computed string, and the ratio is
            what matters, not the pixels.
          */}
          <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
            <View
              style={[
                styles.fill,
                {
                  flexGrow: percentage,
                  backgroundColor: budget.overBudget ? theme.warning : theme.primary,
                },
              ]}
            />
            <View style={{ flexGrow: 100 - percentage }} />
          </View>

          <Text style={[text.body, styles.line, { color: theme.muted }]}>
            <Text style={[text.body, { color: theme.ink }]}>
              {formatPercent(budget.percentage)}
            </Text>{' '}
            of <Text style={text.body}>{formatMoney(budget.budgetAmount, currency)}</Text> used
          </Text>

          <Text style={[text.body, { color: theme.muted }]}>
            {budget.overBudget ? (
              <>
                Over budget by{' '}
                <Text style={[text.body, { color: theme.warning }]}>
                  {formatMoney(Math.abs(budget.remaining), currency)}
                </Text>
                .
              </>
            ) : window.daysLeft > 0 ? (
              <>
                About{' '}
                <Text style={[text.body, { color: theme.ink }]}>
                  {formatMoney(budget.remaining / window.daysLeft, currency)}
                </Text>{' '}
                per day for the next {window.daysLeft} {window.daysLeft === 1 ? 'day' : 'days'}.
              </>
            ) : (
              'The month is over.'
            )}
          </Text>
        </>
      )}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  invite: { alignItems: 'flex-start', gap: spacing.md },
  track: {
    flexDirection: 'row',
    height: 4,
    marginTop: spacing.lg,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { borderRadius: radius.pill },
  line: { marginTop: spacing.sm },
});
