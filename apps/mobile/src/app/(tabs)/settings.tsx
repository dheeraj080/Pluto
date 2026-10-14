import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useSupportedCurrencies } from '@/hooks/use-currencies';
import { useSession } from '@/hooks/use-session';
import { useUpdateProfile } from '@/hooks/use-user';
import { signOut } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

export default function SettingsScreen() {
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
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            SIGNED IN AS
          </ThemedText>
          <ThemedText type="smallBold" numberOfLines={1}>
            {user?.name ?? 'Pluto user'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {user?.email ?? '—'}
          </ThemedText>
        </View>

        <View style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            BASE CURRENCY
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Reports and totals are converted into this currency.
          </ThemedText>

          {currencies.isPending ? (
            <ActivityIndicator style={styles.spinner} />
          ) : currencies.isError ? (
            <ThemedText type="small" themeColor="danger">
              {errorMessage(currencies.error)}
            </ThemedText>
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
            <ThemedText type="small" themeColor="danger">
              {errorMessage(updateProfile.error)}
            </ThemedText>
          ) : null}

          <Button
            label="Save"
            onPress={onSaveCurrency}
            busy={updateProfile.isPending}
            disabled={!dirty}
          />
        </View>

        <View style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            SESSION
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Signing out removes this device&apos;s stored session. Your expenses stay on the server.
          </ThemedText>
          <Button
            label="Sign out"
            variant="secondary"
            onPress={() => void onSignOut()}
            busy={signingOut}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  card: { gap: Spacing.two },
  spinner: { alignSelf: 'flex-start' },
  chipRow: { gap: Spacing.two, paddingRight: Spacing.four },
});
