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

/** The Recurring screen: rules and the pending occurrences they produce. */
export const RECURRING = '/recurring' as unknown as Href;

/**
 * The Delete-account screen.
 *
 * Cast like its neighbours: the generated typed-routes union only picks this up
 * after the next `expo start` regenerates `.expo/types/router.d.ts`, and this
 * keeps `tsc` honest in the meantime. The URL itself is the canonical one.
 */
export const DELETE_ACCOUNT = '/delete-account' as unknown as Href;

/** The filters a Reports drill-down can hand to the Activity list. */
export interface ActivityHrefParams {
  /** Pre-select one category (`GET /expenses?categoryId=`). */
  categoryId?: string;
  /** Pre-select one original currency (`GET /expenses?currency=`). */
  currency?: string;
  /** Inclusive window bounds, so the list opens on the same range as the card. */
  from?: string;
  to?: string;
}

/**
 * The Activity tab, optionally pre-filtered by a Reports drill-down.
 *
 * Built as a query string rather than an object so the params survive the
 * typed-routes `Href` cast the way the detail links do. `URLSearchParams` is
 * deliberately avoided: React Native's implementation is incomplete (no `set`),
 * so the encoding is done by hand.
 */
export function activityHref(params: ActivityHrefParams = {}): Href {
  const query: string[] = [];
  if (params.categoryId) query.push(`categoryId=${encodeURIComponent(params.categoryId)}`);
  if (params.currency) query.push(`currency=${encodeURIComponent(params.currency)}`);
  if (params.from) query.push(`from=${encodeURIComponent(params.from)}`);
  if (params.to) query.push(`to=${encodeURIComponent(params.to)}`);
  const suffix = query.length > 0 ? `?${query.join('&')}` : '';
  return `/transactions${suffix}` as unknown as Href;
}
