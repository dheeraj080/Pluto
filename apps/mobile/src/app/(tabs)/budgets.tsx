import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ConversionNote } from '@/components/ui/conversion-note';
import { Divider } from '@/components/ui/divider';
import { EmptyState, ErrorNote, Skeleton } from '@/components/ui/feedback';
import { AppPageHeader } from '@/components/ui/page-header';
import { TextField } from '@/components/ui/text-field';
import { IconArrowLeft, IconArrowRight } from '@/components/icons';
import { borderWidth, layout, radius, spacing, text } from '@/theme';
import {
  useBudgetStatus,
  useCreateBudget,
  useDeleteBudget,
  type BudgetPeriod,
  type BudgetStatus,
} from '@/hooks/use-budgets';
import { useCategories } from '@/hooks/use-categories';
import { useSupportedCurrencies } from '@/hooks/use-currencies';
import { usePair } from '@/hooks/use-pair';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/lib/errors';
import {
  currentMonth,
  formatMoney,
  formatMonth,
  formatPercent,
  isValidIsoDate,
  parseAmount,
  todayIso,
} from '@/lib/format';
import { shiftMonth } from '@/lib/ranges';

const PERIODS: { value: BudgetPeriod; label: string }[] = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

/**
 * Budgets: limits per category or for the whole account, with the current month
 * tracking against each one.
 *
 * Progress is a thin mint line that turns soft amber when a budget is exceeded —
 * never red, because going over a budget is information, not an error.
 *
 * One request covers every row: the status payload carries each budget's id, so
 * this screen never fetches the budget list as well.
 */
