import { StyleSheet, Text, View } from 'react-native';
import type { Schemas } from '@pluto/api-client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/feedback';
import { spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';

/**
 * Month-to-date totals.
 *
 * `total` and `average` are null whenever the server could not convert every
 * line, which is why the card shows a dash plus an explanation rather than a
 * partial number that would silently understate the month.
 */
export function SummaryCard({
  summary,
  loading,
}: {
  summary: Schemas['ExpenseSummaryDto'] | null;
  loading: boolean;
}) {
  const theme = useTheme();

  if (!summary) {
    return (
      <Card>
        <Text style={[text.overline, { color: theme.muted }]}>THIS MONTH</Text>
        {loading ? (
          <Skeleton width={132} height={32} />
        ) : (
          <Text style={[text.title, { color: theme.ink }]}>—</Text>
        )}
        {!loading ? (
          <Text style={[text.caption, { color: theme.muted }]}>No summary available.</Text>
        ) : null}
      </Card>
    );
  }

  const { baseCurrency, secondaryCurrency, conversionStatus } = summary;
  // The generated types mark these `| undefined` on top of `| null`, so the
  // narrowing below normalises both to `null`.
  const total = summary.total ?? null;
  const average = summary.average ?? null;
  const secondaryTotal = summary.secondaryTotal ?? null;

  return (
    <Card>
      <View style={styles.heading}>
        <Text style={[text.overline, { color: theme.muted }]}>THIS MONTH</Text>
        {conversionStatus === 'unavailable' ? (
          <Badge label="Unconverted" tone="warning" />
        ) : null}
      </View>

      <Text numberOfLines={1} style={[text.amountHero, { color: theme.ink }]}>
        {total === null ? '—' : formatMoney(total, baseCurrency)}
      </Text>

      <View style={styles.metaRow}>
        <Text style={[text.caption, { color: theme.muted }]}>
          {summary.count} {summary.count === 1 ? 'expense' : 'expenses'}
        </Text>
        {average !== null ? (
          <Text style={[text.caption, { color: theme.muted }]}>
            avg {formatMoney(average, baseCurrency)}
          </Text>
        ) : null}
      </View>

      {secondaryCurrency && secondaryTotal !== null ? (
        <Text style={[text.caption, { color: theme.muted }]}>
          {`≈ ${formatMoney(secondaryTotal, secondaryCurrency)}`}
        </Text>
      ) : null}

      {total === null || conversionStatus === 'unavailable' ? (
        <Text style={[text.caption, { color: theme.muted }]}>
          Some expenses could not be converted into {baseCurrency}, so no total is shown.
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
});
