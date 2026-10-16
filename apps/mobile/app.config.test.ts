/**
 * The production guard in `app.config.ts`.
 *
 * `assertProductionConfig()` runs at module load, so each case is a fresh
 * `import('./app.config')` under a controlled environment: no profile (local
 * `expo start`) loads, and a `production` profile refuses to build unless the
 * API URL is https on a real host and a Google web client ID is present. These
 * are the mistakes that otherwise ship a release which cannot talk to the API or
 * sign anyone in — failing on a user's device with no visible cause.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'EAS_BUILD_PROFILE',
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  'EXPO_PUBLIC_SENTRY_DSN',
] as const;

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  vi.resetModules();
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('app.config production guard', () => {
  it('loads without a build profile, as during local expo start', async () => {
    const config = await import('./app.config');
    expect(config.default.name).toBe('Pluto');
  });

  it('refuses a production build with no API URL', async () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web.apps.googleusercontent.com';

    await expect(import('./app.config')).rejects.toThrow(/EXPO_PUBLIC_API_URL is not set/);
  });

  it('refuses a production build whose API URL is not https', async () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'http://api.pluto.app/v1';
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web.apps.googleusercontent.com';

    await expect(import('./app.config')).rejects.toThrow(/must use https/);
  });

  it('refuses a production build pointed at a development host', async () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'https://10.0.2.2:3000/v1';
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web.apps.googleusercontent.com';

    await expect(import('./app.config')).rejects.toThrow(/development host/);
  });

  it('refuses a production build with no Google web client ID', async () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'https://api.pluto.app/v1';

    await expect(import('./app.config')).rejects.toThrow(
      /EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set/,
    );
  });

  it('accepts a well-formed production build', async () => {
    process.env.EAS_BUILD_PROFILE = 'production';
    process.env.EXPO_PUBLIC_API_URL = 'https://api.pluto.app/v1';
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client.apps.googleusercontent.com';

    const config = await import('./app.config');
    expect(config.default.name).toBe('Pluto');
  });

  it('registers the Sentry config plugin only when a DSN is set', async () => {
    const withoutDsn = await import('./app.config');
    expect(withoutDsn.default.plugins).not.toContain('@sentry/react-native');

    vi.resetModules();
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example.ingest.sentry.io/0000000';
    const withDsn = await import('./app.config');
    expect(withDsn.default.plugins).toContain('@sentry/react-native');
  });
});
