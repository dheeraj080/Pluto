import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View, SafeAreaView } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorNote, Spinner } from '@/components/ui/feedback';
import { Wordmark } from '@/components/logo';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout, spacing, text, radius } from '@/theme';

import { readOnboardingCompleted, writeOnboardingCompleted } from '@/lib/session-storage';
import { useSession } from '@/hooks/use-session';
import { ensureLocalSession } from '@/lib/session';

/**
 * Onboarding welcome: choose account mode.
 *
 * Picks one of two modes and hands off to the appropriate next step.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { status, user } = useSession();
  const insets = useSafeAreaInsets();

  const onLocal = useCallback(async () => {
    await ensureLocalSession('USD');
    await writeOnboardingCompleted(true);
    router.push('/onboarding/currency' as any);
  }, []);

  const onSignIn = useCallback(async () => {
    router.push('/sign-in');
  }, []);

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Spinner size="large" />
          <Text style={[text.bodyMedium, { color: theme.muted }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'signed-in' && user) {
    // Already signed in — check if onboarding was already completed
    // User profile from session may not have onboardingCompleted yet,
    // so we always redirect to onboarding for the guided flow
    router.push('/onboarding/currency' as any);
    return null;
  }

  const cardPaddingBottom = insets.bottom > 0 ? insets.bottom + spacing.lg : spacing.lg;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Wordmark size={40} />
            <Text style={styles.welcomeTitle}>Welcome to Pluto</Text>
          </View>

          <Text style={styles.welcomeSub}>
            Track your spending in any currency, with automatic conversion and reports.
          </Text>

          <View style={styles.gap} />

          <Button
            label="Use offline (Free plan — data stays on this device)"
            onPress={onLocal}
            variant="secondary"
          />

          <Button
            label="Sign in with Google (Sync & backup to server)"
            onPress={onSignIn}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, paddingBottom: spacing.xxl },
  content: { padding: layout.gutter },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    padding: layout.gutter,
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    backgroundColor: '#131518',
  },

  cardHeader: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md },

  welcomeTitle: {
    ...text.display,
    color: '#F2F4F5',
    marginBottom: spacing.xs,
  },

  welcomeSub: {
    ...text.body,
    color: '#A4ABB2',
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  gap: { marginVertical: spacing.lg },
});