import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { bootstrapSession } from '@/lib/api';
import {
  initCrashReporting,
  setCrashReportingUser,
} from '@/lib/crash-reporting';
import { hydrateSecondaryCurrency } from '@/lib/pair-storage';
import { getQueryClient } from '@/lib/query-client';
import { restoreQueryCache, startQueryPersistence } from '@/lib/query-persistence';
import { getRefreshToken } from '@/lib/session';
import { startBackgroundSync } from '@/lib/sync/background-sync';
import { hydrateThemePreference } from '@/lib/theme-preference';
import { fontFamily, palettes, text } from '@/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSession } from '@/hooks/use-session';

// Started before the first render, not inside it: the SDK's job is to catch a
// crash in the layout itself, and a no-op when EXPO_PUBLIC_SENTRY_DSN is unset.
initCrashReporting();

// Held until both the session has been restored and the Inter and Space
// Grotesk faces have loaded, so the app never flashes the sign-in prompt or a
// fallback typeface.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = palettes[scheme === 'dark' ? 'dark' : 'light'];
  const { user } = useSession();

  // Reports carry the signed-in user's id (never their email — see the module),
  // so a spike in crashes can be tied to one account without shipping PII.
  useEffect(() => {
    setCrashReportingUser(user);
  }, [user]);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const client = getQueryClient();
    let cancelled = false;
    let stopPersistence: (() => void) | null = null;
    let stopSync: (() => void) | null = null;

    void (async () => {
      // Appearance and the pair are independent of the session, so they are
      // restored alongside it; the session settles first only because it
      // decides whether the disk cache below may be used at all.
      await Promise.all([hydrateSecondaryCurrency(), hydrateThemePreference()]);
      await bootstrapSession();

      if (cancelled) return;
      // Restore only while a refresh token is still held: the cache is one
      // account's figures and a signed-out launch must not boot from them.
      // Connectivity is deliberately not consulted — an unreachable server
      // keeps the credential (so the cache survives an offline launch) while a
      // rejected one has already cleared it.
      if (getRefreshToken()) {
        await restoreQueryCache(client);
      }
      if (cancelled) return;

      // Persistence starts only after the restore, so the debounced writer can
      // never delete the snapshot in the window before it has been read back.
      stopPersistence = startQueryPersistence(client);

      // Reconcile the on-device store with the server. Started last so the
      // first sync's cache invalidation lands on an already-hydrated client;
      // on web this is a no-op. It watches the session itself, so it waits for
      // sign-in and stops on sign-out.
      stopSync = startBackgroundSync();

      setRestored(true);
    })();

    return () => {
      cancelled = true;
      stopPersistence?.();
      stopSync?.();
    };
  }, []);

  const fontsReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (fontsReady && restored) {
      void SplashScreen.hideAsync();
    }
  }, [fontsReady, restored]);

  // The splash screen stays up while the 400/500/600/700 faces register.
  if (!fontsReady) {
    return null;
  }

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.accent,
      background: palette.canvas,
      card: palette.surface,
      border: palette.border,
      text: palette.ink,
    },
  };

  return (
    <Sentry.ErrorBoundary
      // The boundary wraps the providers on purpose: a crash in one of them
      // must not take the screen down unreported. The fallback therefore cannot
      // use hooks — it paints from `palette`/`text` directly, which are plain
      // module values. Reporting needs no DSN of its own; with none configured
      // the capture is a no-op and only the fallback renders.
      fallback={
        <View style={styles.crash}>
          <Text style={[text.subtitle, { color: palette.ink }]}>Something went wrong</Text>
          <Text style={[text.body, styles.crashBody, { color: palette.muted }]}>
            Pluto hit an unexpected error and stopped rendering. Restart the app to continue —
            your entries are saved on this device.
          </Text>
        </View>
      }
    >
      <QueryClientProvider client={getQueryClient()}>
        <SafeAreaProvider>
          <ThemeProvider value={navigationTheme}>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: palette.canvas },
                headerShadowVisible: false,
                headerTintColor: palette.ink,
                headerTitleStyle: {
                  color: palette.ink,
                  fontFamily: fontFamily.display.semibold,
                },
                contentStyle: { backgroundColor: palette.canvas },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
              <Stack.Screen
                name="expense/new"
                options={{ title: 'New expense', presentation: 'modal' }}
              />
              <Stack.Screen name="expense/[id]/index" options={{ title: 'Expense' }} />
              <Stack.Screen name="expense/[id]/edit" options={{ title: 'Edit expense' }} />
              <Stack.Screen name="recurring/index" options={{ title: 'Recurring' }} />
              <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
            </Stack>
          </ThemeProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  crash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  crashBody: {
    textAlign: 'center',
    marginTop: 8,
  },
});
