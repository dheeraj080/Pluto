/**
 * The Recurring add/edit sheet.
 *
 * One form for both jobs, mounted only while open so the draft seeds from
 * `target` in `useState` initialisers and is fresh every time.
 *
 * A rule never posts an expense by itself: it produces *pending occurrences* the
 * user confirms or skips on the Recurring screen. Create mode chooses the
 * cadence freely; edit mode also allows pausing and resuming, which the API does
 * by re-seeding the generation cursor so a paused gap is never back-filled.
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
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCategories } from '@/hooks/use-categories';
import { useSupportedCurrencies } from '@/hooks/use-currencies';
import {
  useCreateRecurring,
  useUpdateRecurring,
  type RecurrenceFrequency,
  type RecurringExpense,
} from '@/hooks/use-recurring';
import { errorMessage } from '@/lib/errors';
import { isValidIsoDate, parseAmount, todayIso } from '@/lib/format';

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

const PAYMENT_METHODS = ['CARD', 'CASH', 'UPI', 'OTHER'];

export function RecurringSheet({
  target,
  onClose,
}: {
  /** The rule to edit, or null to create a new one. */
  target: RecurringExpense | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const editing = target !== null;

  const categories = useCategories();
  const currencies = useSupportedCurrencies();
  const create = useCreateRecurring();
  const update = useUpdateRecurring();

  const [categoryId, setCategoryId] = useState(target?.categoryId ?? '');
  const [amount, setAmount] = useState(target ? String(target.amount) : '');
  const [currency, setCurrency] = useState(target?.currency ?? '');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(target?.frequency ?? 'MONTHLY');
  const [interval, setIntervalValue] = useState(target ? String(target.interval) : '1');
  const [startDate, setStartDate] = useState(target?.startDate ?? todayIso());
  const [endDate, setEndDate] = useState(target?.endDate ?? '');
  const [description, setDescription] = useState(target?.description ?? '');
  const [paymentMethod, setPaymentMethod] = useState(target?.paymentMethod ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const currencyOptions = currencies.data ?? [];
  const effectiveCurrency = currency || currencyOptions[0]?.code || '';
  const paused = target?.status === 'PAUSED';

  const busy = create.isPending || update.isPending;
  const mutationError = create.isError
    ? create.error
    : update.isError
      ? update.error
      : null;

  const submit = () => {
    const parsed = parseAmount(amount);
    if (parsed === null) {
      setValidationError('Enter an amount like 1500.00.');
      return;
    }
    if (!categoryId) {
      setValidationError('Choose a category.');
      return;
    }
    if (!editing && !effectiveCurrency) {
      setValidationError('Choose the currency this repeats in.');
      return;
    }
    if (!isValidIsoDate(startDate)) {
      setValidationError('Starts must be a date like 2026-10-01.');
      return;
    }
    if (endDate && !isValidIsoDate(endDate)) {
      setValidationError('Ends must be a date like 2027-10-01, or left blank.');
      return;
    }
    if (endDate && endDate < startDate) {
      setValidationError('Ends cannot be before the start date.');
      return;
    }
    const step = Number(interval);
    if (!Number.isInteger(step) || step < 1 || step > 12) {
      setValidationError('Repeat every 1 to 12 periods.');
      return;
    }

    setValidationError(null);

    const payload = {
      categoryId,
      amount: parsed,
      currency: effectiveCurrency,
      frequency,
      interval: step,
      startDate,
      endDate: endDate || undefined,
      description: description.trim() || undefined,
      paymentMethod: paymentMethod.trim() || undefined,
    };

    if (editing && target) {
      update.mutate(
        {
          id: target.id,
          body: {
            ...payload,
            // An empty Ends clears the bound rather than leaving the old one.
            endDate: endDate || null,
          },
        },
        { onSuccess: onClose },
      );
      return;
    }

    create.mutate(payload, { onSuccess: onClose });
  };

  const togglePaused = () => {
    if (!target) return;
    update.mutate(
      { id: target.id, body: { status: paused ? 'ACTIVE' : 'PAUSED' } },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              {editing ? 'Edit recurring expense' : 'Add recurring expense'}
            </Text>

            <View style={styles.group}>
              <Text style={[text.bodyMedium, { color: theme.ink }]}>Category</Text>
              {categories.isPending ? (
                <Text style={[text.caption, { color: theme.muted }]}>Loading categories…</Text>
              ) : (
                <Select
                  accessibilityLabel="Category"
                  value={categoryId}
                  onChange={setCategoryId}
                  placeholder="Choose a category"
                  options={(categories.data ?? []).map((option) => ({
                    value: option.id,
                    label: option.name,
                    dotColor: option.color,
                  }))}
                />
              )}
            </View>

            <TextField
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              editable={!busy}
            />

            <View style={styles.group}>
              <Text style={[text.bodyMedium, { color: theme.ink }]}>Currency</Text>
              {currencyOptions.length === 0 ? (
                <Text style={[text.caption, { color: theme.muted }]}>Loading currencies…</Text>
              ) : (
                <Select
                  accessibilityLabel="Currency"
                  value={effectiveCurrency}
                  onChange={setCurrency}
                  options={currencyOptions.map((option) => ({
                    value: option.code,
                    label: `${option.code} · ${option.symbol}`,
                  }))}
                />
              )}
            </View>

            <View style={styles.group}>
              <Text style={[text.bodyMedium, { color: theme.ink }]}>How often</Text>
              <SegmentedControl
                label="Frequency"
                options={FREQUENCIES}
                value={frequency}
                onChange={setFrequency}
              />
            </View>

            <TextField
              label="Every"
              hint="Periods between each occurrence (1 = every period)."
              value={interval}
              onChangeText={setIntervalValue}
              keyboardType="number-pad"
              editable={!busy}
            />

            <TextField
              label="Starts"
              hint="Anchors the cadence. Past dates only set the rhythm — nothing is back-filled."
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-10-01"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextField
              label="Ends"
              hint="Optional. Leave blank to repeat indefinitely."
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2027-10-01"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextField
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Optional note, e.g. Rent"
              maxLength={280}
            />

            <View style={styles.group}>
              <Text style={[text.bodyMedium, { color: theme.ink }]}>Payment method</Text>
              <Select
                accessibilityLabel="Payment method"
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={[
                  { value: '', label: 'Any method' },
                  ...PAYMENT_METHODS.map((method) => ({ value: method, label: method })),
                ]}
              />
            </View>

            {validationError ? <ErrorNote message={validationError} /> : null}
            {mutationError ? (
              <ErrorNote message={errorMessage(mutationError) ?? 'Could not save.'} />
            ) : null}

            <View style={styles.actions}>
              {editing ? (
                <Button
                  label={paused ? 'Resume' : 'Pause'}
                  variant="secondary"
                  onPress={togglePaused}
                  disabled={busy}
                />
              ) : (
                <Button label="Cancel" variant="secondary" onPress={onClose} />
              )}
              <Button
                label={editing ? 'Save' : 'Add recurring'}
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
    maxHeight: '88%',
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
