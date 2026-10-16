/**
 * One recurring rule: what it repeats, on what cadence, and when it is next due.
 *
 * Laid out like `BudgetRow` — a descriptive block on the left, the amount on the
 * right, and the Edit/Remove actions beneath the block so reaching for Remove
 * never fires an edit.
 *
 * The rule's own amount is shown in the rule currency, since that is what each
 * confirmed occurrence will post. A "paused" badge marks a rule that is
 * currently suppressing generation.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconEdit, IconTrash } from '@/components/icons';
import { radius, spacing, tabularNums, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RecurringExpense } from '@/hooks/use-recurring';
import { formatDate, formatMoney } from '@/lib/format';
import { describeCadence } from '@/lib/recurrence';

export function RecurringRow({
  rule,
  onEdit,
  onRemove,
  busy,
}: {
  rule: RecurringExpense;
  onEdit: () => void;
  onRemove: () => void;
  /** True while this rule's delete is in flight. */
  busy: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${rule.categoryName} recurring expense — edit`}
        onPress={onEdit}
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
      >
        <View style={styles.top}>
          <View style={styles.info}>
            <View style={styles.title}>
              <View style={[styles.dot, { backgroundColor: rule.categoryColor }]} />
              <Text numberOfLines={1} style={[text.bodyMedium, styles.name, { color: theme.ink }]}>
                {rule.description || rule.categoryName}
              </Text>
            </View>

            <Text style={[text.caption, { color: theme.muted }]}>
              {rule.categoryName} · {describeCadence(rule.frequency, rule.interval)}
            </Text>

            <View style={styles.tags}>
              {rule.status === 'PAUSED' ? <Badge label="paused" /> : null}
              {rule.pendingCount > 0 ? (
                <Badge
                  label={`${rule.pendingCount} due`}
                  tone="accent"
                />
              ) : null}
              {rule.nextDueOn ? (
                <Text style={[text.caption, { color: theme.muted }]}>
                  next {formatDate(rule.nextDueOn)}
                </Text>
              ) : null}
            </View>
          </View>

          <Text style={[text.amount, tabularNums, { color: theme.ink }]}>
            {formatMoney(rule.amount, rule.currency)}
          </Text>
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Button
          label="Edit"
          variant="ghost"
          size="sm"
          icon={(color) => <IconEdit size={14} color={color} />}
          onPress={onEdit}
        />
        <Button
          label="Remove"
          variant="ghost"
          size="sm"
          icon={(color) => <IconTrash size={14} color={color} />}
          onPress={onRemove}
          busy={busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, gap: spacing.sm },
  open: { gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  info: { flex: 1, gap: spacing.xs },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
  dot: { width: 9, height: 9, borderRadius: radius.pill },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs },
  pressed: { opacity: 0.7 },
});
