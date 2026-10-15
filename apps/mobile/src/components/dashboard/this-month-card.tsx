/**
 * "This month": the headline card.
 *
 * Two questions in one surface — how much has the month cost, and how much is
 * left to spend. The month-to-date total leads in the Pair, a fair "vs the same
 * days last month" pill sits beside it, the supporting figures (count, average)
 * tuck under a hairline divider, and the whole-account budget follows in a
 * second section with the per-day allowance the user actually acts on.
 *
 * This merges the former spending and budget cards, so the dashboard's most
 * important answers share one frame instead of two. The deeper analysis —
 * spending over time, the category breakdown — belongs to the Reports tab, so
 * this card draws no charts.
 */

import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Schemas } from '@pluto/api-client';

import { DualAmount, InlineAmounts } from '@/components/amount';
import { CardError, DashboardCard } from '@/components/dashboard/card';
import { Button } from '@/components/ui/button';
import { ChangePill } from '@/components/ui/change-pill';
import { IconTarget } from '@/components/icons';
import { borderWidth, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { summaryAmounts } from '@/lib/convert';
import { formatPercent } from '@/lib/format';
import type { MonthWindow } from '@/lib/ranges';
import type { ExpenseSummary } from '@/lib/report-types';

export function ThisMonthCard({
  summary,
  second,
  delta,
  loading,
  error,
  onRetry,
  budget,
  window,
  budgetLoading,
  budgetError,
  onBudgetRetry,
}: {
  summary: ExpenseSummary | null;
  /** Second currency, when the user has chosen a pair. */
  second: string | null;
  /** Percent change against the same days of last month. */
  delta: number | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** The whole-account budget — the one whose `categoryId` is null. */
  budget: Schemas['BudgetStatusDto'] | null;
  window: MonthWindow;
  budgetLoading: boolean;
  budgetError: string | null;
  onBudgetRetry: () => void;
}) {
  const theme = useTheme();

  const currency = summary?.baseCurrency ?? null;
  const total = summary?.converted ? (summary.total ?? null) : null;
  // Totals lead with the Second and show the Home equivalent beneath, the same
  // order as every other figure in the app.
  const totalPair = summaryAmounts(total, currency, summary?.secondaryTotal, second);
  const averagePair = summaryAmounts(summary?.average, currency, summary?.secondaryAverage, second);
  // One skeleton covers both queries, so the budget section never flashes an
  // invitation before its own request has answered.
  const skeleton = (loading && !summary) || (budgetLoading && !budget);

  return (
    <DashboardCard glow title="This month" loading={skeleton} skeletonHeight={220}>
      {error && !summary ? (
        <CardError message={error} onRetry={onRetry} />
      ) : (
        <>
          {totalPair ? (
            <DualAmount {...totalPair} size="display" layout="inline" />
          ) : (
            <Text style={[text.amountHero, { color: theme.muted }]}>—</Text>
          )}

          {delta != null ? <ChangePill percent={delta} caption="vs last month" /> : null}

          <View style={[styles.stats, { borderTopColor: theme.border }]}>
            <Stat label="Expenses">
              <Text style={[text.bodyMedium, { color: theme.ink }]}>
                {summary ? String(summary.count) : '—'}
              </Text>
            </Stat>

            <Stat label="Average">
              {averagePair ? (
                <DualAmount {...averagePair} size="sm" layout="stack" />
              ) : (
                <Text style={[text.bodyMedium, { color: theme.muted }]}>—</Text>
              )}
            </Stat>
          </View>
        </>
      )}

      <BudgetSection
        budget={budget}
        window={window}
        second={second}
        error={budgetError}
        onRetry={onBudgetRetry}
      />
    </DashboardCard>
  );
}

/**
 * The "left to spend" half of the card.
 *
 * With no budget it invites one instead of drawing an empty bar; with a budget
 * it shows the remaining balance, the share used and a per-day allowance for
 * the rest of the month.
 */
function BudgetSection({
  budget,
  window,
  second,
  error,
  onRetry,
}: {
  budget: Schemas['BudgetStatusDto'] | null;
  window: MonthWindow;
  second: string | null;
  error: string | null;
  onRetry: () => void;
}) {
  const theme = useTheme();

  if (error && !budget) {
    return (
      <View style={[styles.section, { borderTopColor: theme.border }]}>
        <BudgetHeading />
        <CardError message={error} onRetry={onRetry} />
      </View>
    );
  }

  if (!budget) {
    return (
      <View style={[styles.section, { borderTopColor: theme.border }]}>
        <BudgetHeading />
        <Text style={[text.body, { color: theme.muted }]}>
          Set a monthly budget to see what is left to spend and a per-day allowance.
        </Text>
        <Button
          label="Set a monthly budget"
          variant="secondary"
          size="sm"
          icon={(color) => <IconTarget size={16} color={color} />}
          onPress={() => router.push('/budgets')}
        />
      </View>
    );
  }

  const currency = budget.convertedCurrency ?? budget.currency ?? null;

  if (!budget.applied) {
    return (
      <View style={[styles.section, { borderTopColor: theme.border }]}>
        <BudgetHeading />
        <Text style={[text.body, { color: theme.muted }]}>
          This budget has not started yet.
        </Text>
      </View>
    );
  }

  if (budget.convertedAmount == null || !currency) {
    return (
      <View style={[styles.section, { borderTopColor: theme.border }]}>
        <BudgetHeading />
        <Text style={[text.body, { color: theme.muted }]}>
          The budget target could not be converted, so a balance cannot be shown.
        </Text>
      </View>
    );
  }

  const percentage = Math.min(100, Math.max(0, budget.percentage));
  const remainingPair = summaryAmounts(
    budget.remaining,
    currency,
    budget.secondaryRemaining,
    second,
  );

  return (
    <View style={[styles.section, { borderTopColor: theme.border }]}>
      <BudgetHeading />
      {remainingPair ? (
        <DualAmount
          {...remainingPair}
          size="lg"
          layout="inline"
          tone={budget.overBudget ? 'warning' : 'ink'}
        />
      ) : null}

      {/*
        Two children rather than a percentage width: React Native's
        `DimensionValue` will not take a computed string, and the ratio is what
        matters, not the pixels.
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

      <Text style={[text.body, { color: theme.muted }]}>
        <Text style={[text.body, { color: theme.ink }]}>{formatPercent(budget.percentage)}</Text>{' '}
        of{' '}
        <InlineAmounts
          homeAmount={budget.budgetAmount}
          homeCurrency={currency}
          secondAmount={budget.secondaryBudgetAmount}
          secondCurrency={second}
          textStyle={text.body}
        />{' '}
        used
      </Text>

      <Text style={[text.body, { color: theme.muted }]}>
        {budget.overBudget ? (
          <>
            Over budget by{' '}
            <InlineAmounts
              homeAmount={Math.abs(budget.remaining)}
              homeCurrency={currency}
              secondAmount={
                budget.secondaryRemaining != null ? Math.abs(budget.secondaryRemaining) : null
              }
              secondCurrency={second}
              textStyle={text.body}
              primaryColor={theme.warning}
            />
            .
          </>
        ) : window.daysLeft > 0 ? (
          <>
            About{' '}
            <InlineAmounts
              homeAmount={budget.remaining / window.daysLeft}
              homeCurrency={currency}
              secondAmount={
                budget.secondaryRemaining != null
                  ? budget.secondaryRemaining / window.daysLeft
                  : null
              }
              secondCurrency={second}
              textStyle={text.body}
            />{' '}
            per day for the next {window.daysLeft} {window.daysLeft === 1 ? 'day' : 'days'}.
          </>
        ) : (
          'The month is over.'
        )}
      </Text>
    </View>
  );
}

/** The section label, with the link through to the Budgets screen. */
function BudgetHeading() {
  const theme = useTheme();

  return (
    <View style={styles.budgetHead}>
      <Text style={[text.overline, { color: theme.muted }]}>Budget</Text>
      <Pressable hitSlop={8} onPress={() => router.push('/budgets')}>
        <Text style={[text.captionMedium, { color: theme.primary }]}>Budgets →</Text>
      </Pressable>
    </View>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={styles.stat}>
      <Text style={[text.overline, { color: theme.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: borderWidth.hairline,
  },
  stat: { flex: 1, gap: spacing.xs },
  section: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: borderWidth.hairline,
    gap: spacing.sm,
  },
  budgetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  track: {
    flexDirection: 'row',
    height: 4,
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { borderRadius: radius.pill },
});
