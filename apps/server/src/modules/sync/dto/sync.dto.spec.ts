/**
 * Validation of `SyncChangeDto.data`.
 *
 * The payload shape is selected by the `entity` discriminator, which a single
 * `@ValidateNested()` cannot express — `SyncChangeDataConstraint` re-validates
 * the nested object against the right class. These tests pin that behaviour: a
 * valid payload for either entity passes, and a mismatched one (wrong fields,
 * missing fields, unknown entity) is rejected before the service ever sees it.
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SyncChangeDto } from './sync.dto';

const CATEGORY_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ENTITY_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function makeChange(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    entity: 'expense',
    id: ENTITY_ID,
    op: 'create',
    clientUpdatedAt: '2026-10-03T09:00:00.000Z',
    data: {
      categoryId: CATEGORY_ID,
      amount: 12.5,
      currency: 'USD',
      description: 'Groceries',
      paymentMethod: 'CARD',
      incurredOn: '2026-10-03',
    },
    ...overrides,
  };
}

function validateChange(change: Record<string, unknown>): Promise<unknown[]> {
  return validate(plainToInstance(SyncChangeDto, change));
}

describe('SyncChangeDto', () => {
  it('accepts a well-formed expense change', async () => {
    await expect(validateChange(makeChange())).resolves.toHaveLength(0);
  });

  it('accepts a well-formed budget change', async () => {
    const change = makeChange({
      entity: 'budget',
      data: {
        categoryId: CATEGORY_ID,
        amount: 400,
        currency: 'USD',
        period: 'MONTHLY',
        startDate: '2026-10-01',
      },
    });

    await expect(validateChange(change)).resolves.toHaveLength(0);
  });

  it('accepts an overall budget with no category', async () => {
    const change = makeChange({
      entity: 'budget',
      data: {
        categoryId: null,
        amount: 400,
        currency: 'USD',
        period: 'MONTHLY',
        startDate: '2026-10-01',
      },
    });

    await expect(validateChange(change)).resolves.toHaveLength(0);
  });

  it('accepts a delete with no payload', async () => {
    await expect(
      validateChange(makeChange({ op: 'delete', data: undefined })),
    ).resolves.toHaveLength(0);
  });

  it('rejects a budget payload carrying an expense-only field', async () => {
    const change = makeChange({
      entity: 'budget',
      data: {
        amount: 400,
        currency: 'USD',
        period: 'MONTHLY',
        startDate: '2026-10-01',
        incurredOn: '2026-10-01',
      },
    });

    await expect(validateChange(change)).resolves.not.toHaveLength(0);
  });

  it('rejects a budget payload missing its amount', async () => {
    const change = makeChange({
      entity: 'budget',
      data: { currency: 'USD', period: 'MONTHLY', startDate: '2026-10-01' },
    });

    await expect(validateChange(change)).resolves.not.toHaveLength(0);
  });

  it('rejects an expense payload carrying a budget-only field', async () => {
    const change = makeChange({
      data: { ...(makeChange().data as Record<string, unknown>), period: 'MONTHLY' },
    });

    await expect(validateChange(change)).resolves.not.toHaveLength(0);
  });

  it('rejects an unknown entity', async () => {
    await expect(validateChange(makeChange({ entity: 'widget' }))).resolves.not.toHaveLength(0);
  });
});
