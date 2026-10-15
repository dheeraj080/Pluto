/**
 * A mobile dropdown, mirroring the web's Select.
 *
 * A pressable trigger (styled like a text field) opens a bottom-sheet modal
 * with a scrollable list of options. Tapping an option calls onChange and
 * closes the sheet. The backdrop closes on tap or Android back.
 */

import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { IconCheck, IconChevronDown } from '@/components/icons';
import { borderWidth, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Optional colour swatch (e.g. for category options). */
  dotColor?: string | null;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  /**
   * `field` (default) is the labelled inset control; `chip` is a compact pill
   * trigger for filter rows, where a stack of full-width fields would waste
   * space. Both open the same bottom sheet.
   */
  variant?: 'field' | 'chip';
  /** Chip only: fill the pill with the accent colour when the value is set. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  label,
  hint,
  error,
  disabled = false,
  accessibilityLabel,
  variant = 'field',
  active = false,
  style,
}: SelectProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;
  const triggerLabel = selected ? selected.label : placeholder;

  const handleOpen = () => {
    if (!disabled) setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    handleClose();
  };

  return (
    <View style={[styles.wrap, style]}>
      {label && variant === 'field' ? (
        <Text style={[text.bodyMedium, { color: theme.ink }]}>{label}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{
          expanded: open,
          disabled,
          selected: variant === 'chip' ? active : undefined,
        }}
        accessibilityLabel={accessibilityLabel ?? label ?? 'Select'}
        disabled={disabled}
        onPress={handleOpen}
        style={({ pressed }) => [
          variant === 'chip' ? styles.chipTrigger : styles.trigger,
          variant === 'chip'
            ? {
                backgroundColor: active ? theme.primary : theme.surfaceMuted,
                borderColor: active ? theme.primary : theme.border,
              }
            : {
                backgroundColor: theme.surfaceMuted,
                borderColor: error ? theme.danger : theme.border,
              },
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.triggerContent}>
          {selected?.dotColor ? (
            <View style={[styles.dot, { backgroundColor: selected.dotColor }]} />
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              variant === 'chip' ? text.bodyMedium : text.body,
              styles.triggerText,
              {
                color:
                  variant === 'chip' ? (active ? theme.onPrimary : theme.muted) : theme.ink,
              },
            ]}
          >
            {triggerLabel}
          </Text>
        </View>
        {variant === 'field' ? (
          <IconChevronDown
            size={18}
            color={theme.muted}
            style={[styles.chevron, open && styles.chevronOpen]}
          />
        ) : null}
      </Pressable>

      {error ? (
        <Text style={[text.captionMedium, { color: theme.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[text.caption, { color: theme.muted }]}>{hint}</Text>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close"
            style={styles.backdrop}
            onPress={handleClose}
          />
          <Pressable
            accessibilityViewIsModal
            accessibilityRole="none"
            style={[styles.sheet, { backgroundColor: theme.surface }]}
            onPress={(e: any) => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <ScrollView
              style={styles.options}
              contentContainerStyle={styles.optionsContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {options.map((option, index) => {
                const isSelected = index === selectedIndex;
                const isDisabled = option.disabled;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                    disabled={isDisabled}
                    onPress={() => handleSelect(option.value)}
                    style={({ pressed }) => [
                      styles.optionRow,
                      isSelected && { backgroundColor: theme.surfaceMuted },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.optionContent}>
                      {option.dotColor ? (
                        <View style={[styles.dot, { backgroundColor: option.dotColor }]} />
                      ) : null}
                      <Text
                        numberOfLines={1}
                        style={[text.body, { color: isDisabled ? theme.muted : theme.ink }]}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {isSelected ? <IconCheck size={18} color={theme.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  trigger: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
  },
  chipTrigger: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  triggerText: { flex: 1 },
  chevron: { transform: [{ rotate: '0deg' }] },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
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
    maxHeight: '70%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  options: { flexShrink: 1 },
  optionsContent: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
