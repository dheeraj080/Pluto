import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { IconSwap } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ErrorNote, Spinner } from '@/components/ui/feedback';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { borderWidth, radius, spacing, tabularNums, text } from '@/theme';
import { useCategories } from '@/hooks/use-categories';
import { useSupportedCurrencies } from '@/hooks/use-currencies';
import { usePair } from '@/hooks/use-pair';
import { useRateSnapshot } from '@/hooks/use-rates';
import { useTheme } from '@/hooks/use-theme';
import type { RecurrenceFrequency } from '@/hooks/use-recurring';
import { buildConversionPreview } from '@/lib/convert';
import { formatMoney, isValidIsoDate, parseAmount, todayIso } from '@/lib/format';

/** Validated values, ready to be sent as a create/update payload. */
export interface ExpenseDraft {
  amount: number;
  currency: string;
  categoryId: string;
  incurredOn: string;
  description?: string;
  paymentMethod?: string;
  /**
   * Present only when the user turned on "Repeat this expense" while creating
   * one. The API reads it as "record this expense and make it the first,
   * already-confirmed occurrence of a new rule".
   */
  recurrence?: {
    frequency: RecurrenceFrequency;
    interval: number;
    endDate?: string;
  };
}

export interface ExpenseFormInitial {
  amount?: number;
  currency?: string;
  categoryId?: string;
  incurredOn?: string;
  description?: string | null;
  paymentMethod?: string | null;
}

const PAYMENT_METHODS = ['CARD', 'CASH', 'UPI', 'OTHER'];

const FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

/**
 * The create/edit form.
 *
 * Group labels reuse `TextField`'s label treatment (`text-sm font-medium` in
 * ink) rather than the uppercase card-title style, so a chip group and a text
 * field read as the same kind of thing.
 *
 * The live conversion preview is display-only: it is computed from the public
 * ECB snapshot and never changes the amount that gets stored.
 */
