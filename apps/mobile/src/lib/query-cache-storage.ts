import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

/**
 * Where the persisted read cache lives.
 *
 * Native keeps it in the document directory rather than the cache directory:
 * the OS may evict a cache at will, and a last-known snapshot that disappears
 * overnight would defeat the point. Web has no filesystem here, so it falls
 * back to `localStorage` — the same store the theme and the web app's own
 * session already use there.
 *
 * The snapshot holds only what the user could already see on screen (their
 * expenses, categories, budgets and rates) and is removed on sign-out, so a
 * signed-out device never keeps another account's figures.
 */
const CACHE_FILE = 'pluto-query-cache.json';
const CACHE_KEY = 'pluto.queryCache';

function webStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export async function readQueryCache(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webStorage()?.getItem(CACHE_KEY) ?? null;
  }
  const file = new File(Paths.document, CACHE_FILE);
  if (!file.exists) return null;
  return file.text();
}

export async function writeQueryCache(snapshot: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.setItem(CACHE_KEY, snapshot);
    return;
  }
  const file = new File(Paths.document, CACHE_FILE);
  if (!file.exists) file.create();
  file.write(snapshot);
}

export async function deleteQueryCache(): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(CACHE_KEY);
    return;
  }
  const file = new File(Paths.document, CACHE_FILE);
  if (file.exists) file.delete();
}
