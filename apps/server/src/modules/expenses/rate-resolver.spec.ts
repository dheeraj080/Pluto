import { RateTableDto } from '../rates/dto/rates-response.dto';
import { RateResolver } from './rate-resolver';

function table(effectiveDate: string, version = 1): RateTableDto {
  return {
    version,
    baseCurrency: 'USD',
    effectiveDate,
    provider: 'mock',
    rates: { USD: '1.000000', EUR: '0.920000' },
  };
}

const TABLES = [table('2026-09-30', 1), table('2026-10-09', 2), table('2026-10-15', 3)];

describe('RateResolver', () => {
  it('uses the latest snapshot on-or-before the date when within lookback -> historical', () => {
    const resolver = new RateResolver(TABLES, 10);
    const resolved = resolver.resolve('2026-10-11');
    expect(resolved?.table.effectiveDate).toBe('2026-10-09');
    expect(resolved?.policy).toBe('historical');
  });

  it('labels the same snapshot estimate when the gap exceeds the lookback', () => {
    const resolver = new RateResolver(TABLES, 3);
    const resolved = resolver.resolve('2026-10-13'); // 4 days after 10-09
    expect(resolved?.table.effectiveDate).toBe('2026-10-09');
    expect(resolved?.policy).toBe('estimate');
  });

  it('never uses a future snapshot for a historical date', () => {
    const resolver = new RateResolver(TABLES, 10);
    const resolved = resolver.resolve('2026-10-05');
    // Latest on-or-before is 09-30; 10-09 and 10-15 are in the future here.
    expect(resolved?.table.effectiveDate).toBe('2026-09-30');
    expect(resolved?.policy).toBe('historical');
  });

  it('falls back to the earliest snapshot (labeled estimate) when the date predates all snapshots', () => {
    const resolver = new RateResolver(TABLES, 10);
    const resolved = resolver.resolve('2026-01-15');
    expect(resolved?.table.effectiveDate).toBe('2026-09-30');
    expect(resolved?.policy).toBe('estimate');
  });

  it('returns null when there are no tables at all', () => {
    const resolver = new RateResolver([], 10);
    expect(resolver.resolve('2026-10-09')).toBeNull();
  });

  it('handles tables passed in an arbitrary order', () => {
    const resolver = new RateResolver([TABLES[2], TABLES[0], TABLES[1]], 10);
    const resolved = resolver.resolve('2026-10-11');
    expect(resolved?.table.effectiveDate).toBe('2026-10-09');
    expect(resolved?.policy).toBe('historical');
  });
});
