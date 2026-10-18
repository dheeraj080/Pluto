/**
 * The parts of the offline rule store that decide what a server list may
 * overwrite and what a replayed change sends. Both are the kind of thing that
 * must never silently lose a local write, so they are pinned here.
 */
import { describe, expect, it } from 'vitest';

import type { RecurringRuleDto } from './recurring-rules';
import { mergeRulePayload, planRuleMirror, ruleCreateBody, ruleUpdateBody } from './recurring-rules';

function rule(id: string, overrides: Partial<RecurringRuleDto> = {}): RecurringRuleDto {
  return {
    id,
    categoryId: 'cat-1',
    categoryName: 'Housing',
    categoryColor: '#f59e0b',
    amount: 1500,
    currency: 'USD',
    description: 'Rent',
    paymentMethod: null,
    frequency: 'MONTHLY',
    interval: 1,
    startDate: '2026-10-01',
    endDate: null,
    status: 'ACTIVE',
    nextDueOn: '2026-11-01',
    pendingCount: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('planRuleMirror', () => {
  it('removes a rule the server no longer lists', () => {
    const plan = planRuleMirror(['gone'], [], new Set());
    expect(plan.deleteIds).toEqual(['gone']);
    expect(plan.upsert).toEqual([]);
  });

  it('keeps a rule the device still owns even when the server omits it', () => {
    const plan = planRuleMirror(['local'], [], new Set(['local']));
    expect(plan.deleteIds).toEqual([]);
  });

  it('does not let the server overwrite a rule the device owns', () => {
    const plan = planRuleMirror(['local'], [rule('local')], new Set(['local']));
    expect(plan.upsert).toEqual([]);
  });

  it('upserts rules the device does not own', () => {
    const plan = planRuleMirror([], [rule('server')], new Set());
    expect(plan.upsert.map((entry) => entry.id)).toEqual(['server']);
  });
});

describe('mergeRulePayload', () => {
  it('overlays the patch and keeps untouched fields', () => {
    const merged = mergeRulePayload({ amount: 1500, description: 'Rent' }, { amount: 1600 });
    expect(merged).toEqual({ amount: 1600, description: 'Rent' });
  });

  it('ignores undefined patch values', () => {
    const merged = mergeRulePayload({ amount: 1500 }, { amount: undefined, status: 'PAUSED' });
    expect(merged).toEqual({ amount: 1500, status: 'PAUSED' });
  });

  it('keeps an explicit null (clearing the end bound)', () => {
    const merged = mergeRulePayload({ endDate: '2027-10-01' }, { endDate: null });
    expect(merged.endDate).toBeNull();
  });
});

describe('ruleCreateBody', () => {
  it('drops the status, which a create cannot carry', () => {
    const body = ruleCreateBody({ categoryId: 'c', amount: 10, currency: 'USD', status: 'PAUSED' });
    expect(body).not.toHaveProperty('status');
  });

  it('omits a null end bound and empty notes', () => {
    const body = ruleCreateBody({
      categoryId: 'c',
      endDate: null,
      description: null,
      paymentMethod: null,
    });
    expect(body).not.toHaveProperty('endDate');
    expect(body).not.toHaveProperty('description');
    expect(body).not.toHaveProperty('paymentMethod');
  });
});

describe('ruleUpdateBody', () => {
  it('sends only the changed fields', () => {
    expect(ruleUpdateBody({ amount: 1600, status: 'PAUSED' })).toEqual({
      amount: 1600,
      status: 'PAUSED',
    });
  });

  it('sends an explicit null to clear the end bound', () => {
    expect(ruleUpdateBody({ endDate: null })).toEqual({ endDate: null });
  });

  it('omits fields that were not touched', () => {
    expect(ruleUpdateBody({ amount: 1600 })).not.toHaveProperty('description');
  });
});
