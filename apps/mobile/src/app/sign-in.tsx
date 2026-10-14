import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { devLogin } from '@/lib/api';

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
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
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

      <Pressable
        onPress={onDevLogin}
        disabled={busy}
        style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
      >
        {busy ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <ThemedText style={styles.buttonLabel}>Continue with dev login</ThemedText>
        )}
      </Pressable>

      {error ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
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
  header: {
    gap: Spacing.one,
  },
  button: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#ffffff',
    fontWeight: '600',
  },
  error: {
    textAlign: 'center',
  },
  note: {
    textAlign: 'center',
  },
});
