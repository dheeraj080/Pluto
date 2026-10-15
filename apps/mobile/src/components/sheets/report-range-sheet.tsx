/**
 * The Reports range sheet.
 *
 * Presets cover the common windows and apply on tap — there is nothing to
 * confirm — while a custom window gets two validated `YYYY-MM-DD` fields and an
 * explicit Apply, so a half-typed date can never become the range every card is
 * drawn from. The visual shape matches the Activity list's `DateRangeSheet`.
 *
 * The sheet keeps its own draft of the custom fields and only commits on Apply,
 * which is what lets it show a field error without the parent's range changing
 * underneath it. The parent mounts it only while open, so each opening starts
 * from the last applied bounds instead of an abandoned edit.
 */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconCheck } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { borderWidth, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ReportRangePreset } from '@/hooks/use-report-range';
import { isValidIsoDate } from '@/lib/format';
import type { ReportPreset } from '@/lib/ranges';

const PRESET_OPTIONS: { value: ReportRangePreset; label: string; hint: string }[] = [
  { value: 'month', label: 'This month', hint: 'From the 1st to today' },
  { value: '3m', label: 'Last 3 months', hint: 'This month and the two before it' },
  { value: '6m', label: 'Last 6 months', hint: 'Half a year, monthly buckets' },
  { value: '12m', label: 'Last 12 months', hint: 'A full year against the year before' },
];

const DATE_ERROR = 'Use a date like 2026-10-01';

export function ReportRangeSheet({
  visible,
  onClose,
  preset,
  customFrom,
  customTo,
  onApplyPreset,
  onApplyCustom,
}: {
  visible: boolean;
  onClose: () => void;
  /** The active preset, so the current choice is checked. */
  preset: ReportPreset;
  /** The last applied custom bounds, used to seed the fields. */
  customFrom: string;
  customTo: string;
  onApplyPreset: (preset: ReportRangePreset) => void;
  onApplyCustom: (from: string, to: string) => void;
}) {
  const theme = useTheme();
  const [from, setFrom] = useState(customFrom);
  const [to, setTo] = useState(customTo);
  const [errors, setErrors] = useState<{ from?: string; to?: string }>({});

  const handlePreset = (value: ReportRangePreset) => {
    onApplyPreset(value);
    onClose();
  };

  const handleApplyCustom = () => {
    const next: { from?: string; to?: string } = {};
    if (!isValidIsoDate(from)) next.from = DATE_ERROR;
    if (!isValidIsoDate(to)) next.to = DATE_ERROR;
    setErrors(next);
    if (next.from || next.to) return;

    onApplyCustom(from, to);
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
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[text.subtitle, { color: theme.ink }]}>Date range</Text>

            <View style={styles.presets}>
              {PRESET_OPTIONS.map((option) => {
                const selected = option.value === preset;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => handlePreset(option.value)}
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
                      <Text style={[text.bodyMedium, { color: theme.ink }]}>{option.label}</Text>
                      <Text style={[text.caption, { color: theme.muted }]}>{option.hint}</Text>
                    </View>
                    {selected ? <IconCheck size={16} color={theme.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.customHead, { borderColor: theme.border }]}>
              <Text style={[text.overline, { color: theme.muted }]}>Custom</Text>
              {preset === 'custom' ? <IconCheck size={16} color={theme.primary} /> : null}
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

            <Button label="Apply range" onPress={handleApplyCustom} style={styles.apply} />
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
  pressed: { opacity: 0.7 },
});
