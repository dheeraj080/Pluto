/**
 * The headline card: what the user spent this month.
 *
 * One number answers the first question in five seconds — the month-to-date
 * total in the Pair — with a fair "vs same days last month" pill beside it and
 * the supporting figures tucked under a hairline divider rather than in cards
 * of their own.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DualAmount } from '@/components/amount';
import { CardError, DashboardCard } from '@/components/dashboard/card';
import { ChangePill } from '@/components/ui/change-pill';
import { borderWidth, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ExpenseSummary } from '@/lib/report-types';

export function SpendingCard({
  summary,
  second,
  delta,
  loading,
  error,
  onRetry,
}: {
  summary: ExpenseSummary | null;
  /** Second currency, when the user has chosen a pair. */
  second: string | null;
  /** Percent change against the same days of last month. */
  delta: number | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const theme = useTheme();

  const currency = summary?.baseCurrency ?? null;
  const total = summary?.converted ? (summary.total ?? null) : null;

  return (
    <DashboardCard
      glow
      title="Spent this month"
      loading={loading && !summary}
      skeletonHeight={128}
    >
      {error && !summary ? (
        <CardError message={error} onRetry={onRetry} />
      ) : (
        <>
          {!currency ? (
            <Text style={[text.amountHero, { color: theme.muted }]}>—</Text>
          ) : total == null ? (
            <Text style={[text.amountHero, { color: theme.muted }]}>—</Text>
          ) : (
            <DualAmount
              amount={total}
              currency={currency}
              secondaryAmount={summary?.secondaryTotal ?? null}
              secondaryCurrency={summary?.secondaryTotal != null ? second : null}
              size="display"
              layout="inline"
            />
          )}

          {delta != null ? <ChangePill percent={delta} caption="vs last month" /> : null}

          <View style={[styles.stats, { borderTopColor: theme.border }]}>
            <Stat label="Expenses">
              <Text style={[text.bodyMedium, { color: theme.ink }]}>
                {summary ? String(summary.count) : '—'}
              </Text>
            </Stat>

            <Stat label="Average">
              {summary?.average == null || !currency ? (
                <Text style={[text.bodyMedium, { color: theme.muted }]}>—</Text>
              ) : (
                <DualAmount
                  amount={summary.average}
                  currency={currency}
                  secondaryAmount={summary.secondaryAverage ?? null}
                  secondaryCurrency={summary.secondaryAverage != null ? second : null}
                  size="sm"
                  layout="stack"
                />
              )}
            </Stat>
          </View>
        </>
      )}
    </DashboardCard>
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
});
