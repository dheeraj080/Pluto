/**
 * A bottom-sheet for choosing the Activity list's date window.
 *
 * Presets are applied immediately on tap (there is nothing to confirm), and the
 * visible selection is driven entirely by the `value` prop — so the sheet has no
 * local state to keep in sync with its parent. Tapping the backdrop closes it.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { borderWidth, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { lastMonthRange, thisMonthRange } from '@/lib/date';

export type DateRangePreset = 'this_month' | 'last_month' | 'all_time' | 'custom';

export interface ActivityDateRange {
  preset: DateRangePreset;
  from?: string;
  to?: string;
}

interface DateRangeSheetProps {
  visible: boolean;
  onClose: () => void;
  value: ActivityDateRange;
  onApply: (value: ActivityDateRange) => void;
}

const PRESET_OPTIONS: { value: DateRangePreset; label: string; hint: string }[] = [
  { value: 'this_month', label: 'This month', hint: 'From the 1st to today' },
  { value: 'last_month', label: 'Last month', hint: 'The previous calendar month' },
  { value: 'all_time', label: 'All time', hint: 'Every recorded expense' },
];

/** Resolves a preset into concrete bounds, using the device's local calendar. */
export function dateRangeForPreset(preset: DateRangePreset, now: Date = new Date()): ActivityDateRange {
  switch (preset) {
    case 'this_month': {
      const { from, to } = thisMonthRange(now);
      return { preset, from, to };
    }
    case 'last_month': {
      const { from, to } = lastMonthRange(now);
      return { preset, from, to };
    }
    case 'all_time':
      // No bounds: an absent from/to means "everything" to the API.
      return { preset, from: undefined, to: undefined };
    case 'custom':
      // `custom` is never *chosen* here — the sheet only offers the three
      // presets above. It exists so a drill-down (e.g. from Reports) can hand
      // the list an arbitrary window, and its bounds travel with that caller
      // rather than being derived from a preset.
      return { preset, from: undefined, to: undefined };
  }
}

export function DateRangeSheet({ visible, onClose, value, onApply }: DateRangeSheetProps) {
  const theme = useTheme();

  const handleSelect = (preset: DateRangePreset) => {
    onApply(dateRangeForPreset(preset));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
        <Pressable
          accessibilityViewIsModal
          accessibilityRole="none"
          style={[styles.sheet, { backgroundColor: theme.surface }]}
          onPress={(e: any) => e.stopPropagation()}
        >
          <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[text.subtitle, { color: theme.ink }]}>Date range</Text>
            <View style={styles.presetGroup}>
              {PRESET_OPTIONS.map((option) => {
                const selected = option.value === value.preset;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => handleSelect(option.value)}
                    style={({ pressed }) => [
                      styles.preset,
                      {
                        backgroundColor: selected ? theme.surfaceMuted : 'transparent',
                        borderColor: selected ? theme.primary : theme.border,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[text.bodyMedium, { color: theme.ink }]}>{option.label}</Text>
                    <Text style={[text.caption, { color: theme.muted }]}>{option.hint}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Pressable>
      </View>
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
    maxHeight: '80%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  content: { flexShrink: 1 },
  contentContainer: { paddingHorizontal: spacing.lg, gap: spacing.md },
  presetGroup: { gap: spacing.sm },
  preset: {
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
  },
  pressed: { opacity: 0.7 },
});