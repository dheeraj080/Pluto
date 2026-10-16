import { describe, expect, it } from 'vitest';
import { describeCadence } from './recurrence';

describe('describeCadence', () => {
  const named = [
    ['WEEKLY', 1, 'Weekly'],
    ['MONTHLY', 1, 'Monthly'],
    ['YEARLY', 1, 'Yearly'],
  ] as const;

  for (const [frequency, interval, expected] of named) {
    it(`names every ${frequency} as ${expected}`, () => {
      expect(describeCadence(frequency, interval)).toBe(expected);
    });
  }

  it('treats 0 and negative as every period', () => {
    expect(describeCadence('MONTHLY', 0)).toBe('Monthly');
    expect(describeCadence('WEEKLY', -1)).toBe('Weekly');
  });

  it('phrases wider intervals with a plural count', () => {
    expect(describeCadence('WEEKLY', 2)).toBe('Every 2 weeks');
    expect(describeCadence('MONTHLY', 3)).toBe('Every 3 months');
    expect(describeCadence('YEARLY', 2)).toBe('Every 2 years');
  });
});
