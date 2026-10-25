import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Wordmark } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorNote } from '@/components/ui/feedback';
import { layout, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { devLogin, googleLogin } from '@/lib/api';
import { GOOGLE_WEB_CLIENT_ID } from '@/lib/env';
import { errorMessage } from '@/lib/errors';
import { requestGoogleIdToken } from '@/lib/google-sign-in';
import { HOME } from '@/lib/routes';
import { ensureLocalSession } from '@/lib/session';
import { readOnboardingCompleted, writeOnboardingCompleted } from '@/lib/session-storage';

/**
 * The way in.
 *
 * Google is the real path. The mock login stays behind `__DEV__`: it needs
 * `ENABLE_DEV_AUTH=true` on the server and a locally seeded user, so it is worth
 * keeping while building the app, but it must never ship in a release binary.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const [busy, setBusy] = useState<'google' | 'dev' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const googleConfigured = GOOGLE_WEB_CLIENT_ID !== '';

  const onGoogleSignIn = useCallback(() => {
    setError(null);
    setBusy('google');
    void (async () => {
      try {
        const idToken = await requestGoogleIdToken();
        if (!idToken) return; // The account sheet was dismissed.
        await googleLogin(idToken);
        await writeOnboardingCompleted(true);
        router.replace('/onboarding/currency' as any);
      } catch (cause) {
        setError(errorMessage(cause) ?? 'Could not sign in with Google.');
      } finally {
        setBusy(null);
      }
    })();
  }, []);

  const onDevSignIn = useCallback(() => {
    setError(null);
    setBusy('dev');
    devLogin()
      .then(() => {
        writeOnboardingCompleted(true);
        router.replace('/onboarding/currency' as any);
      })
      .catch((cause: unknown) => setError(errorMessage(cause) ?? 'Could not sign in.'))
      .finally(() => setBusy(null));
  }, []);

  /** Enter the free plan: a local session with no account and no network. */
  const onContinueOffline = useCallback(() => {
    setError(null);
    ensureLocalSession();
    writeOnboardingCompleted(true);
    router.replace('/onboarding/currency' as any);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.canvas }]}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Wordmark size={32} />
          <Text style={[text.caption, styles.centered, { color: theme.muted }]}>
            Track spending in any currency, converted to your base.
          </Text>
        </View>

        <Button
          label="Continue offline (Free plan)"
          onPress={onContinueOffline}
          busy={busy !== null}
          disabled={busy !== null}
        />

        {googleConfigured ? (
          <Button
            label="Sign in with Google (Sync & Backup)"
            onPress={onGoogleSignIn}
            busy={busy === 'google'}
            disabled={busy !== null}
            variant="secondary"
          />
        ) : null}

        {error ? <ErrorNote message={error} /> : null}

        {__DEV__ ? (
          <View style={styles.dev}>
            <Text style={[text.captionMedium, styles.centered, { color: theme.muted }]}>
              Development only
            </Text>
            <Button
              label="Continue with a dev account"
              variant="secondary"
              onPress={onDevSignIn}
              busy={busy === 'dev'}
              disabled={busy !== null}
            />
          </View>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.gutter,
  },
  card: { width: '100%', gap: spacing.lg },
  header: { alignItems: 'center', gap: spacing.md },
  centered: { textAlign: 'center' },
  dev: { gap: spacing.sm },
});
