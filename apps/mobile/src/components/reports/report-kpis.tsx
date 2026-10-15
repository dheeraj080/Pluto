/**
 * The Reports KPI card: one block answering "how much, how many, how much
 * each, and where".
 *
 * Every figure is driven by one comparison request for the range in force, so
 * the "vs previous N days" pills always compare like with like and can never
 * disagree with the totals they sit beside. The shared comparison note lives
 * once, in the card subtitle.
 */

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DualAmount } from '@/components/amount';
import { ChangePill } from '@/components/ui/change-pill';
import { ReportCard } from '@/components/reports/report-card';
import { fontFamily, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPercent } from '@/lib/format';
import type { ExpenseComparison } from '@/lib/report-types';

/** Percent change versus the previous window, or null when it is not meaningful. */
function pctChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return Number.isFinite(pct) ? pct : null;
}

/** A category's colour chip, matching the web's `CategorySwatch`. */
function Swatch({ color }: { color: string }) {
  return <View style={[styles.swatch, { backgroundColor: color }]} />;
}

/** The muted em dash that stands in for a figure that cannot be shown. */
function Dash() {
  const theme = useTheme();
  return <Text style={[styles.dash, { color: theme.muted }]}>—</Text>;
}

function Stat({
  label,
  percent,
  children,
}: {
  label: string;
  percent: number | null;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <Text style={[text.overline, { color: theme.muted }]} numberOfLines={1}>
          {label}
        </Text>
        {percent != null ? <ChangePill percent={percent} /> : null}
      </View>
      <View style={styles.statBody}>{children}</View>
    </View>
  );
}

export function ReportKpis({
  data,
  base,
  second,
  days,
  rangeLabel,
  loading,
  error,
  onRetry,
}: {
  data: ExpenseComparison | null;
  /** Primary currency. */
  base: string | null;
  /** Secondary currency, when one is paired. */
  second: string | null;
  /** Length of the window in days, for the "vs previous …" note. */
  days: number;
  /** The range every card is describing; shown in the card subtitle. */
  rangeLabel: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const theme = useTheme();

  const current = data?.current ?? null;
  const previous = data?.previous ?? null;
  const caption = `vs previous ${days} ${days === 1 ? 'day' : 'days'}`;
  const placeholder = loading && !data;
  const failed = Boolean(error) && !loading;

  const total = current?.total ?? null;
  const totalSecond = current?.secondaryTotal ?? null;
  const totalPct = pctChange(total, previous?.total ?? null);
  const average = current?.average ?? null;
  const averageSecond = current?.secondaryAverage ?? null;
  const averagePct = pctChange(average, previous?.average ?? null);
  const count = current?.count ?? null;
  const countPct = pctChange(count, previous?.count ?? null);

  const top = current?.byCategory?.[0] ?? null;
  const topPreviousTotal = top
    ? (previous?.byCategory.find((entry) => entry.categoryId === top.categoryId)?.total ?? null)
    : null;
  const topPct = top ? pctChange(top.total, topPreviousTotal) : null;

  return (
    <ReportCard
      title="Key figures"
      subtitle={`${rangeLabel} · ${caption}`}
      loading={placeholder}
      skeletonHeight={220}
      error={failed ? error : null}
      onRetry={onRetry}
    >
      <View style={styles.headline}>
        <View style={styles.headlineMain}>
          <Text style={[text.overline, { color: theme.muted }]}>Total spent</Text>
          <View style={styles.headlineValue}>
            {total !== null && base ? (
              <DualAmount
                amount={total}
                currency={base}
                secondaryAmount={totalSecond}
                secondaryCurrency={totalSecond != null ? second : null}
                size="hero"
                layout="inline"
              />
            ) : (
              <Dash />
            )}
          </View>
        </View>
        {totalPct != null ? <ChangePill percent={totalPct} /> : null}
      </View>

      <View style={[styles.divider, { borderColor: theme.border }]} />

      <View style={styles.stats}>
        <Stat label="Expenses" percent={countPct}>
          {count !== null ? (
            <Text style={[styles.count, { color: theme.ink }]}>{count}</Text>
          ) : (
            <Dash />
          )}
        </Stat>

        <Stat label="Average per expense" percent={averagePct}>
          {average !== null && base ? (
            <DualAmount
              amount={average}
              currency={base}
              secondaryAmount={averageSecond}
              secondaryCurrency={averageSecond != null ? second : null}
              size="md"
              layout="inline"
            />
          ) : (
            <Dash />
          )}
        </Stat>

        <Stat label="Top category" percent={topPct}>
          {top ? (
            <View style={styles.top}>
              <View style={styles.topName}>
                <Swatch color={top.color} />
                <Text style={[text.bodyMedium, styles.topLabel, { color: theme.ink }]} numberOfLines={1}>
                  {top.categoryName}
                </Text>
                <Text style={[text.caption, { color: theme.muted }]}>{formatPercent(top.percentage)}</Text>
              </View>
              {base ? (
                <DualAmount
                  amount={top.total}
                  currency={base}
                  secondaryAmount={top.secondaryTotal ?? null}
                  secondaryCurrency={top.secondaryTotal != null ? second : null}
                  size="md"
                  layout="inline"
                />
              ) : null}
            </View>
          ) : (
            <Dash />
          )}
        </Stat>
      </View>
    </ReportCard>
  );
}

const styles = StyleSheet.create({
  headline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  headlineMain: { gap: spacing.sm, flexShrink: 1 },
  headlineValue: { marginTop: spacing.xs },
  divider: {
    marginTop: spacing.xl,
    borderTopWidth: 1,
    paddingTop: spacing.xl,
  },
  stats: { gap: spacing.xl },
  stat: { gap: spacing.sm },
  statHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  statBody: { marginTop: spacing.xs },
  count: { fontFamily: fontFamily.sans.semibold, fontSize: 16, lineHeight: 20 },
  dash: { fontFamily: fontFamily.sans.regular, fontSize: 28, lineHeight: 32 },
  top: { gap: spacing.xs },
  topName: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  topLabel: { flexShrink: 1 },
  swatch: { width: 9, height: 9, borderRadius: radius.xs / 2 },
});
