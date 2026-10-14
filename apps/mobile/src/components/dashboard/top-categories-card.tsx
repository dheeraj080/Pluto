/**
 * "Top categories": where the money went this month.
 *
 * The ranked top five, each a muted dot, the category name, the pair of
 * figures, and a thin share bar with its percentage at the right end. Rows stay
 * compact so all five fit without large gaps.
 *
 * The web's "View all →" points at the Reports screen, which mobile does not
 * have yet; rather than send the user nowhere, the card stands alone until the
 * Reports tab lands.
 */

import { StyleSheet, Text, View } from 'react-native';

import { DashboardCard } from '@/components/dashboard/card';
import { radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { rateBetween, type RateSnapshot } from '@/lib/convert';
import { formatMoney, formatPercent } from '@/lib/format';
import type { CategoryBreakdown } from '@/lib/report-types';

const MAX_ROWS = 5;

export function TopCategoriesCard({
  entries,
  base,
  second,
  snapshot,
  loading,
}: {
  entries: CategoryBreakdown[];
  base: string;
  second: string | null;
  snapshot: RateSnapshot | null;
  loading: boolean;
}) {
  const theme = useTheme();

  const top = entries.slice(0, MAX_ROWS);
  const max = top.reduce((highest, entry) => Math.max(highest, entry.total), 0);

  return (
    <DashboardCard
      title="Top categories"
      skeletonHeight={176}
      loading={loading && entries.length === 0}
      empty={
        <Text style={[text.body, styles.centered, { color: theme.muted }]}>
          Category breakdowns need a rate to combine currencies.
        </Text>
      }
    >
      <View style={styles.rows}>
        {top.map((entry) => {
          // The server supplies the second-currency total when it converted;
          // otherwise preview it from the public snapshot, display-only.
          const secondary =
            second == null
              ? null
              : (entry.secondaryTotal ??
                (snapshot && base
                  ? (() => {
                      const rate = rateBetween(base, second, snapshot.rates);
                      return rate == null ? null : entry.total * rate;
                    })()
                  : null));

          return (
            <View key={entry.categoryId} style={styles.row}>
              <View style={styles.head}>
                <View style={styles.label}>
                  <View style={[styles.dot, { backgroundColor: entry.color }]} />
                  <Text numberOfLines={1} style={[text.body, { color: theme.ink }]}>
                    {entry.categoryName}
                  </Text>
                </View>

                <View style={styles.amounts}>
                  <Text
                    numberOfLines={1}
                    style={[text.bodyMedium, { color: theme.ink, fontVariant: ['tabular-nums'] }]}
                  >
                    {formatMoney(entry.total, base)}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[text.caption, styles.secondary, { color: theme.muted }]}
                  >
                    {second && secondary != null ? formatMoney(secondary, second) : ' '}
                  </Text>
                </View>
              </View>

              <View style={styles.share}>
                <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        flexGrow: max > 0 ? (entry.total / max) * 100 : 0,
                        backgroundColor: entry.color,
                      },
                    ]}
                  />
                  <View style={{ flexGrow: max > 0 ? 100 - (entry.total / max) * 100 : 100 }} />
                </View>
                <Text style={[text.caption, styles.percent, { color: theme.muted }]}>
                  {formatPercent(entry.percentage)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing.md },
  row: { gap: spacing.xs },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  label: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  amounts: { flexShrink: 0, alignItems: 'flex-end' },
  secondary: { fontSize: 11, lineHeight: 15 },
  share: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: {
    flex: 1,
    flexDirection: 'row',
    height: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { borderRadius: radius.pill },
  percent: { width: 38, textAlign: 'right' },
  centered: { paddingVertical: spacing.xxxl, textAlign: 'center' },
});
