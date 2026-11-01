/**
 * A bottom-sheet for choosing the Activity list's date window.
 *
 * Presets are applied immediately on tap (there is nothing to confirm), and the
 * visible selection is driven entirely by the `value` prop — so the sheet has no
 * local state to keep in sync with its parent. Tapping the backdrop closes it.
 *
 * A "Custom range" option lets the user pick arbitrary from/to dates — parity
 * with the Reports range sheet.
 */
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { borderWidth, radius, spacing, text } from '@/theme';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/hooks/use-theme';
import { lastMonthRange, thisMonthRange } from '@/lib/date';
import { isValidIsoDate } from '@/lib/format';

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

const DATE_ERROR = 'Use a date like 2026-10-01';

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
      return { preset, from: undefined, to: undefined };
  }
}

export function DateRangeSheet({ visible, onClose, value, onApply }: DateRangeSheetProps) {
  const theme = useTheme();
  const [from, setFrom] = useState(value.from ?? '');
  const [to, setTo] = useState(value.to ?? '');
  const [errors, setErrors] = useState<{ from?: string; to?: string }>({});

  useEffect(() => {
    if (visible) {
      void AccessibilityInfo.announceForAccessibility('Date range');
    }
    return () => {
      void AccessibilityInfo.announceForAccessibility('Date range sheet closed');
    };
  }, [visible]);

  const handleSelect = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      // Stay on the sheet so the user can enter custom bounds.
      setErrors({});
      return;
    }
    onApply(dateRangeForPreset(preset));
    onClose();
  };

  const handleApplyCustom = () => {
    const next: { from?: string; to?: string } = {};
    if (!isValidIsoDate(from)) next.from = DATE_ERROR;
    if (!isValidIsoDate(to)) next.to = DATE_ERROR;
    setErrors(next);
    if (next.from || next.to) return;
    onApply({ preset: 'custom', from, to });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
        <Pressable
          accessible
          accessibilityRole={('dialog' as any)}
          accessibilityLabel="Date range"
          accessibilityViewIsModal
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
              {value.preset as DateRangePreset !== 'custom' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: value.preset === 'custom' }}
                  onPress={() => handleSelect('custom')}
                  style={({ pressed }) => [
                    styles.preset,
                    {
                      backgroundColor:
                        value.preset === 'custom' ? theme.surfaceMuted : 'transparent',
                      borderColor: value.preset === 'custom' ? theme.primary : theme.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[text.bodyMedium, { color: theme.ink }]}>Custom range</Text>
                  <Text style={[text.caption, { color: theme.muted }]}>Choose your own dates</Text>
                </Pressable>
              )}
            </View>

            {value.preset === 'custom' && (
              <>
                <View style={[styles.customHead, { borderColor: theme.border }]}>
                  <Text style={[text.overline, { color: theme.muted }]}>Custom</Text>
                </View>
                <View style={styles.customFields}>
                  <View style={styles.field}>
                    <TextField
                      label="From"
                      value={from}
                      onChangeText={setFrom}
                      placeholder="YYYY-MM-DD"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="numbers-and-punctuation"
                      error={errors.from}
                    />
                  </View>
                  <View style={styles.field}>
                    <TextField
                      label="To"
                      value={to}
                      onChangeText={setTo}
                      placeholder="YYYY-MM-DD"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="numbers-and-punctuation"
                      error={errors.to}
                    />
                  </View>
                </View>
                <Button label="Apply range" onPress={handleApplyCustom} />
              </>
            )}
          </ScrollView>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end', elevation: 8 },
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
  customHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: borderWidth.hairline,
  },
  customFields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  field: { flexGrow: 1, flexBasis: 0, minWidth: 140 },
  apply: { alignSelf: 'flex-start' },
});
