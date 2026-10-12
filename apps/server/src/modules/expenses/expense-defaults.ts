import { Prisma } from '@prisma/client';

/**
 * The restrained category palette.
 *
 * Six muted-but-distinguishable hues that sit calmly on the graphite surfaces —
 * no saturated rainbow. This is the server-side twin of the web app's
 * `lib/category-palette.ts`; keep the two in step.
 */
export const CATEGORY_PALETTE = [
  '#34d399', // mint
  '#7dd3fc', // sky
  '#fcd34d', // amber
  '#fda4af', // rose
  '#c4b5fd', // violet
  '#94a3b8', // slate
] as const;

/** Colour applied to a brand-new category when none is supplied. */
export const DEFAULT_CATEGORY_COLOR = CATEGORY_PALETTE[0];

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
  { name: 'Food & Dining', color: '#fcd34d', icon: 'utensils', isDefault: true, sortOrder: 10 },
  { name: 'Transport', color: '#7dd3fc', icon: 'car', isDefault: true, sortOrder: 20 },
  { name: 'Shopping', color: '#fda4af', icon: 'bag', isDefault: true, sortOrder: 30 },
  { name: 'Bills & Utilities', color: '#c4b5fd', icon: 'receipt', isDefault: true, sortOrder: 40 },
  { name: 'Entertainment', color: '#34d399', icon: 'film', isDefault: true, sortOrder: 50 },
  { name: 'Health', color: '#94a3b8', icon: 'heart', isDefault: true, sortOrder: 60 },
  { name: 'Other', color: '#94a3b8', icon: 'ellipsis', isDefault: true, sortOrder: 900 },
];
