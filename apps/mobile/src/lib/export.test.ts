/**
 * The CSV export boundary: the platform share check, the request shape and the
 * file hand-off to `expo-sharing`.
 *
 * `expo-file-system`, `expo-sharing` and the configured API client are all
 * native or network seams with no implementation in a node environment, so
 * they are mocked with `vi.hoisted` exactly as `api.test.ts` mocks the
 * secure-store boundary. That also lets each test assert what the OS was
 * actually asked to do — which query was sent, what was written, and which
 * file URL was shared.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { shareExpensesCsv } from './export';

const mocks = vi.hoisted(() => {
  const file = {
    uri: 'cache-dir/pluto-expenses.csv',
    create: vi.fn<(options: { overwrite: boolean }) => void>(),
    write: vi.fn<(contents: string) => void>(),
  };

  return {
    file,
    File: vi.fn(() => file),
    Paths: { cache: 'cache-dir' },
    isAvailableAsync: vi.fn<() => Promise<boolean>>(async () => false),
    shareAsync: vi.fn<(uri: string, options?: Record<string, unknown>) => Promise<void>>(
      async () => {},
    ),
    get: vi.fn<(path: string, options?: { query?: Record<string, unknown> }) => Promise<string>>(
      async () => '',
    ),
  };
});

vi.mock('expo-file-system', () => ({ File: mocks.File, Paths: mocks.Paths }));
vi.mock('expo-sharing', () => ({
  isAvailableAsync: mocks.isAvailableAsync,
  shareAsync: mocks.shareAsync,
}));
vi.mock('@/lib/api', () => ({ api: { get: mocks.get } }));

const CSV = 'date,amount\n2026-02-01,12.5';

describe('shareExpensesCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAvailableAsync.mockResolvedValue(true);
    mocks.get.mockResolvedValue(CSV);
  });

  it('makes no request when the platform cannot share files', async () => {
    mocks.isAvailableAsync.mockResolvedValue(false);

    await expect(shareExpensesCsv({ from: '2026-02-01', to: '2026-02-28' })).resolves.toBe(false);

    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.File).not.toHaveBeenCalled();
  });

  it('writes the response to a cache file and hands it to the share sheet', async () => {
    await expect(
      shareExpensesCsv({ from: '2026-02-01', to: '2026-02-28', base: 'EUR' }),
    ).resolves.toBe(true);

    expect(mocks.get).toHaveBeenCalledWith('/expenses/export.csv', {
      query: { from: '2026-02-01', to: '2026-02-28', base: 'EUR' },
    });
    expect(mocks.File).toHaveBeenCalledWith('cache-dir', 'pluto-expenses.csv');
    expect(mocks.file.create).toHaveBeenCalledWith({ overwrite: true });
    expect(mocks.file.write).toHaveBeenCalledWith(CSV);
    expect(mocks.shareAsync).toHaveBeenCalledWith(mocks.file.uri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Export expenses',
    });
  });

  it('sends an absent base as undefined', async () => {
    await shareExpensesCsv({ from: '2026-02-01', to: '2026-02-28', base: null });

    expect(mocks.get).toHaveBeenCalledWith('/expenses/export.csv', {
      query: { from: '2026-02-01', to: '2026-02-28', base: undefined },
    });

    mocks.get.mockClear();
    await shareExpensesCsv({ from: '2026-02-01', to: '2026-02-28' });

    expect(mocks.get).toHaveBeenCalledWith('/expenses/export.csv', {
      query: { from: '2026-02-01', to: '2026-02-28', base: undefined },
    });
  });

  it('rejects with the API error and writes nothing', async () => {
    mocks.get.mockRejectedValue(new Error('export failed'));

    await expect(shareExpensesCsv({ from: '2026-02-01', to: '2026-02-28' })).rejects.toThrow(
      'export failed',
    );

    expect(mocks.File).not.toHaveBeenCalled();
    expect(mocks.shareAsync).not.toHaveBeenCalled();
  });
});
