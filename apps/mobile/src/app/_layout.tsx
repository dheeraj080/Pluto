import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { bootstrapSession } from '@/lib/api';
import { getQueryClient } from '@/lib/query-client';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const queryClient = getQueryClient();

  useEffect(() => {
    // Restore the persisted session before revealing the UI so the sign-in
    // screen never flashes for an already-authenticated user.
    void bootstrapSession().finally(() => {
      void SplashScreen.hideAsync();
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
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