export function ExpenseForm({
  initial,
  submitLabel,
  onSubmit,
  busy = false,
  submitError,
  defaultCurrency = 'USD',
  allowRecurrence = false,
}: {
  initial?: ExpenseFormInitial;
  submitLabel: string;
  onSubmit: (draft: ExpenseDraft) => void;
  busy?: boolean;
  /** Error from the write itself, e.g. a rejected category. */
  submitError?: string | null;
  defaultCurrency?: string;
  /**
   * Show the "Repeat this expense" toggle. Create-only: the update endpoint has
   * no recurrence field, so the edit screen leaves this off.
   */
  allowRecurrence?: boolean;
}) {
  const theme = useTheme();
  const categories = useCategories();
  const currencies = useSupportedCurrencies();
  const { base, second } = usePair();
  const snapshot = useRateSnapshot(base ?? undefined);

  const [amount, setAmount] = useState(
    initial?.amount === undefined ? '' : String(initial.amount),
  );
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [incurredOn, setIncurredOn] = useState(initial?.incurredOn ?? todayIso());
  const [description, setDescription] = useState(initial?.description ?? '');
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? '');
  const [repeat, setRepeat] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('MONTHLY');
  const [interval, setInterval] = useState('1');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const parsedAmount = parseAmount(amount);

  // The preview shows the recorded amount in its companion currency — home, or
  // the Second when the recorded currency already is home — so the form previews
  // the same pair a saved row will show.
  const companionCurrency =
    base && base !== currency ? base : second && second !== currency ? second : null;
  const companion =
    parsedAmount !== null && companionCurrency
      ? buildConversionPreview(parsedAmount, currency, companionCurrency, snapshot.data ?? null)
      : null;

  function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    const parsed = parseAmount(amount);

    if (parsed === null) {
      nextErrors.amount = 'Enter a positive amount with up to 2 decimals.';
    }
    if (!isValidIsoDate(incurredOn)) {
      nextErrors.incurredOn = 'Use a date like 2026-10-14.';
    }
    if (!categoryId) {
      nextErrors.categoryId = 'Choose a category.';
    }
    if (!/^[A-Za-z]{3}$/.test(currency.trim())) {
      nextErrors.currency = 'Use a 3-letter currency code.';
    }

    const step = Number(interval);
    const repeats = allowRecurrence && repeat;
    if (repeats && (!Number.isInteger(step) || step < 1 || step > 12)) {
      nextErrors.interval = 'Repeat every 1 to 12 periods.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || parsed === null) return;

    onSubmit({
      amount: parsed,
      currency: currency.trim().toUpperCase(),
      categoryId,
      incurredOn,
      description: description.trim() || undefined,
      paymentMethod: paymentMethod.trim() || undefined,
      ...(repeats ? { recurrence: { frequency, interval: step } } : {}),
    });
  }

  return (
    <View style={styles.form}>
      <View style={styles.row}>
        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          error={errors.amount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          editable={!busy}
          containerStyle={styles.rowItem}
        />

        <View style={[styles.group, styles.rowItem]}>
          <Text style={[text.bodyMedium, { color: theme.ink }]}>Currency</Text>

          {currencies.isPending ? (
            <Spinner style={styles.spinner} />
          ) : currencies.data && currencies.data.length > 0 ? (
            <Select
              accessibilityLabel="Currency"
              value={currency}
              onChange={setCurrency}
              options={currencies.data.map((item) => ({
                value: item.code,
                label: `${item.code} · ${item.symbol}`,
              }))}
            />
          ) : (
            // The currency list is a convenience; recording must not depend on it.
            <TextField
              label="Code"
              value={currency}
              onChangeText={(value) => setCurrency(value.toUpperCase())}
              autoCapitalize="characters"
              maxLength={3}
              error={errors.currency}
            />
          )}
        </View>
      </View>

      {companion ? (
        <View
          style={[
            styles.preview,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
        >
          <View style={styles.previewLine}>
            <IconSwap size={16} color={theme.primary} />
            <Text style={[text.body, { color: theme.muted }]}>≈</Text>
            <Text style={[text.bodyMedium, tabularNums, { color: theme.ink }]}>
              {formatMoney(companion.amount, companion.to)}
            </Text>
            <Text style={[text.body, { color: theme.muted }]}>in {companion.to}</Text>
          </View>
          <Text style={[text.caption, { color: theme.muted }]}>
            1 {companion.from} = {companion.rate.toFixed(4)} {companion.to} · {companion.provider}{' '}
            {companion.effectiveDate}
          </Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={[styles.group, styles.rowItem]}>
          <Text style={[text.bodyMedium, { color: theme.ink }]}>Category</Text>

          {categories.isPending ? (
            <Spinner style={styles.spinner} />
          ) : categories.isError ? (
            <ErrorNote message="Could not load categories. Pull to refresh and try again." />
          ) : (
            <Select
              accessibilityLabel="Category"
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Choose a category"
              options={(categories.data ?? []).map((category) => ({
                value: category.id,
                label: category.name,
                dotColor: category.color,
              }))}
              error={errors.categoryId}
            />
          )}
        </View>

        <TextField
          label="Date"
          value={incurredOn}
          onChangeText={setIncurredOn}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.incurredOn}
          containerStyle={styles.rowItem}
        />
      </View>

      <View style={styles.row}>
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional note"
          maxLength={280}
          containerStyle={styles.rowItem}
        />

        <View style={[styles.group, styles.rowItem]}>
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
      </View>

      {allowRecurrence ? (
        <View style={styles.group}>
          <View style={styles.repeatRow}>
            <Text style={[text.bodyMedium, { color: theme.ink }]}>Repeat this expense</Text>
            <Chip
              label={repeat ? 'Repeating' : 'Off'}
              selected={repeat}
              onPress={() => setRepeat((value) => !value)}
            />
          </View>

          {repeat ? (
            <>
              <Text style={[text.caption, { color: theme.muted }]}>
                This expense is saved now, and the schedule below produces future occurrences to
                confirm.
              </Text>
              <SegmentedControl
                label="Frequency"
                options={FREQUENCIES}
                value={frequency}
                onChange={setFrequency}
              />
              <TextField
                label="Every"
                hint="Periods between occurrences (1 = every period)."
                value={interval}
                onChangeText={setInterval}
                keyboardType="number-pad"
                error={errors.interval}
                editable={!busy}
              />
            </>
          ) : null}
        </View>
      ) : null}

      {submitError ? <ErrorNote message={submitError} /> : null}

      <Button label={submitLabel} onPress={handleSubmit} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  group: { gap: spacing.sm },
  spinner: { alignSelf: 'flex-start' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  rowItem: {
    flex: 1,
    minWidth: 0,
  },
  preview: {
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
  },
  previewLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
