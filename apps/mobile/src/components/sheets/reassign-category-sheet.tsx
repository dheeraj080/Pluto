/**
 * Bottom sheet to reassign expenses from one category to another, then delete
 * the original.
 */

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { ErrorNote } from '@/components/ui/feedback';
import { IconCheck } from '@/components/icons';
import { borderWidth, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ExpenseCategory } from '@/hooks/use-categories';

export interface ReassignCategorySheetProps {
  visible: boolean;
  source: ExpenseCategory | null;
  categories: ExpenseCategory[];
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (targetId: string) => void;
}

export function ReassignCategorySheet({
  visible,
  source,
  categories,
  busy,
  error,
  onClose,
  onConfirm,
}: ReassignCategorySheetProps) {
  const theme = useTheme();
  const [targetId, setTargetId] = useState<string | null>(null);

  const others = categories.filter((c) => c.id !== source?.id);
  const hasTarget = targetId != null;

  const submit = () => {
    if (targetId) {
      onConfirm(targetId);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalRoot}
      >
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
        <Pressable
          accessibilityViewIsModal
          accessibilityRole="none"
          style={[styles.sheet, { backgroundColor: theme.surface }]}
          onPress={(event: { stopPropagation: () => void }) => event.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[text.subtitle, { color: theme.ink }]}>Reassign expenses</Text>
            <Text style={[text.body, { color: theme.muted }]}>
              “{source?.name}” has {source?.expenseCount}{' '}
              {source?.expenseCount === 1 ? 'expense' : 'expenses'}. Move them to another category,
              then delete {source?.name}.
            </Text>

            <View style={styles.presets}>
              {others.length === 0 ? (
                <Text style={[text.body, { color: theme.muted }]}>
                  No other categories exist. Create another category first to reassign.
                </Text>
              ) : (
                others.map((c) => {
                  const selected = c.id === targetId;
                  return (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setTargetId(c.id)}
                      style={({ pressed }) => [
                        styles.preset,
                        {
                          backgroundColor: selected ? theme.surfaceMuted : 'transparent',
                          borderColor: selected ? theme.primary : theme.border,
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.presetText}>
                        <Text style={[text.bodyMedium, { color: theme.ink }]}>{c.name}</Text>
                        <Text style={[text.caption, { color: theme.muted }]}>
                          {c.expenseCount} {c.expenseCount === 1 ? 'expense' : 'expenses'}
                        </Text>
                      </View>
                      {selected ? <IconCheck size={16} color={theme.primary} /> : null}
                    </Pressable>
                  );
                })
              )}
            </View>

            {error ? <ErrorNote message={error} /> : null}

            <View style={styles.actions}>
              <Button label="Cancel" variant="secondary" onPress={onClose} />
              <Button
                label="Reassign and delete"
                onPress={submit}
                busy={busy}
                disabled={busy || !hasTarget || others.length === 0}
              />
            </View>
          </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  scroll: { flexShrink: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  presets: { gap: spacing.sm },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
  },
  presetText: { flexShrink: 1, gap: spacing.xs / 2 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pressed: { opacity: 0.7 },
});
