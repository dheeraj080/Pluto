import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorNote, Spinner } from '@/components/ui/feedback';
import { AppPageHeader } from '@/components/ui/page-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Select } from '@/components/ui/select';
import { IconSwap, IconTag } from '@/components/icons';
import { borderWidth, layout, radius, spacing, tabularNums, text } from '@/theme';
import { useSupportedCurrencies } from '@/hooks/use-currencies';
import { usePair } from '@/hooks/use-pair';
import { useRateSnapshot } from '@/hooks/use-rates';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/hooks/use-theme-preference';
import { signOut } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { writeThemePreference, type ThemePreference } from '@/lib/theme-preference';

/** The illustrative amount used for the live pair preview. */
const SAMPLE = 100;

/** Appearance options for the segmented control. */
const APPEARANCE_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Settings: the account, and the one place the currency Pair is defined.
 *
 * The Home currency drives aggregation and lives on the server profile; the
 * Second is a display companion kept on the device. Both are edited through
 * `usePair` — the same source of truth every other screen reads — so a change
 * here is reflected immediately, without a "save" step or a round-trip for the
 * second half.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const themePreference = useThemePreference();
  const { user } = useSession();
  const currencies = useSupportedCurrencies();
  const { base, second, setBase, setSecond, swap, savingBase, baseError } = usePair();

  const [signingOut, setSigningOut] = useState(false);

  const options = useMemo(
    () => [...(currencies.data ?? [])].sort((a, b) => a.code.localeCompare(b.code)),
    [currencies.data],
  );

  /** Dropdown options for a currency, matching the chip labels ("USD · $"). */
  const currencyOptions = useMemo(
    () =>
      options.map((currency) => ({
        value: currency.code,
        label: `${currency.code} · ${currency.symbol}`,
      })),
    [options],
  );

  /** The Second can be cleared, so it leads with a "None" entry. */
  const secondOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...currencyOptions.filter((option) => option.value !== base),
    ],
    [currencyOptions, base],
  );

  // Rates are quoted against the base, so ask for the base snapshot directly.
  const snapshot = useRateSnapshot(base ?? undefined);
  const rate = second && snapshot.data ? Number(snapshot.data.rates[second]) : Number.NaN;

  const onSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      // Navigation follows the session: the tab layout redirects once the
      // store flips to signed-out, so there is nothing to push here.
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.canvas }]}
      contentContainerStyle={styles.content}
    >
      <AppPageHeader title="Settings" subtitle="Your account and preferences." />

      <Card>
        <Text style={[text.overline, { color: theme.muted }]}>SIGNED IN AS</Text>
        <Text numberOfLines={1} style={[text.bodyStrong, { color: theme.ink }]}>
          {user?.name ?? 'Pluto user'}
        </Text>
        <Text numberOfLines={1} style={[text.body, { color: theme.muted }]}>
          {user?.email ?? '—'}
        </Text>
      </Card>

      <Card>
        <Text style={[text.overline, { color: theme.muted }]}>MANAGE</Text>
        <Text style={[text.body, { color: theme.muted }]}>
          Configure your categories for grouping expenses and reports.
        </Text>
        <Button
          label="Manage categories"
          variant="secondary"
          icon={(color) => <IconTag size={16} color={color} />}
          onPress={() => router.push('/categories')}
        />
      </Card>

      <Card>
        <Text style={[text.overline, { color: theme.muted }]}>APPEARANCE</Text>
        <Text style={[text.body, { color: theme.muted }]}>
          Follow your device, or pin a light or dark theme on this device.
        </Text>
        <SegmentedControl
          label="Appearance"
          options={APPEARANCE_OPTIONS}
          value={themePreference}
          onChange={writeThemePreference}
        />
      </Card>

      <Card>
        <Text style={[text.overline, { color: theme.muted }]}>DISPLAY CURRENCIES</Text>
        <Text style={[text.body, { color: theme.muted }]}>
          Every amount is shown in two currencies: a Home currency, which totals are converted
          into, and a Second, which each figure is re-expressed in.
        </Text>

        {currencies.isPending ? (
          <Spinner style={styles.spinner} />
        ) : currencies.isError ? (
          <ErrorNote message={errorMessage(currencies.error) ?? 'Could not load currencies.'} />
        ) : (
          <>
            <View style={styles.fieldLabel}>
              <Text style={[text.captionStrong, { color: theme.muted }]}>HOME</Text>
              {savingBase ? <Spinner size="small" /> : null}
            </View>
            <Select
              accessibilityLabel="Home currency"
              value={base ?? ''}
              onChange={setBase}
              options={currencyOptions}
            />

            <Button
              label="Swap"
              variant="secondary"
              icon={(color) => <IconSwap size={16} color={color} />}
              onPress={swap}
              disabled={!base || !second}
              style={styles.swap}
            />

            <Text style={[text.captionStrong, { color: theme.muted }]}>SECOND</Text>
            <Select
              accessibilityLabel="Second currency"
              value={second ?? ''}
              onChange={(value) => setSecond(value === '' ? null : value)}
              options={secondOptions}
            />
          </>
        )}

        {baseError ? (
          <ErrorNote message={errorMessage(baseError) ?? 'Could not save.'} />
        ) : null}

        {base && second ? (
          <View
            style={[
              styles.preview,
              { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
            ]}
          >
            <Text style={[text.overline, { color: theme.muted }]}>PREVIEW</Text>
            <View style={styles.previewLine}>
              <Text style={[text.subtitle, tabularNums, { color: theme.ink }]}>
                {formatMoney(SAMPLE, base)}
              </Text>
              {Number.isFinite(rate) ? (
                <Text style={[text.body, tabularNums, { color: theme.muted }]}>
                  · {formatMoney(SAMPLE * rate, second)}
                </Text>
              ) : null}
            </View>
            {Number.isFinite(rate) ? (
              <Text style={[text.caption, { color: theme.muted }]}>
                1 {base} = {rate.toFixed(4)} {second}, at the latest published rate.
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>

      <Card>
        <Text style={[text.overline, { color: theme.muted }]}>SESSION</Text>
        <Text style={[text.body, { color: theme.muted }]}>
          Signing out removes this device&apos;s stored session. Your expenses stay on the server.
        </Text>
        <Button
          label="Sign out"
          variant="secondary"
          onPress={() => void onSignOut()}
          busy={signingOut}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: layout.gutter,
    paddingBottom: layout.tabBarInset + spacing.xl,
    gap: spacing.lg,
  },
  spinner: { alignSelf: 'flex-start' },
  fieldLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swap: { alignSelf: 'flex-start' },
  preview: {
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
  },
  previewLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
});
