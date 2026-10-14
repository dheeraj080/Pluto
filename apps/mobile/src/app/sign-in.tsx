import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Wordmark } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorNote } from '@/components/ui/feedback';
import { layout, spacing, text } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import { devLogin } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { HOME } from '@/lib/routes';

export default function SignInScreen() {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = useCallback(() => {
    setError(null);
    setBusy(true);
    devLogin()
      .then(() => router.replace(HOME))
      .catch((cause: unknown) => setError(errorMessage(cause) ?? 'Could not sign in.'))
      .finally(() => setBusy(false));
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

        <Button label="Continue" onPress={onSignIn} busy={busy} />

        {error ? <ErrorNote message={error} /> : null}

        <Text style={[text.caption, styles.centered, { color: theme.muted }]}>
          Google sign-in arrives with the native build. Until then the development
          login is the way in.
        </Text>
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
});
