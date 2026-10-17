/**
 * Pure decisions behind the offline store.
 *
 * These are the parts that must agree with the server's behaviour — which rows
 * a filter selects, how a pulled row merges with a queued change, and which
 * mutation an offline edit or delete collapses to. Keeping them free of any
 * SQLite handle lets them be tested directly, with no database and no native
 * module in the import graph.
 */
import { describe, expect, it } from 'vitest';

import { buildExpenseFilterSql, orderByClause, pullActionFor } from './expenses';
import { deleteActionFor, editOp } from './mutations';

describe('buildExpenseFilterSql', () => {
  it('always excludes soft-deleted rows', () => {
    expect(buildExpenseFilterSql({ sort: 'date_desc' })).toEqual({
      where: 'WHERE e.deleted_at IS NULL',
      params: [],
    });
  });

  it('joins every supplied filter with AND, in a stable order', () => {
    const { where, params } = buildExpenseFilterSql({
      sort: 'date_desc',
      categoryId: 'cat-1',
      currency: 'eur',
      search: '  lunch  ',
      from: '2026-10-01',
      to: '2026-10-31',
    });

    expect(where).toBe(
      'WHERE e.deleted_at IS NULL' +
        ' AND e.category_id = ?' +
        ' AND e.currency = ?' +
        ' AND e.description LIKE ?' +
        ' AND e.incurred_on >= ?' +
        ' AND e.incurred_on <= ?',
    );
    expect(params).toEqual(['cat-1', 'EUR', '%lunch%', '2026-10-01', '2026-10-31']);
  });

  it('drops a whitespace-only search rather than matching it', () => {
    const { where, params } = buildExpenseFilterSql({ sort: 'date_desc', search: '   ' });
    expect(where).toBe('WHERE e.deleted_at IS NULL');
    expect(params).toEqual([]);
  });
});

describe('orderByClause', () => {
  it('mirrors each server sort option', () => {
    expect(orderByClause('date_desc')).toBe('e.incurred_on DESC, e.created_at DESC');
    expect(orderByClause('date_asc')).toBe('e.incurred_on ASC, e.created_at ASC');
    expect(orderByClause('amount_desc')).toBe('e.amount DESC, e.id ASC');
    expect(orderByClause('amount_asc')).toBe('e.amount ASC, e.id ASC');
  });
});

describe('pullActionFor', () => {
  it('never clobbers a row with a queued change', () => {
    expect(pullActionFor({ deletedAt: null }, true)).toBe('skip');
    expect(pullActionFor({ deletedAt: '2026-10-10T00:00:00.000Z' }, true)).toBe('skip');
  });

  it('removes the row for a tombstone', () => {
    expect(pullActionFor({ deletedAt: '2026-10-10T00:00:00.000Z' }, false)).toBe('delete');
  });

  it('upserts a live row with no queued change', () => {
    expect(pullActionFor({ deletedAt: null }, false)).toBe('upsert');
  });
});

describe('editOp', () => {
  it('keeps an unsynced row a create', () => {
    expect(editOp('create')).toBe('create');
  });

  it('turns every other edit into an update', () => {
    expect(editOp(null)).toBe('update');
    expect(editOp('update')).toBe('update');
    expect(editOp('delete')).toBe('update');
  });
});

describe('deleteActionFor', () => {
  it('drops a row that never reached the server', () => {
    expect(deleteActionFor('create')).toBe('drop');
  });

  it('tombstones anything else', () => {
    expect(deleteActionFor(null)).toBe('tombstone');
    expect(deleteActionFor('update')).toBe('tombstone');
    expect(deleteActionFor('delete')).toBe('tombstone');
  });
});
