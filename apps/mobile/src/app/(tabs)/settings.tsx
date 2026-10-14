import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ErrorNote, Spinner } from '@/components/ui/feedback';
import { AppPageHeader } from '@/components/ui/page-header';
import { layout, spacing, text } from '@/theme';
import { useSupportedCurrencies } from '@/hooks/use-currencies';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useUpdateProfile } from '@/hooks/use-user';
import { signOut } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

export default function SettingsScreen() {
  const theme = useTheme();
  const { user } = useSession();
  const currencies = useSupportedCurrencies();
  const updateProfile = useUpdateProfile();

  const [draftCurrency, setDraftCurrency] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const baseCurrency = user?.baseCurrency ?? null;
  // `null` means "untouched", so the save button tracks real divergence rather
  // than comparing against a value the user never edited.
  const selectedCurrency = draftCurrency ?? baseCurrency;
  const dirty = draftCurrency !== null && draftCurrency !== baseCurrency;

  const onSaveCurrency = useCallback(() => {
    if (draftCurrency === null) return;
    updateProfile.mutate(
      { baseCurrency: draftCurrency },
      { onSuccess: () => setDraftCurrency(null) },
    );
  }, [draftCurrency, updateProfile]);

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
        <Text style={[text.overline, { color: theme.muted }]}>BASE CURRENCY</Text>
        <Text style={[text.body, { color: theme.muted }]}>
          Reports and totals are converted into this currency.
        </Text>

        {currencies.isPending ? (
          <Spinner style={styles.spinner} />
        ) : currencies.isError ? (
          <ErrorNote message={errorMessage(currencies.error) ?? 'Could not load currencies.'} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {(currencies.data ?? []).map((currency) => (
              <Chip
                key={currency.code}
                label={`${currency.code} · ${currency.symbol}`}
                selected={currency.code === selectedCurrency}
                onPress={() => setDraftCurrency(currency.code)}
              />
            ))}
          </ScrollView>
        )}

        {updateProfile.isError ? (
          <ErrorNote message={errorMessage(updateProfile.error) ?? 'Could not save.'} />
        ) : null}

        <Button
          label="Save"
          onPress={onSaveCurrency}
          busy={updateProfile.isPending}
          disabled={!dirty}
        />
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
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
});
