/**
 * One category: its colour, name, expense count, and the two actions.
 *
 * A single line, so a long list stays scannable. Tapping the row opens that
 * category's expenses in Activity; the icon buttons sit outside the tap target
 * so a reach for Delete never navigates. The colour dot is always drawn beside
 * the name, so colour never carries meaning on its own.
 *
 * The actions are icon-only, so each carries its name in the accessibility
 * label instead of a visible one.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconEdit, IconTrash } from '@/components/icons';
import { Spinner } from '@/components/ui/feedback';
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
        <Text
          numberOfLines={1}
          style={[text.bodyStrong, styles.name, { color: theme.ink }]}
        >
          {category.name}
        </Text>
        <Text style={[text.caption, { color: theme.muted }]}>
          {category.expenseCount} {category.expenseCount === 1 ? 'expense' : 'expenses'}
        </Text>
      </Pressable>

      <RowAction label={`Edit ${category.name}`} onPress={onEdit}>
        <IconEdit size={18} color={theme.muted} />
      </RowAction>
      <RowAction label={`Delete ${category.name}`} onPress={onDelete} busy={deleteBusy}>
        <IconTrash size={18} color={theme.danger} />
      </RowAction>
    </View>
  );
}

/** An icon-only control; the glyph is the whole button, so `label` names it. */
function RowAction({
  label,
  onPress,
  busy = false,
  children,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      onPress={onPress}
      disabled={busy}
      hitSlop={6}
      style={({ pressed }) => [styles.action, pressed && { backgroundColor: theme.surfaceMuted }]}
    >
      {busy ? <Spinner size="small" /> : children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  open: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    paddingVertical: spacing.md,
  },
  pressed: { opacity: 0.7 },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  name: { flexShrink: 1 },
  action: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
});
