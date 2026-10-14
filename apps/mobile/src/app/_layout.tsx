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
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { bootstrapSession } from '@/lib/api';
import { hydrateSecondaryCurrency } from '@/lib/pair-storage';
import { getQueryClient } from '@/lib/query-client';
import { fontFamily, palettes } from '@/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Held until both the session has been restored and the Inter and Space
// Grotesk faces have loaded, so the app never flashes the sign-in prompt or a
// fallback typeface.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const palette = palettes[scheme === 'dark' ? 'dark' : 'light'];

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
    // screen never flashes for an already-authenticated user, and the pair
    // before the first report or budget paints.
    void Promise.all([bootstrapSession(), hydrateSecondaryCurrency()]).finally(() => {
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
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
