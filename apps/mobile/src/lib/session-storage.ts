import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Refresh-token storage.
 *
 * Native uses `expo-secure-store` (iOS Keychain / Android Keystore), matching
 * the server runbook. Web has no SecureStore, so it falls back to
 * `localStorage` — the same place `apps/web/src/lib/api.ts` keeps it.
 */
const REFRESH_TOKEN_KEY = 'pluto.refreshToken';

function webStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export async function readRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webStorage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
  }
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function writeRefreshToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.setItem(REFRESH_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function deleteRefreshToken(): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
