/**
 * "Today's rate", with the controls the Pair actually needs.
 *
 * The former `RateLine` card showed the figure but gave no way to act on it;
 * flipping Home ⇄ Second meant a detour to Settings. This card puts the swap
 * beside the quote, and a link to Settings where either half of the Pair can be
 * changed, so the dashboard's dual-currency surface is self-contained.
 *
 * Still renders nothing until both currencies exist, which keeps the dashboard
 * free of a "choose currencies" invitation competing with the rest.
 */

import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { DashboardCard } from '@/components/dashboard/card';
import { Button } from '@/components/ui/button';
import { IconSettings, IconSwap } from '@/components/icons';
import { spacing, tabularNums, text } from '@/theme';
import { usePair } from '@/hooks/use-pair';
import { useTheme } from '@/hooks/use-theme';
import { rateBetween, type RateSnapshot } from '@/lib/convert';
import { formatAsOf } from '@/lib/format';

export function PairCard({
  base,
  second,
  snapshot,
  loading,
}: {
  base: string | null;
  second: string | null;
  snapshot: RateSnapshot | null;
  loading: boolean;
}) {
  const theme = useTheme();
  const { swap, savingBase } = usePair();

  if (!base || !second) return null;

  const rate = snapshot ? rateBetween(base, second, snapshot.rates) : null;

  return (
    <DashboardCard
      title="Today's rate"
      skeletonHeight={88}
      loading={loading && !snapshot}
      action={
        snapshot ? (
          <Text style={[text.caption, { color: theme.muted }]}>
            {snapshot.provider}, {formatAsOf(snapshot.effectiveDate)}
          </Text>
        ) : undefined
      }
    >
      <Text style={[text.bodyMedium, { color: theme.ink }]}>
        1 {base} ={' '}
        <Text style={[text.bodyMedium, tabularNums, { color: theme.primary }]}>
          {rate == null ? '—' : rateDigits(rate)}
        </Text>{' '}
        {second}
      </Text>

      <View style={styles.actions}>
        <Button
          label={`Swap to ${second} home`}
          variant="secondary"
          size="sm"
          icon={(color) => <IconSwap size={16} color={color} />}
          onPress={swap}
          busy={savingBase}
        />
        <Button
          label="Change pair"
          variant="ghost"
          size="sm"
          icon={(color) => <IconSettings size={16} color={color} />}
          onPress={() => router.push('/settings')}
        />
      </View>
    </DashboardCard>
  );
}

/** Two decimals for a large quote, four for a small one. */
function rateDigits(rate: number): string {
  return rate.toFixed(rate >= 100 ? 2 : 4);
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
