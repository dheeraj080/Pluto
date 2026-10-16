/**
 * Formatting helpers that must agree with the web client (`parseAmount`
 * validates exactly what `CreateExpenseDto` permits) and with the server
 * (`isValidIsoDate` rejects what Prisma would reject).
 *
 * Locale-dependent paths (`formatMoney`, `formatDate`) are pinned to the
 * default Node/CI locale by asserting loosely — the contract worth pinning is
 * the shape, not the exact glyphs a locale chooses.
 */
import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatMoney,
  formatMonth,
  isValidIsoDate,
  parseAmount,
} from './format';

describe('parseAmount', () => {
  it.each([
    ['12', 12],
    ['12.5', 12.5],
    ['12.50', 12.5],
    ['0.01', 0.01],
    ['  12.34  ', 12.34],
  ])('accepts %p as %p', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each([['0'], ['-5'], ['12.345'], ['abc'], [''], ['12,34'], ['.5'], ['5.']])(
    'rejects %p',
    (input) => {
      expect(parseAmount(input)).toBeNull();
    },
  );
});

describe('isValidIsoDate', () => {
  it('accepts real calendar dates', () => {
    expect(isValidIsoDate('2026-10-16')).toBe(true);
    expect(isValidIsoDate('2024-02-29')).toBe(true);
  });

  it('rejects impossible dates the shape check alone would accept', () => {
    expect(isValidIsoDate('2026-02-31')).toBe(false);
    expect(isValidIsoDate('2025-02-29')).toBe(false);
    expect(isValidIsoDate('not-a-date')).toBe(false);
    expect(isValidIsoDate('2026-10-16T00:00:00')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });
});

describe('formatBytes', () => {
  it('picks the first unit that keeps one digit of headroom', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(2_048_576)).toBe('2.0 MB');
    expect(formatBytes(24_576_000_000)).toBe('23 GB');
  });
});

describe('locale-sensitive formats', () => {
  it('includes the amount and currency code even for an unusual currency', () => {
    const label = formatMoney(12.34, 'XXQ');
    expect(label).toContain('12.34');
    expect(label).toContain('XXQ');
  });

  it('keeps month labels to the marked month', () => {
    const label = formatMonth('2026-10');
    expect(label).toContain('2026');
    expect(label).not.toContain('2025');
  });
});
