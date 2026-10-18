/**
 * The occurrence mirror's reconciliation plan.
 *
 * The mirror is what the Recurring screen renders, and decides, without a
 * connection — so what a fetched page is allowed to overwrite (or delete) is
 * the whole safety story: a decision the device still owes the server must
 * survive the fetch that has not heard of it, and a page that merely ran out
 * of room must never be taken for the complete truth.
 */
import { describe, expect, it } from 'vitest';

import { planOccurrenceMirror, type OccurrenceDto } from './occurrences';

function occurrence(overrides: Partial<OccurrenceDto> = {}): OccurrenceDto {
  return {
    id: 'occ-1',
    recurringExpenseId: 'rule-1',
    dueOn: '2026-11-01',
    status: 'PENDING',
    amount: 1500,
    currency: 'USD',
    categoryId: 'cat-1',
    categoryName: 'Housing',
    categoryColor: '#f59e0b',
    description: 'Rent',
    paymentMethod: 'CARD',
    expenseId: null,
    confirmedAt: null,
    createdAt: '2026-10-16T10:00:00.000Z',
    ...overrides,
  };
}

describe('planOccurrenceMirror', () => {
  it('writes back everything a complete page fetched', () => {
    const plan = planOccurrenceMirror(
      [],
      [occurrence({ id: 'occ-1' }), occurrence({ id: 'occ-2', dueOn: '2026-12-01' })],
      2,
      'PENDING',
      new Set(),
    );

    expect(plan.upsert.map((o) => o.id)).toEqual(['occ-1', 'occ-2']);
    expect(plan.deleteIds).toEqual([]);
  });

  it('removes the rows a complete filtered page no longer lists', () => {
    const local = [
      { id: 'occ-1', status: 'PENDING' as const },
      { id: 'occ-2', status: 'PENDING' as const },
      // Out of scope: a PENDING page cannot pronounce on a decided row.
      { id: 'occ-3', status: 'CONFIRMED' as const },
    ];
    const plan = planOccurrenceMirror(
      local,
      [occurrence({ id: 'occ-1' })],
      1,
      'PENDING',
      new Set(),
    );

    expect(plan.deleteIds).toEqual(['occ-2']);
    expect(plan.upsert.map((o) => o.id)).toEqual(['occ-1']);
  });

  it('keeps a row the device still owes the server, even when the fetch disagrees', () => {
    // The server, which has not heard the confirm, lists `occ-2` as PENDING —
    // but the device owns its decision until the replay settles it.
    const local = [
      { id: 'occ-1', status: 'PENDING' as const },
      { id: 'occ-2', status: 'CONFIRMED' as const },
    ];
    const plan = planOccurrenceMirror(
      local,
      [occurrence({ id: 'occ-1' }), occurrence({ id: 'occ-2', status: 'PENDING' })],
      2,
      'PENDING',
      new Set(['occ-2']),
    );

    expect(plan.upsert.map((o) => o.id)).toEqual(['occ-1']);
    expect(plan.deleteIds).toEqual([]);
  });

  it('keeps a decided row out of reach of its own status page while queued', () => {
    const plan = planOccurrenceMirror(
      [{ id: 'occ-9', status: 'CONFIRMED' as const }],
      [],
      0,
      'CONFIRMED',
      new Set(['occ-9']),
    );

    expect(plan.deleteIds).toEqual([]);
  });

  it('removes a decided row the server no longer reports once the queue is clear', () => {
    // Same shape as above without the queue: the decision was settled (or
    // happened on another device), so the server's silence is real.
    const plan = planOccurrenceMirror(
      [{ id: 'occ-9', status: 'CONFIRMED' as const }],
      [],
      0,
      'CONFIRMED',
      new Set(),
    );

    expect(plan.deleteIds).toEqual(['occ-9']);
  });

  it('deletes nothing when the page could not have carried everything', () => {
    // One item fetched out of five: the four beyond the limit were never
    // listed, so absence proves nothing about them.
    const plan = planOccurrenceMirror(
      [
        { id: 'occ-1', status: 'PENDING' as const },
        { id: 'occ-4', status: 'PENDING' as const },
      ],
      [occurrence({ id: 'occ-1' })],
      5,
      'PENDING',
      new Set(),
    );

    expect(plan.deleteIds).toEqual([]);
  });

  it('speaks for every status when the fetch carried no filter', () => {
    const local = [
      { id: 'occ-1', status: 'PENDING' as const },
      { id: 'occ-2', status: 'SKIPPED' as const },
    ];
    const plan = planOccurrenceMirror(
      local,
      [occurrence({ id: 'occ-1', status: 'SKIPPED' })],
      1,
      undefined,
      new Set(),
    );

    expect(plan.deleteIds).toEqual(['occ-2']);
    expect(plan.upsert.map((o) => o.id)).toEqual(['occ-1']);
  });

  it('drops the occurrences of a rule the device has deleted', () => {
    // The server has not heard the rule's delete yet, so its page still lists
    // the charge; mirroring it would resurrect what the user removed.
    const plan = planOccurrenceMirror(
      [],
      [occurrence({ id: 'occ-1', recurringExpenseId: 'rule-1' }), occurrence({ id: 'occ-2', recurringExpenseId: 'rule-2' })],
      2,
      'PENDING',
      new Set(),
      new Set(['rule-1']),
    );

    expect(plan.upsert.map((o) => o.id)).toEqual(['occ-2']);
  });
});
