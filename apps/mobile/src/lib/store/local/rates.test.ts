/**
 * The offline stand-in for `GET /rates/latest`: a mirrored rate table mapped
 * onto the snapshot shape the conversion previews read.
 */
import { describe, expect, it } from 'vitest';

import { snapshotFromRateTable } from './rates';

describe('snapshotFromRateTable', () => {
  it('maps the mirrored table onto the snapshot shape', () => {
    const snapshot = snapshotFromRateTable({
      version: 7,
      baseCurrency: 'USD',
      effectiveDate: '2026-10-15',
      provider: 'ECB',
      rates: { EUR: '0.92', GBP: '0.79' },
    });

    expect(snapshot).toEqual({
      version: 7,
      baseCurrency: 'USD',
      effectiveDate: '2026-10-15',
      fetchedAt: '2026-10-15T00:00:00.000Z',
      provider: 'ECB',
      etag: 'local-7',
      rates: { EUR: '0.92', GBP: '0.79' },
    });
  });
});
