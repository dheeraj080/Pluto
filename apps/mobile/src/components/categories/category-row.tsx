/**
 * One category: its colour, name, expense count, and the actions.
 *
 * Tapping the row opens that category's expenses in Activity; the actions sit
 * below the tap target so a reach for Delete never navigates. The colour dot is
 * always drawn beside the name, so colour never carries meaning on its own.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconEdit, IconTrash } from '@/components/icons';
import { radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ExpenseCategory } from '@/hooks/use-categories';

export function CategoryRow({
  category,
  onOpen,
  onEdit,
  onDelete,
  deleteBusy,
}: {
  category: ExpenseCategory;
  /** Open this category's expenses in Activity. */
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** True while this row's delete is in flight. */
  deleteBusy: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${category.name} — show expenses`}
        onPress={onOpen}
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
      >
        <View style={[styles.dot, { backgroundColor: category.color }]} />

        <View style={styles.info}>
          <View style={styles.title}>
            <Text numberOfLines={1} style={[text.bodyStrong, styles.name, { color: theme.ink }]}>
              {category.name}
            </Text>
            {category.isDefault ? <Badge label="default" /> : null}
          </View>
          <Text style={[text.caption, { color: theme.muted }]}>
            {category.expenseCount} {category.expenseCount === 1 ? 'expense' : 'expenses'}
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
          label="Delete"
          variant="ghost"
          size="sm"
          icon={(color) => <IconTrash size={14} color={color} />}
          onPress={onDelete}
          busy={deleteBusy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, gap: spacing.sm },
  open: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pressed: { opacity: 0.7 },
  dot: { width: 12, height: 12, borderRadius: radius.pill },
  info: { flex: 1, gap: spacing.xs / 2 },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.xs },
});
