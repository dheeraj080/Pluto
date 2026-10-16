/**
 * Crash reporting is `EXPO_PUBLIC_SENTRY_DSN`-gated: every export must no-op
 * when no DSN is configured, and call through when one is present — so local
 * development, CI and Expo Go keep working with no Sentry project.
 *
 * `@sentry/react-native` is a native module; exercising it in a node test
 * environment is both slow and brittle. The module is therefore mocked at the
 * boundary, and the tests assert which wrapper methods the app actually calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `initCrashReporting` reads the React Native `__DEV__` global, which Metro
// inlines at build time but a plain node environment does not define.
(globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  setUser: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@sentry/react-native', () => sentry);

describe('crash-reporting', () => {
  const ORIGINAL_ENV = process.env.EXPO_PUBLIC_SENTRY_DSN;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    else process.env.EXPO_PUBLIC_SENTRY_DSN = ORIGINAL_ENV;
  });

  it('is a no-op without a DSN', async () => {
    const reporting = await import('./crash-reporting');

    reporting.initCrashReporting();
    reporting.setCrashReportingUser({ id: 'u1' });
    reporting.captureException(new Error('boom'));

    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.setUser).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('initialises once and attaches only the id', async () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://example.ingest.sentry.io/0000000';
    const reporting = await import('./crash-reporting');

    reporting.initCrashReporting();
    reporting.initCrashReporting();
    reporting.setCrashReportingUser({ id: 'u1' });

    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.setUser).toHaveBeenCalledWith({ id: 'u1' });

    reporting.setCrashReportingUser(null);
    expect(sentry.setUser).toHaveBeenLastCalledWith(null);
  });
});
