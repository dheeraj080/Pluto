import { StyleSheet, View } from 'react-native';
import type { Schemas } from '@pluto/api-client';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatDate, formatMoney } from '@/lib/format';

export function ExpenseRow({ expense }: { expense: Schemas['ExpenseDto'] }) {
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <View style={[styles.dot, { backgroundColor: expense.categoryColor }]} />
      <View style={styles.details}>
        <ThemedText numberOfLines={1}>{expense.categoryName}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {expense.description ?? formatDate(expense.incurredOn)}
        </ThemedText>
      </View>
      <ThemedText type="smallBold">{formatMoney(expense.amount, expense.currency)}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  details: {
    flex: 1,
    gap: Spacing.half,
  },
});