export default function BudgetsScreen() {
  const theme = useTheme();
  const { base, second } = usePair();

  const [month, setMonth] = useState(currentMonth());
  const categories = useCategories();
  const currencies = useSupportedCurrencies();
  const status = useBudgetStatus({
    month,
    base: base ?? undefined,
    secondary: second ?? undefined,
  });
  const create = useCreateBudget();
  const remove = useDeleteBudget();

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [period, setPeriod] = useState<BudgetPeriod>('MONTHLY');
  const [startDate, setStartDate] = useState(todayIso());
  const [validationError, setValidationError] = useState<string | null>(null);

  const currencyOptions = currencies.data ?? [];
  const categoryOptions = categories.data ?? [];

  // An empty selection means "not chosen yet": fall back to the first loaded
  // option rather than syncing it in an effect.
  const effectiveCurrency = currency || currencyOptions[0]?.code || '';
  const baseCurrency = status.data?.baseCurrency ?? base ?? 'USD';
  const secondCurrency = status.data?.secondaryCurrency ?? second;

  const items = status.data?.items ?? [];

  const submit = useCallback(() => {
    const parsed = parseAmount(amount);
    if (parsed === null) {
      setValidationError('Enter an amount like 250.00.');
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
      { onSuccess: () => setAmount('') },
    );
  }, [amount, categoryId, create, effectiveCurrency, period, startDate]);

  const confirmDelete = useCallback(
    (item: BudgetStatus) => {
      const label = item.categoryName ?? 'all expenses';
      Alert.alert(
        `Delete the budget for ${label}?`,
        'The expenses behind it are not affected.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => remove.mutate(item.budgetId),
          },
        ],
      );
    },
    [remove],
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <AppPageHeader title="Budgets" subtitle="Limits and how this month tracks against them" />

      {/* The one range control: which month every row below is evaluated for. */}
      <View style={[styles.monthRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <MonthStep
          direction="previous"
          onPress={() => setMonth((value) => shiftMonth(value, -1))}
        />
        <Text style={[text.bodyStrong, { color: theme.ink }]}>{formatMonth(month)}</Text>
        <MonthStep direction="next" onPress={() => setMonth((value) => shiftMonth(value, 1))} />
      </View>

      <ConversionNote
        status={status.data?.conversionStatus}
        unconvertedCurrencies={status.data?.unconvertedCurrencies ?? []}
      />
      {status.isError ? (
        <ErrorNote message={errorMessage(status.error) ?? 'Could not load budgets.'} />
      ) : null}

      <Card>
        <View style={styles.cardHead}>
          <Text style={[text.overline, { color: theme.muted }]}>PROGRESS</Text>
          <Text style={[text.caption, { color: theme.muted }]}>
            {status.data?.month ? formatMonth(status.data.month) : formatMonth(month)}
          </Text>
        </View>

        {status.isPending ? (
          <View style={styles.skeletons}>
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} height={64} style={styles.skeleton} />
            ))}
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            title="No budgets yet"
            message="Add a budget to start tracking spending against a limit."
          />
        ) : (
          items.map((item, index) => (
            <View key={item.budgetId}>
              {index > 0 ? <Divider /> : null}
              <BudgetRow
                item={item}
                baseCurrency={baseCurrency}
                secondCurrency={secondCurrency}
                onRemove={() => confirmDelete(item)}
                busy={remove.isPending && remove.variables === item.budgetId}
              />
            </View>
          ))
        )}
      </Card>

      {remove.isError ? (
        <ErrorNote message={errorMessage(remove.error) ?? 'Could not delete the budget.'} />
      ) : null}

      <Card>
        <View style={styles.cardHead}>
          <Text style={[text.overline, { color: theme.muted }]}>ADD BUDGET</Text>
          <Text style={[text.caption, { color: theme.muted }]}>
            A limit per category, or one overall limit.
          </Text>
        </View>

        <View style={styles.group}>
          <Text style={[text.bodyMedium, { color: theme.ink }]}>Applies to</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label="All expenses" selected={categoryId === ''} onPress={() => setCategoryId('')} />
            {categoryOptions.map((option) => (
              <Chip
                key={option.id}
                label={option.name}
                dotColor={option.color}
                selected={categoryId === option.id}
                onPress={() => setCategoryId(option.id)}
              />
            ))}
          </ScrollView>
          <Text style={[text.caption, { color: theme.muted }]}>
            Leave as “All expenses” for an overall budget.
          </Text>
        </View>

        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
          editable={!create.isPending}
        />

        <View style={styles.group}>
          <Text style={[text.bodyMedium, { color: theme.ink }]}>Currency</Text>
          {currencyOptions.length === 0 ? (
            <Text style={[text.caption, { color: theme.muted }]}>Loading currencies…</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {currencyOptions.map((option) => (
                <Chip
                  key={option.code}
                  label={option.code}
                  selected={option.code === effectiveCurrency}
                  onPress={() => setCurrency(option.code)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.group}>
          <Text style={[text.bodyMedium, { color: theme.ink }]}>Period</Text>
          <View style={styles.chipRow}>
            {PERIODS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={option.value === period}
                onPress={() => setPeriod(option.value)}
              />
            ))}
          </View>
        </View>

        <TextField
          label="Starts"
          hint="Spend before this date is not counted"
          value={startDate}
          onChangeText={setStartDate}
          placeholder="2026-10-01"
          autoCapitalize="none"
          autoCorrect={false}
          error={validationError && !isValidIsoDate(startDate) ? validationError : undefined}
        />

        {validationError && isValidIsoDate(startDate) ? (
          <ErrorNote message={validationError} />
        ) : null}
        {create.isError ? (
          <ErrorNote message={errorMessage(create.error) ?? 'Could not save the budget.'} />
        ) : null}

        <Button label="Add budget" onPress={submit} busy={create.isPending} />
      </Card>
    </ScrollView>
  );
}

/**
 * One budget: what it applies to, how much of it is used, and the bar.
 *
 * The bar is two flex children rather than a percentage width — React Native's
 * `DimensionValue` does not accept a computed `string`, and flex ratios are
 * exact here because the only other child is the remainder.
 */
function BudgetRow({
  item,
  baseCurrency,
  secondCurrency,
  onRemove,
  busy,
}: {
  item: BudgetStatus;
  baseCurrency: string;
  secondCurrency: string | null;
  onRemove: () => void;
  busy: boolean;
}) {
  const theme = useTheme();

  const filled = Math.min(100, Math.max(0, item.percentage));
  const over = item.overBudget;
  const secondSpent = item.secondarySpent ?? null;
  const secondRemaining = item.secondaryRemaining ?? null;
  const secondLimit = item.secondaryBudgetAmount ?? null;

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.rowInfo}>
          <View style={styles.rowTitle}>
            {item.color ? <View style={[styles.dot, { backgroundColor: item.color }]} /> : null}
            <Text numberOfLines={1} style={[text.bodyMedium, { color: theme.ink }]}>
              {item.categoryName ?? 'All expenses'}
            </Text>
            <Text style={[text.caption, { color: theme.muted }]}>
              {item.period === 'MONTHLY' ? 'monthly' : 'yearly'}
            </Text>
          </View>

          <View style={styles.tags}>
            {!item.applied ? <Badge label="not yet active" /> : null}
            {over ? <Badge label="over budget" tone="warning" /> : null}
            {item.ratePolicy === 'estimate' ? <Badge label="estimated" /> : null}
            {item.conversionStatus === 'unavailable' ? (
              <Badge label="rates unavailable" tone="warning" />
            ) : null}
          </View>

          <Text style={[text.caption, { color: theme.muted }]}>
            <Text style={{ color: theme.ink }}>
              {formatMoney(Math.abs(item.remaining), baseCurrency)}
            </Text>
            {secondRemaining !== null && secondCurrency
              ? ` · ${formatMoney(Math.abs(secondRemaining), secondCurrency)}`
              : ''}
            {` ${over ? 'over' : 'left'} · ${formatPercent(item.percentage)} used`}
          </Text>
        </View>

        <View style={styles.rowAmount}>
          <Text style={[text.bodyMedium, { color: theme.ink }]}>
            {formatMoney(item.spent, baseCurrency)}
          </Text>
          {secondSpent !== null && secondCurrency ? (
            <Text style={[text.caption, { color: theme.muted }]}>
              {formatMoney(secondSpent, secondCurrency)}
            </Text>
          ) : null}
          <Text style={[text.caption, { color: theme.muted }]}>
            of {formatMoney(item.budgetAmount, baseCurrency)}
            {secondLimit !== null && secondCurrency
              ? ` · ${formatMoney(secondLimit, secondCurrency)}`
              : ''}
          </Text>
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: theme.surfaceMuted }]}>
        <View
          style={[
            styles.fill,
            { flex: filled, backgroundColor: over ? theme.warning : theme.primary },
          ]}
        />
        <View style={{ flex: 100 - filled }} />
      </View>

      <View style={styles.rowActions}>
        <Button label="Remove" variant="ghost" size="sm" onPress={onRemove} busy={busy} />
      </View>
    </View>
  );
}

