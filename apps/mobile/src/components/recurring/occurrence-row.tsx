/**
 * One pending occurrence awaiting confirmation.
 *
 * A rule never posts an expense on its own, so this row is the decision point:
 * Confirm records the expense as it stands, Skip dismisses it, and the two
 * actions sit below the descriptive block so a mis-tap cannot post money.
 *
 * The amount is the occurrence's own snapshot, in the rule's currency — the
 * figure is not converted, because confirming posts exactly what is shown.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { IconCheck, IconClose } from '@/components/icons';
import { spacing, tabularNums, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RecurringOccurrence } from '@/hooks/use-recurring';
import { formatDate, formatMoney, formatRelativeDate } from '@/lib/format';

export function OccurrenceRow({
  occurrence,
  onConfirm,
  onSkip,
  busy,
}: {
  occurrence: RecurringOccurrence;
  onConfirm: () => void;
  onSkip: () => void;
  /** True while either action for this occurrence is in flight. */
  busy: boolean;
}) {
  const theme = useTheme();
  const title = occurrence.description || occurrence.categoryName;

  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <View style={styles.info}>
          <View style={styles.title}>
            <View style={[styles.dot, { backgroundColor: occurrence.categoryColor }]} />
            <Text numberOfLines={1} style={[text.bodyMedium, styles.name, { color: theme.ink }]}>
              {title}
            </Text>
          </View>
          <Text style={[text.caption, { color: theme.muted }]}>
            {occurrence.categoryName} · due {formatRelativeDate(occurrence.dueOn)} ·{' '}
            {formatDate(occurrence.dueOn)}
          </Text>
        </View>

        <Text style={[text.amount, tabularNums, { color: theme.ink }]}>
          {formatMoney(occurrence.amount, occurrence.currency)}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Skip"
          variant="ghost"
          size="sm"
          icon={(color) => <IconClose size={14} color={color} />}
          onPress={onSkip}
          busy={busy}
        />
        <Button
          label="Confirm"
          size="sm"
          icon={(color) => <IconCheck size={14} color={color} />}
          onPress={onConfirm}
          busy={busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  info: { flex: 1, gap: spacing.xs },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
  dot: { width: 9, height: 9, borderRadius: 999 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs },
});
