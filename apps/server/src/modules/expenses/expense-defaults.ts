import { Prisma } from '@prisma/client';

/**
 * Seed categories created lazily on a new account's first category read, and
 * reused by the dev-data seeder so a demo account looks like a real one.
 *
 * `isDefault` marks them as safe to re-seed; they can be renamed or deleted
 * like any other category.
 */
export const DEFAULT_CATEGORIES: ReadonlyArray<
  Omit<Prisma.ExpenseCategoryUncheckedCreateInput, 'userId' | 'createdAt' | 'updatedAt'>
> = [
  { name: 'Food & Dining', color: '#f59e0b', icon: 'utensils', isDefault: true, sortOrder: 10 },
  { name: 'Transport', color: '#3b82f6', icon: 'car', isDefault: true, sortOrder: 20 },
  { name: 'Shopping', color: '#ec4899', icon: 'bag', isDefault: true, sortOrder: 30 },
  { name: 'Bills & Utilities', color: '#8b5cf6', icon: 'receipt', isDefault: true, sortOrder: 40 },
  { name: 'Entertainment', color: '#06b6d4', icon: 'film', isDefault: true, sortOrder: 50 },
  { name: 'Health', color: '#16a34a', icon: 'heart', isDefault: true, sortOrder: 60 },
  { name: 'Other', color: '#64748b', icon: 'ellipsis', isDefault: true, sortOrder: 900 },
];