/**
 * A one-month step. A plain `Pressable` rather than the `Button` primitive,
 * whose label is required — an icon-only control should carry its name in the
 * accessibility label instead of an empty string.
 */
function MonthStep({
  direction,
  onPress,
}: {
  direction: 'previous' | 'next';
  onPress: () => void;
}) {
  const theme = useTheme();
  const Glyph = direction === 'previous' ? IconArrowLeft : IconArrowRight;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === 'previous' ? 'Previous month' : 'Next month'}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.monthStep,
        pressed && { backgroundColor: theme.surfaceMuted },
      ]}
    >
      <Glyph size={18} color={theme.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: layout.gutter,
    paddingBottom: layout.tabBarInset + spacing.xl,
    gap: spacing.lg,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
  },
  cardHead: { gap: spacing.xs / 2 },
  monthStep: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletons: { gap: spacing.sm },
  skeleton: { borderRadius: radius.lg },
  group: { gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { gap: spacing.sm, paddingVertical: spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  rowInfo: { flex: 1, gap: spacing.xs },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowAmount: { alignItems: 'flex-end', gap: spacing.xs / 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  dot: { width: 9, height: 9, borderRadius: radius.pill },
  track: {
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { borderRadius: radius.pill },
  rowActions: { alignItems: 'flex-end' },
});
