import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { Schemas } from '@pluto/api-client';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
  if (!summary) {
    return (
      <ThemedView style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          This month
        </ThemedText>
        {loading ? (
          <ActivityIndicator style={styles.spinner} />
        ) : (
          <ThemedText themeColor="textSecondary">No summary available.</ThemedText>
        )}
      </ThemedView>
    );
  }

  const { baseCurrency, secondaryCurrency, conversionStatus } = summary;
  // The generated types mark these `| undefined` on top of `| null`, so the
  // narrowing below normalises both to `null`.
  const total = summary.total ?? null;
  const average = summary.average ?? null;
  const secondaryTotal = summary.secondaryTotal ?? null;

  return (
    <ThemedView style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">
        This month
      </ThemedText>

      <ThemedText type="title">
        {total === null ? '—' : formatMoney(total, baseCurrency)}
      </ThemedText>

      <View style={styles.metaRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {summary.count} {summary.count === 1 ? 'expense' : 'expenses'}
        </ThemedText>
        {average !== null ? (
          <ThemedText type="small" themeColor="textSecondary">
            avg {formatMoney(average, baseCurrency)}
          </ThemedText>
        ) : null}
      </View>

      {secondaryCurrency && secondaryTotal !== null ? (
        <ThemedText type="small" themeColor="textSecondary">
          ≈ {formatMoney(secondaryTotal, secondaryCurrency)}
        </ThemedText>
      ) : null}

      {conversionStatus === 'partially_converted' ? (
        <ThemedText type="small" themeColor="textSecondary">
          Some amounts could not be converted
        </ThemedText>
      ) : null}

      {conversionStatus === 'unavailable' ? (
        <ThemedText type="small" themeColor="textSecondary">
          {summary.conversionUnavailableReason ?? 'Exchange rates unavailable'}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.three,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  spinner: {
    alignSelf: 'flex-start',
  },
});
