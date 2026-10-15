/**
 * The Categories add/edit sheet.
 *
 * One form for both jobs. The screen mounts this only while it is open, so the
 * draft is seeded from `target` in `useState` initialisers and is fresh every
 * time — no effect syncing the fields, and therefore no set-state-in-effect.
 *
 * Colour is the six theme-aware presets plus a hex field: the web leans on the
 * browser's native colour input, which React Native has no equivalent for, so a
 * validated `#rrggbb` field is the honest replacement.
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
import { TextField } from '@/components/ui/text-field';
import { borderWidth, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCreateCategory, useUpdateCategory } from '@/hooks/use-category-mutations';
import type { ExpenseCategory } from '@/hooks/use-categories';
import { errorMessage } from '@/lib/errors';

/** A `#` is optional so a pasted `34d399` is accepted. */
const HEX_PATTERN = /^#?[0-9a-fA-F]{6}$/;

/** `#rrggbb` in lower case for a valid hex, or null when it is not one. */
function normalizeHex(input: string): string | null {
  const trimmed = input.trim();
  if (!HEX_PATTERN.test(trimmed)) return null;
  return `#${trimmed.replace('#', '').toLowerCase()}`;
}

export function CategorySheet({
  target,
  onClose,
}: {
  /** The category to edit, or null to create a new one. */
  target: ExpenseCategory | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const editing = target !== null;

  const create = useCreateCategory();
  const update = useUpdateCategory();

  const [name, setName] = useState(target?.name ?? '');
  const [color, setColor] = useState(target?.color ?? theme.cat.mint);
  const [validationError, setValidationError] = useState<string | null>(null);

  const swatches = [
    theme.cat.mint,
    theme.cat.sky,
    theme.cat.amber,
    theme.cat.rose,
    theme.cat.violet,
    theme.cat.slate,
  ];

  // The palette hexes are upper case in the dark ramp, so compare folded.
  const normalized = normalizeHex(color);
  const active = normalized ? normalized.toLowerCase() : null;
  const previewColor = normalized ?? theme.surfaceMuted;

  const busy = create.isPending || update.isPending;
  const writeError = errorMessage(create.error) ?? errorMessage(update.error);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError('Enter a name.');
      return;
    }
    if (!normalized) {
      setValidationError('Enter a hex colour like #34d399.');
      return;
    }
    setValidationError(null);

    if (editing && target) {
      update.mutate({ id: target.id, body: { name: trimmed, color: normalized } }, { onSuccess: onClose });
    } else {
      create.mutate({ name: trimmed, color: normalized }, { onSuccess: onClose });
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
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
            <Text style={[text.subtitle, { color: theme.ink }]}>
              {editing ? 'Edit category' : 'Add category'}
            </Text>

            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Groceries"
              maxLength={60}
              editable={!busy}
            />

            <View style={styles.group}>
              <Text style={[text.bodyMedium, { color: theme.ink }]}>Colour</Text>

              <View style={styles.swatchRow}>
                {swatches.map((option) => {
                  const selected = active === option.toLowerCase();
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityLabel={`Colour ${option}`}
                      accessibilityState={{ selected }}
                      onPress={() => setColor(option)}
                      hitSlop={4}
                      style={[
                        styles.swatch,
                        {
                          backgroundColor: option,
                          borderColor: selected ? theme.ink : theme.border,
                          borderWidth: selected ? borderWidth.thick : borderWidth.hairline,
                        },
                      ]}
                    />
                  );
                })}
              </View>

              <TextField
                accessibilityLabel="Hex colour"
                value={color}
                onChangeText={setColor}
                placeholder="#34d399"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={7}
                editable={!busy}
              />
            </View>

            <View style={styles.preview}>
              <View style={[styles.previewDot, { backgroundColor: previewColor }]} />
              <Text numberOfLines={1} style={[text.body, styles.previewName, { color: theme.ink }]}>
                {name.trim() || 'New category'}
              </Text>
            </View>

            {validationError ? <ErrorNote message={validationError} /> : null}
            {writeError ? <ErrorNote message={writeError} /> : null}

            <View style={styles.actions}>
              <Button label="Cancel" variant="secondary" onPress={onClose} />
              <Button
                label={editing ? 'Save changes' : 'Add category'}
                onPress={submit}
                busy={busy}
                disabled={busy}
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
  group: { gap: spacing.sm },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  swatch: { width: 36, height: 36, borderRadius: radius.pill },
  preview: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewDot: { width: 12, height: 12, borderRadius: radius.pill },
  previewName: { flexShrink: 1 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
