/**
 * "Top categories": the dashboard's "where is the money going?" card.
 *
 * The ranked top five taken straight from the month's comparison payload, so
 * the card costs no extra request. Each row is the category's own colour dot,
 * its name, the amount in the Pair, and a thin share bar with the percentage at
 * its right end — the same row language the Reports breakdown uses, compacted
 * for a glance.
 *
 * Every row is tappable and opens the Activity list filtered to that category
 * over the same window, the drill-down the web reaches through its report
 * drawer. The card draws no chart: deeper analysis belongs to Reports.
 */

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DualAmount } from '@/components/amount';
import { DashboardCard } from '@/components/dashboard/card';
import { radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { rateBetween, summaryAmounts, type RateSnapshot } from '@/lib/convert';
import { formatPercent } from '@/lib/format';
import type { MonthWindow } from '@/lib/ranges';
import { activityHref } from '@/lib/routes';
import type { CategoryBreakdown } from '@/lib/report-types';

const MAX_ROWS = 5;

export function TopCategoriesCard({
  entries,
  count,
  loading,
  base,
  second,
  snapshot,
  window: monthWindow,
}: {
  entries: CategoryBreakdown[];
  /** Expenses counted in the window; a zero hides the card, not a "no rate" note. */
  count: number;
  loading: boolean;
  /** Home currency the totals are already aggregated in. */
  base: string | null;
  /** Second currency; falls back to the rate snapshot for the companion figure. */
  second: string | null;
  snapshot: RateSnapshot | null;
  /** The same window the totals cover, so drill-downs open on identical dates. */
  window: MonthWindow;
}) {
  const theme = useTheme();
  const top = entries.slice(0, MAX_ROWS);
  const isEmpty = !loading && top.length === 0;

  // No spending in the window means there is nothing to rank; the month card
  // already says so, so the dashboard does not repeat it here.
  if (!loading && count === 0) return null;

  return (
    <DashboardCard
      title="Top categories"
      loading={loading && top.length === 0}
      skeletonHeight={200}
      isEmpty={isEmpty}
      empty={
        <Text style={[text.body, styles.empty, { color: theme.muted }]}>
          Category breakdowns need a rate to combine currencies.
        </Text>
      }
      footer={
        <Pressable hitSlop={8} onPress={() => router.push('/reports')}>
          <Text style={[text.captionMedium, { color: theme.primary }]}>View all reports</Text>
        </Pressable>
      }
    >
      {top.map((entry) => (
        <CategoryRow
          key={entry.categoryId}
          entry={entry}
          max={top[0]?.total ?? 0}
          base={base}
          second={second}
          snapshot={snapshot}
          onOpen={() =>
            router.push(
              activityHref({
                categoryId: entry.categoryId,
                from: monthWindow.from,
                to: monthWindow.to,
              }),
            )
          }
        />
      ))}
    </DashboardCard>
  );
}

/**
 * One ranked category: dot, name, the Pair amount, and the share bar.
 *
 * The companion figure comes from the server's `secondaryTotal` when it exists
 * and is derived from the rate snapshot when it does not, so a row never
 * invents a currency it cannot honestly show.
 */
function CategoryRow({
  entry,
  max,
  base,
  second,
  snapshot,
  onOpen,
}: {
  entry: CategoryBreakdown;
  /** The largest total in the list, which the share bar is scaled against. */
  max: number;
  base: string | null;
  second: string | null;
  snapshot: RateSnapshot | null;
  onOpen: () => void;
}) {
  const theme = useTheme();

  const secondary = (() => {
    if (entry.secondaryTotal != null) return entry.secondaryTotal;
    if (!second || !base || !snapshot) return null;
    const rate = rateBetween(base, second, snapshot.rates);
    return rate == null ? null : entry.total * rate;
  })();
  const pair = summaryAmounts(entry.total, base, secondary, second);
  const barWidth = max > 0 ? (entry.total / max) * 100 : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show ${entry.categoryName} expenses`}
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowHead}>
        <View style={[styles.dot, { backgroundColor: entry.color }]} />
        <Text numberOfLines={1} style={[text.bodyMedium, styles.name, { color: theme.ink }]}>
          {entry.categoryName}
        </Text>
        {pair ? <DualAmount {...pair} size="sm" layout="stack" align="right" /> : null}
      </View>

      <View style={styles.rowBar}>
        <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
          <View style={[styles.fill, { width: `${barWidth}%`, backgroundColor: entry.color }]} />
        </View>
        <Text style={[text.caption, styles.share, { color: theme.muted }]}>
          {formatPercent(entry.percentage)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', paddingVertical: spacing.huge },
  row: { paddingVertical: spacing.md, gap: spacing.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: radius.pill },
  name: { flex: 1 },
  rowBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  share: { width: 44, textAlign: 'right' },
  pressed: { opacity: 0.7 },
});
