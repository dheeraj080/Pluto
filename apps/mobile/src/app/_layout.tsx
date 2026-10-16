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
    // Restore the persisted session before revealing the UI so the sign-in
    // screen never flashes for an already-authenticated user, and the pair and
    // appearance preference before the first report or palette paints.
    void Promise.all([
      bootstrapSession(),
      hydrateSecondaryCurrency(),
      hydrateThemePreference(),
    ]).finally(() => {
      setRestored(true);
    });
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
            your data is safe on the server.
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
