/**
 * The Overview's Summary block: the range's headline figures in one card.
 *
 * One `GET /expenses/comparison` drives every figure here, so the hero total,
 * the per-expense average and the "vs previous" pills can never disagree about
 * the window or the rate snapshot. The `compare` prop only decides whether the
 * pills are shown; the figures themselves are the same either way.
 *
 * Figures are laid out *stacked* — a label (with its change pill) above the
 * value — rather than label-left/value-right: an amount in two currencies is
 * wide, and the stacked form cannot be squeezed off a phone. The top category
 * is tappable, the fastest route from "where did it go" to the matching rows.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DualAmount } from '@/components/amount';
import { ChangePill } from '@/components/ui/change-pill';
import { ReportCard } from '@/components/reports/report-card';
import { IconArrowRight } from '@/components/icons';
import { fontFamily, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { summaryAmounts } from '@/lib/convert';
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

/** The muted em dash that stands in for a figure that cannot be shown. */
function Dash() {
  const theme = useTheme();
  return <Text style={[styles.dash, { color: theme.muted }]}>—</Text>;
}

/** A label with its change pill, above a value. */
function Stat({
  label,
  percent,
  compare,
  children,
}: {
  label: string;
  percent: number | null;
  compare: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <Text style={[text.overline, { color: theme.muted }]} numberOfLines={1}>
          {label}
        </Text>
        {compare && percent != null ? <ChangePill percent={percent} /> : null}
      </View>
      <View style={styles.statBody}>{children}</View>
    </View>
  );
}

export function ReportSummary({
  data,
  base,
  second,
  days,
  rangeLabel,
  compare,
  loading,
  error,
  onRetry,
  onOpenCategory,
}: {
  data: ExpenseComparison | null;
  /** Home currency. */
  base: string | null;
  /** Second (non-home) currency, when one is paired. */
  second: string | null;
  /** Length of the window in days, for the "vs previous …" note. */
  days: number;
  rangeLabel: string;
  /** Whether the "vs previous" pills are shown. */
  compare: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** Open the Activity list filtered to one category. */
  onOpenCategory: (categoryId: string) => void;
}) {
  const theme = useTheme();

  const current = data?.current ?? null;
  const previous = data?.previous ?? null;
  const placeholder = loading && !data;
  const failed = Boolean(error) && !loading;

  const total = current?.total ?? null;
  const average = current?.average ?? null;
  const count = current?.count ?? null;
  const top = current?.byCategory?.[0] ?? null;

  const totalPct = pctChange(total, previous?.total ?? null);
  const averagePct = pctChange(average, previous?.average ?? null);
  const countPct = pctChange(count, previous?.count ?? null);
  const topPct = top
    ? pctChange(
        top.total,
        previous?.byCategory.find((entry) => entry.categoryId === top.categoryId)?.total ?? null,
      )
    : null;

  // Every total leads with the Second and shows the Home equivalent beneath.
  const totalPair = summaryAmounts(total, base, current?.secondaryTotal ?? null, second);
  const averagePair = summaryAmounts(average, base, current?.secondaryAverage ?? null, second);
  const topPair = top ? summaryAmounts(top.total, base, top.secondaryTotal, second) : null;

  const caption = `vs previous ${days} ${days === 1 ? 'day' : 'days'}`;

  return (
    <ReportCard
      title="Summary"
      subtitle={compare ? `${rangeLabel} · ${caption}` : rangeLabel}
      loading={placeholder}
      skeletonHeight={220}
      error={failed ? error : null}
      onRetry={onRetry}
    >
      <View style={styles.headline}>
        <View style={styles.headlineMain}>
          <Text style={[text.overline, { color: theme.muted }]}>Total spent</Text>
          <View style={styles.headlineValue}>
            {totalPair ? <DualAmount {...totalPair} size="hero" layout="inline" /> : <Dash />}
          </View>
        </View>
        {compare && totalPct != null ? <ChangePill percent={totalPct} /> : null}
      </View>

      <View style={[styles.divider, { borderColor: theme.border }]} />

      <View style={styles.stats}>
        <Stat label="Expenses" percent={countPct} compare={compare}>
          {count !== null ? (
            <Text style={[styles.count, { color: theme.ink }]}>{count}</Text>
          ) : (
            <Dash />
          )}
        </Stat>

        <Stat label="Average per expense" percent={averagePct} compare={compare}>
          {averagePair ? <DualAmount {...averagePair} size="md" layout="inline" /> : <Dash />}
        </Stat>

        <Stat label="Top category" percent={topPct} compare={compare}>
          {top ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Show ${top.categoryName} expenses`}
              onPress={() => onOpenCategory(top.categoryId)}
              style={({ pressed }) => [styles.top, pressed && styles.pressed]}
            >
              <View style={styles.topName}>
                <View style={[styles.swatch, { backgroundColor: top.color }]} />
                <Text
                  style={[text.bodyMedium, styles.topLabel, { color: theme.ink }]}
                  numberOfLines={1}
                >
                  {top.categoryName}
                </Text>
                <Text style={[text.caption, { color: theme.muted }]}>
                  {formatPercent(top.percentage)}
                </Text>
              </View>
              <View style={styles.topRight}>
                {topPair ? <DualAmount {...topPair} size="md" layout="inline" /> : null}
                <IconArrowRight size={16} color={theme.muted} />
              </View>
            </Pressable>
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
  divider: { marginTop: spacing.xl, borderTopWidth: 1, paddingTop: spacing.xl },
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
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  topName: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  topLabel: { flexShrink: 1 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 9, height: 9, borderRadius: radius.xs / 2 },
  pressed: { opacity: 0.7 },
});
