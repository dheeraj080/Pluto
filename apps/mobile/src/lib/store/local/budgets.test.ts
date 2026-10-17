/**
 * Mirror-merge decisions for the offline budget store.
 *
 * `planBudgetMirror` is the part that must never lose an offline write: it
 * decides which mirrored rows a server list replaces and which it must leave
 * alone because the device still owns them.
 */
import { describe, expect, it } from 'vitest';

import type { BudgetDto } from '../types';
import { planBudgetMirror } from './budgets';

function budget(id: string, overrides: Partial<BudgetDto> = {}): BudgetDto {
  return {
    id,
    categoryId: null,
    categoryName: null,
    amount: 400,
    currency: 'USD',
    period: 'MONTHLY',
    startDate: '2026-10-01',
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('planBudgetMirror', () => {
  it('removes a row the server no longer lists', () => {
    const plan = planBudgetMirror(['gone'], [], new Set());
    expect(plan.deleteIds).toEqual(['gone']);
    expect(plan.upsert).toEqual([]);
  });

  it('keeps a row the device still owns even when the server omits it', () => {
    const plan = planBudgetMirror(['local-only'], [budget('server')], new Set(['local-only']));
    expect(plan.deleteIds).toEqual([]);
    expect(plan.upsert.map((row) => row.id)).toEqual(['server']);
  });

  it('never overwrites a row with a queued change', () => {
    const plan = planBudgetMirror([], [budget('mine'), budget('theirs')], new Set(['mine']));
    expect(plan.upsert.map((row) => row.id)).toEqual(['theirs']);
  });

  it('upserts every server row when nothing is pending', () => {
    const plan = planBudgetMirror([], [budget('a'), budget('b')], new Set());
    expect(plan.deleteIds).toEqual([]);
    expect(plan.upsert.map((row) => row.id)).toEqual(['a', 'b']);
  });
});
