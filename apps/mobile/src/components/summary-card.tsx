import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { Schemas } from '@pluto/api-client';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/format';

/**
 * `total`/`average` are nullable numbers on the server. The OpenAPI document
 * used to describe them as objects (a Nest metadata bug being fixed server
 * side), so narrow by `typeof` rather than trusting the generated shape.
 */
function asNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

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

  const total = asNumber(summary.total);
  const average = asNumber(summary.average);
  const secondaryCurrency = asString(summary.secondaryCurrency);
  const secondaryTotal = asNumber(summary.secondaryTotal);
  const partlyConverted = summary.conversionStatus === 'partially_converted';

  return (
    <ThemedView style={styles.card}>
      <ThemedText type="small" themeColor="textSecondary">
        This month
      </ThemedText>

      <ThemedText type="title">
        {total === null ? '—' : formatMoney(total, summary.baseCurrency)}
      </ThemedText>

      <View style={styles.metaRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {summary.count} {summary.count === 1 ? 'expense' : 'expenses'}
        </ThemedText>
        {average !== null ? (
          <ThemedText type="small" themeColor="textSecondary">
            avg {formatMoney(average, summary.baseCurrency)}
          </ThemedText>
        ) : null}
      </View>

      {secondaryCurrency && secondaryTotal !== null ? (
        <ThemedText type="small" themeColor="textSecondary">
          ≈ {formatMoney(secondaryTotal, secondaryCurrency)}
        </ThemedText>
      ) : null}

      {partlyConverted ? (
        <ThemedText type="small" themeColor="textSecondary">
          Some amounts could not be converted
        </ThemedText>
      ) : null}

      {summary.conversionStatus === 'unavailable' ? (
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
