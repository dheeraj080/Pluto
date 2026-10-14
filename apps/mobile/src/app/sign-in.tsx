import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { devLogin } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { HOME } from '@/lib/routes';

/**
 * Sign-in.
 *
 * Google Sign-In (`@react-native-google-signin/google-signin`) is a native
 * module and needs an EAS development build — it cannot run in Expo Go. Until
 * those client IDs exist, development uses the server's mock endpoint
 * (`POST /v1/auth/dev-login`, requires `ENABLE_DEV_AUTH=true`).
 */
export default function SignInScreen() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDevLogin = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await devLogin();
      // The tab layout owns the signed-out redirect, so `/` is the only
      // destination needed here.
      router.replace(HOME);
    } catch (err) {
      setError(errorMessage(err) ?? 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Pluto</ThemedText>
        <ThemedText themeColor="textSecondary">Track spending across currencies.</ThemedText>
      </View>

      <Button label="Continue with dev login" onPress={() => void onDevLogin()} busy={busy} />

      {error ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {error}
        </ThemedText>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        Google Sign-In arrives with the EAS development build.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: { gap: Spacing.one },
  centered: { textAlign: 'center' },
});
