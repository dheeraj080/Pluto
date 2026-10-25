import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, SafeAreaView, } from 'react-native';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { useRateSnapshot } from '@/hooks/use-rates';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePair } from '@/hooks/use-pair';

import { formatMoney } from '@/lib/format';
import { readOnboardingCompleted, writeOnboardingCompleted } from '@/lib/session-storage';
import { useSupportedCurrencies } from '@/hooks/use-currencies';
import { Wordmark } from '@/components/logo';
import { text, fontSize, spacing } from '@/theme';

export default function CurrencyScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { status, user } = useSession();
  const currencies = useSupportedCurrencies();
  const { base: currentBase, second: currentSecond, setBase, setSecond } = usePair();
  const insets = useSafeAreaInsets();

  const [base, setBaseState] = useState(currentBase ?? 'USD');
  const [second, setSecondState] = useState<string | undefined>(currentSecond ?? '');

  const options = useMemo(
    () => [...(currencies.data ?? [])].sort((a, b) => a.code.localeCompare(b.code)),
    [currencies.data],
  );

  const currencyOptions = useMemo(
    () => options.map((currency) => ({
      value: currency.code,
      label: `${currency.code} · ${currency.symbol}`,
    })),
    [options],
  );

  // Resolve the stable code for the query key (never busts cache on change)
  const code = (base ?? user?.baseCurrency ?? 'USD').toUpperCase();

  const snapshot = useRateSnapshot(code);
  const rate = second && snapshot.data ? Number(snapshot.data.rates[second] ?? 0) : Number.NaN;

  const onContinue = useCallback(async () => {
    await setBase(base ?? 'USD');
    if (second && second === base) {
      await setSecond('');
    } else {
      await setSecond(second ?? '');
    }
    await writeOnboardingCompleted(true);
    router.push('/onboarding/categories' as any);
  }, [base, second, setBase, setSecond]);

  const secondIsSet = second && second !== '';
  const hasBase = (base ?? '').length > 0;

  // Format math helper
  const formatMath = (rate: number, currency: string): string => {
    return (rate * 100).toFixed(4);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Pick your home currency</Text>
        <Text style={styles.sub}>
          All totals and budgets are shown in this currency. Amounts in other currencies
          will be converted to it.
        </Text>

        <View style={styles.separator} />

        <Card style={styles.card}>
          <View style={styles.cardContent}>
            <Wordmark size={24} style={styles.wordmark} />

            <Text style={styles.label}>Home currency</Text>

            <Select
              accessibilityLabel="Home currency"
              value={base ?? ''}
              onChange={(value) => setBaseState(value ?? '')}
              options={currencyOptions}
            />

            {second && snapshot.data && (
              <Text style={styles.preview}>100 {base} = {formatMath(rate, second ?? '')}</Text>
            )}
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardContent}>
            <Text style={styles.label}>Second currency (optional)</Text>
            <Text style={styles.caption}>
              Each expense figure will also appear in this currency.
            </Text>

            <Select
              accessibilityLabel="Second currency"
              value={second ? second : ''}
              onChange={(value) => {
                const v = value ?? '';
                setSecondState(v);
              }}
              options={[
                { value: '', label: 'None' },
                ...currencyOptions.filter((opt) => opt.value !== base),
              ]}
            />
          </View>
        </Card>

        <View style={styles.separator} />

        <Button
          label="Continue to categories"
          onPress={onContinue}
          disabled={!hasBase}
          style={styles.continueButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  content: { gap: 24 },
  separator: { height: 1, width: '100%', backgroundColor: '#e0e0e0', marginVertical: spacing.lg },

  card: { padding: 16, width: '100%' },

  cardContent: { gap: 12 },

  title: { fontSize: 18, fontWeight: '600', color: '#222222' },
  sub: { fontSize: 14, color: '#666666' },

  label: { fontSize: 14, color: '#666666' },
  caption: { fontSize: 12, color: '#666666' },

  wordmark: { marginBottom: spacing.xs },

  preview: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    color: '#666666',
    fontStyle: 'italic',
  },

  continueButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#0066ff',
  },
});