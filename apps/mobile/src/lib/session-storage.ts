import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Schemas } from '@pluto/api-client';

/**
 * Session storage: the refresh token and the profile it belongs to.
 *
 * Native uses `expo-secure-store` (iOS Keychain / Android Keystore), matching
 * the server runbook. Web has no SecureStore, so it falls back to
 * `localStorage` — the same place `apps/web/src/lib/api.ts` keeps it.
 *
 * The profile rides along with the token because it is the only place the
 * base currency lives (`use-user.ts` reads the session store, not the query
 * cache): without a persisted copy, a launch that restores the session while
 * offline would not know which currency the account works in.
 */
const REFRESH_TOKEN_KEY = 'pluto.refreshToken';
const PROFILE_KEY = 'pluto.profile';

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

export async function readProfile(): Promise<Schemas['UserProfileDto'] | null> {
  const raw =
    Platform.OS === 'web'
      ? webStorage()?.getItem(PROFILE_KEY) ?? null
      : await SecureStore.getItemAsync(PROFILE_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as Schemas['UserProfileDto'];
  } catch {
    // A corrupt snapshot must not block sign-in; the next rotation rewrites it.
    return null;
  }
}

export async function writeProfile(profile: Schemas['UserProfileDto']): Promise<void> {
  const raw = JSON.stringify(profile);
  if (Platform.OS === 'web') {
    webStorage()?.setItem(PROFILE_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(PROFILE_KEY, raw);
}

export async function deleteProfile(): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(PROFILE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(PROFILE_KEY);
}
