/**
 * The Budgets add/edit sheet.
 *
 * One form for both jobs. The screen mounts this only while it is open, so the
 * draft is seeded from `target` in `useState` initialisers and is fresh every
 * time — no effect syncing the fields, and therefore no setState-in-effect.
 *
 * Create mode edits every field. Edit mode fixes the category, period and
 * currency (the API's update only accepts a new amount and start date), showing
 * them read-only and leaving just the amount editable.
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
import {
  useCreateBudget,
  useUpdateBudget,
  type BudgetPeriod,
  type BudgetStatus,
} from '@/hooks/use-budgets';
import { useCategories } from '@/hooks/use-categories';
import { useSupportedCurrencies } from '@/hooks/use-currencies';
import { errorMessage } from '@/lib/errors';
import { isValidIsoDate, parseAmount, todayIso } from '@/lib/format';

const PERIODS: { value: BudgetPeriod; label: string }[] = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

export function BudgetSheet({
  target,
  onClose,
}: {
  /** The budget to edit, or null to create a new one. */
  target: BudgetStatus | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const editing = target !== null;

  const categories = useCategories();
  const currencies = useSupportedCurrencies();
  const create = useCreateBudget();
  const update = useUpdateBudget();

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState(target ? String(target.budgetAmountNative) : '');
  const [currency, setCurrency] = useState(target?.currency ?? '');
  const [period, setPeriod] = useState<BudgetPeriod>(target?.period ?? 'MONTHLY');
  const [startDate, setStartDate] = useState(todayIso());
  const [validationError, setValidationError] = useState<string | null>(null);

  const currencyOptions = currencies.data ?? [];
  const categoryOptions = categories.data ?? [];

  // An empty selection means "not chosen yet": fall back to the first loaded
  // option rather than syncing it in an effect.
  const effectiveCurrency = currency || currencyOptions[0]?.code || '';

  const busy = create.isPending || update.isPending;
  const mutationError = create.isError ? create.error : update.isError ? update.error : null;

  const submit = () => {
    const parsed = parseAmount(amount);
    if (parsed === null) {
      setValidationError('Enter an amount like 250.00.');
      return;
    }

    if (editing && target) {
      setValidationError(null);
      update.mutate({ id: target.budgetId, body: { amount: parsed } }, { onSuccess: onClose });
      return;
    }

    if (!effectiveCurrency) {
      setValidationError('Choose the currency this limit is set in.');
      return;
    }
    if (!isValidIsoDate(startDate)) {
      setValidationError('Starts must be a date like 2026-10-01.');
      return;
    }

    setValidationError(null);
    create.mutate(
      {
        // An empty selection means "no category" — an overall budget.
        categoryId: categoryId || null,
        amount: parsed,
        currency: effectiveCurrency,
        period,
        startDate,
      },
      { onSuccess: onClose },
    );
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
              {editing ? 'Edit budget' : 'Add budget'}
            </Text>

            {target ? (
              <>
                <ReadOnly label="Applies to" value={target.categoryName ?? 'All expenses'} />
                <ReadOnly
                  label="Period"
                  value={target.period === 'MONTHLY' ? 'Monthly' : 'Yearly'}
                />
                <ReadOnly label="Currency" value={target.currency} />
              </>
            ) : (
              <View style={styles.group}>
                <Text style={[text.bodyMedium, { color: theme.ink }]}>Applies to</Text>
                <Select
                  accessibilityLabel="Applies to"
                  value={categoryId}
                  onChange={setCategoryId}
                  hint="Leave as “All expenses” for an overall budget."
                  options={[
                    { value: '', label: 'All expenses' },
                    ...categoryOptions.map((option) => ({
                      value: option.id,
                      label: option.name,
                      dotColor: option.color,
                    })),
                  ]}
                />
              </View>
            )}

            <TextField
              label="Amount"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              editable={!busy}
            />

            {!target ? (
              <>
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
                  <Text style={[text.bodyMedium, { color: theme.ink }]}>Period</Text>
                  <SegmentedControl
                    label="Period"
                    options={PERIODS}
                    value={period}
                    onChange={setPeriod}
                  />
                </View>

                <TextField
                  label="Starts"
                  hint="Spend before this date is not counted"
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2026-10-01"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            ) : null}

            {validationError ? <ErrorNote message={validationError} /> : null}
            {mutationError ? (
              <ErrorNote message={errorMessage(mutationError) ?? 'Could not save the budget.'} />
            ) : null}

            <View style={styles.actions}>
              <Button label="Cancel" variant="secondary" onPress={onClose} />
              <Button
                label={editing ? 'Save' : 'Add budget'}
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

/** A field that cannot be changed in edit mode: a label above its value. */
function ReadOnly({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={styles.readonly}>
      <Text style={[text.caption, { color: theme.muted }]}>{label}</Text>
      <Text style={[text.bodyMedium, { color: theme.ink }]}>{value}</Text>
    </View>
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
  readonly: { gap: spacing.xs / 2 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
