/**
 * "Rate & converter": today's rate, and what X is worth.
 *
 * The headline rate with its source and date, plus a single-row converter —
 * input, swap, output. A 30-day rate line appears only when at least a month of
 * published history exists; with less it shows nothing rather than an empty
 * chart, because half a month of points says nothing about a trend.
 */

import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Sparkline } from '@/components/charts';
import { DashboardCard } from '@/components/dashboard/card';
import { Button } from '@/components/ui/button';
import { IconSwap } from '@/components/icons';
import { borderWidth, controlHeight, radius, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { rateBetween, type RateSnapshot } from '@/lib/convert';
import { formatAsOf, formatMoney } from '@/lib/format';
import type { RateHistory } from '@/hooks/use-rates';

const MIN_HISTORY_POINTS = 30;

export function RateCard({
  snapshot,
  base,
  second,
  history,
  loading,
}: {
  snapshot: RateSnapshot | null;
  base: string | null;
  second: string | null;
  history: RateHistory | null;
  loading: boolean;
}) {
  const theme = useTheme();
  const [swapped, setSwapped] = useState(false);
  const [amount, setAmount] = useState('100');

  if (!base || !second) {
    return (
      <DashboardCard title="Rate & converter">
        <View style={styles.invite}>
          <Text style={[text.body, { color: theme.muted }]}>
            Choose a second currency to see today&rsquo;s rate and convert amounts.
          </Text>
          <Button label="Choose currencies" variant="secondary" onPress={() => router.push('/settings')} />
        </View>
      </DashboardCard>
    );
  }

  const headlineRate = snapshot ? rateBetween(base, second, snapshot.rates) : null;
  const from = swapped ? second : base;
  const to = swapped ? base : second;
  const rate = snapshot ? rateBetween(from, to, snapshot.rates) : null;
  const parsed = Number(amount.replace(',', '.'));
  const result = rate != null && Number.isFinite(parsed) ? parsed * rate : null;

  const points = (history?.points ?? []).map((point) => point.rate);

  return (
    <DashboardCard title="Rate & converter" skeletonHeight={150} loading={loading && !snapshot}>
      <Text style={[text.bodyMedium, { color: theme.ink }]}>
        1 {base} ={' '}
        <Text style={[text.bodyMedium, { color: theme.primary, fontVariant: ['tabular-nums'] }]}>
          {headlineRate == null ? '—' : rateDigits(headlineRate)}
        </Text>{' '}
        {second}
      </Text>

      {snapshot ? (
        <Text style={[text.caption, { color: theme.muted }]}>
          {snapshot.provider}, {formatAsOf(snapshot.effectiveDate)}
        </Text>
      ) : null}

      <View style={styles.converter}>
        <View
          style={[
            styles.field,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
        >
          <TextInput
            value={amount}
            onChangeText={setAmount}
            inputMode="decimal"
            accessibilityLabel={`Amount in ${from}`}
            style={[text.bodyMedium, styles.input, { color: theme.ink }]}
          />
          <Text style={[text.captionMedium, { color: theme.muted }]}>{from}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Swap currencies"
          onPress={() => setSwapped((value) => !value)}
          style={({ pressed }) => [
            styles.swap,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <IconSwap size={14} color={theme.muted} />
        </Pressable>

        <View style={[styles.field, styles.output, { backgroundColor: theme.surfaceMuted }]}>
          <Text
            numberOfLines={1}
            accessibilityLiveRegion="polite"
            style={[text.bodyMedium, styles.input, { color: theme.ink }]}
          >
            {result == null ? '—' : formatMoney(result, to)}
          </Text>
          <Text style={[text.captionMedium, { color: theme.muted }]}>{to}</Text>
        </View>
      </View>

      {points.length >= MIN_HISTORY_POINTS ? (
        <View style={[styles.history, { borderTopColor: theme.border }]}>
          <Text style={[text.overline, { color: theme.muted }]}>LAST 30 DAYS</Text>
          <Sparkline values={points} height={34} style={styles.spark} />
        </View>
      ) : null}
    </DashboardCard>
  );
}

/** Two decimals for a large quote, four for a small one. */
function rateDigits(rate: number): string {
  return rate.toFixed(rate >= 100 ? 2 : 4);
}

const styles = StyleSheet.create({
  invite: { alignItems: 'flex-start', gap: spacing.md },
  converter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    height: controlHeight.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
  },
  output: { borderColor: 'transparent' },
  input: { flex: 1, padding: 0 },
  swap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: borderWidth.hairline,
  },
  history: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: borderWidth.hairline,
    gap: spacing.xs,
  },
  spark: { marginTop: spacing.xs },
});
