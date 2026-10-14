import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useCategories } from '@/hooks/use-categories';
import { useSupportedCurrencies } from '@/hooks/use-currencies';
import { isValidIsoDate, parseAmount, todayIso } from '@/lib/format';

/** Validated values, ready to be sent as a create/update payload. */
export interface ExpenseDraft {
  amount: number;
  currency: string;
  categoryId: string;
  incurredOn: string;
  description?: string;
  paymentMethod?: string;
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

export function ExpenseForm({
  initial,
  submitLabel,
  onSubmit,
  busy = false,
  submitError,
  defaultCurrency = 'USD',
}: {
  initial?: ExpenseFormInitial;
  submitLabel: string;
  onSubmit: (draft: ExpenseDraft) => void;
  busy?: boolean;
  /** Error from the write itself, e.g. a rejected category. */
  submitError?: string | null;
  defaultCurrency?: string;
}) {
  const categories = useCategories();
  const currencies = useSupportedCurrencies();

  const [amount, setAmount] = useState(
    initial?.amount === undefined ? '' : String(initial.amount),
  );
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [incurredOn, setIncurredOn] = useState(initial?.incurredOn ?? todayIso());
  const [description, setDescription] = useState(initial?.description ?? '');
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    const parsedAmount = parseAmount(amount);

    if (parsedAmount === null) {
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

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || parsedAmount === null) return;

    onSubmit({
      amount: parsedAmount,
      currency: currency.trim().toUpperCase(),
      categoryId,
      incurredOn,
      description: description.trim() || undefined,
      paymentMethod: paymentMethod.trim() || undefined,
    });
  }

  return (
    <View style={styles.form}>
      <TextField
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        error={errors.amount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        editable={!busy}
      />

      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Currency
        </ThemedText>

        {currencies.isPending ? (
          <ActivityIndicator style={styles.inlineSpinner} />
        ) : currencies.data && currencies.data.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {currencies.data.map((item) => (
              <Chip
                key={item.code}
                label={item.code}
                selected={item.code === currency}
                onPress={() => setCurrency(item.code)}
              />
            ))}
          </ScrollView>
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

      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Category
        </ThemedText>

        {categories.isPending ? (
          <ActivityIndicator style={styles.spinner} />
        ) : categories.isError ? (
          <ThemedText type="small" themeColor="danger">
            Could not load categories. Pull to refresh and try again.
          </ThemedText>
        ) : (
          <View style={styles.wrapRow}>
            {(categories.data ?? []).map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                dotColor={category.color}
                selected={category.id === categoryId}
                onPress={() => setCategoryId(category.id)}
              />
            ))}
          </View>
        )}

        {errors.categoryId ? (
          <ThemedText type="small" themeColor="danger">
            {errors.categoryId}
          </ThemedText>
        ) : null}
      </View>

      <TextField
        label="Date"
        value={incurredOn}
        onChangeText={setIncurredOn}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.incurredOn}
      />

      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Optional note"
        maxLength={280}
      />

      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Payment method
        </ThemedText>
        <View style={styles.wrapRow}>
          {PAYMENT_METHODS.map((method) => (
            <Chip
              key={method}
              label={method}
              selected={paymentMethod === method}
              // Tapping the selected chip clears it: the field is optional.
              onPress={() => setPaymentMethod(method === paymentMethod ? '' : method)}
            />
          ))}
        </View>
      </View>

      {submitError ? (
        <ThemedText type="small" themeColor="danger">
          {submitError}
        </ThemedText>
      ) : null}

      <Button label={submitLabel} onPress={handleSubmit} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.four },
  field: { gap: Spacing.one },
  group: { gap: Spacing.two },
  chipRow: { gap: Spacing.two, paddingRight: Spacing.four },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  spinner: { alignSelf: 'flex-start' },
  inlineSpinner: { alignSelf: 'flex-start' },
});
