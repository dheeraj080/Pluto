import type { Href } from 'expo-router';

/**
 * Canonical hrefs the typed-routes generator does not emit.
 *
 * `experiments.typedRoutes` builds its union from *file paths*, so an
 * `index.tsx` produces an explicit `.../index` entry: `app/(tabs)/index.tsx`
 * becomes `/index` and `app/expense/[id]/index.tsx` becomes
 * `/expense/[id]/index`. The router serves the short canonical URLs (`/` and
 * `/expense/<id>`), which is what links should say, so the cast here bridges
 * the generator's naming rather than any runtime gap.
 *
 * The cast is deliberately confined to this module: screens keep readable,
 * canonical hrefs and the reason lives in one place.
 */
export const HOME = '/' as unknown as Href;

/** Detail screen for one expense. */
export function expenseHref(id: string): Href {
  return `/expense/${id}` as unknown as Href;
}

/** Edit screen for one expense. */
export function editExpenseHref(id: string): Href {
  return `/expense/${id}/edit` as unknown as Href;
}
