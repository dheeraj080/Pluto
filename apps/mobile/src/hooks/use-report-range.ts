/**
 * The one range the Reports screen is looking at.
 *
 * Holds the preset choice and any custom bounds, and derives everything a card
 * needs from them — the resolved window, its chart bucket size, a human label
 * and its length in days. Screens read this instead of repeating the
 * `reportRange` / `granularityFor` / `diffDays` trio on every render.
 */

import { useCallback, useMemo, useState } from 'react';

import { formatDateRange } from '@/lib/format';
import {
  diffDays,
  granularityFor,
  reportRange,
  type ReportGranularity,
  type ReportPreset,
  type ReportRange,
} from '@/lib/ranges';

export interface ReportRangeState {
  /** The selected preset; `custom` once a custom window is applied. */
  preset: ReportPreset;
  /** The resolved window, always paired with the equal-length one before it. */
  range: ReportRange;
  /** Chart bucket size for the window (`day` / `week` / `month`). */
  granularity: ReportGranularity;
  /** The window as "1 - 14 Oct", for card subtitles and the range button. */
  rangeLabel: string;
  /** Inclusive length of the window in days. */
  days: number;
  /** The last applied custom bounds, so the range sheet can re-seed its fields. */
  custom: { from: string; to: string };
  /** Apply a preset. Custom bounds are ignored while a preset is active. */
  applyPreset: (preset: Exclude<ReportPreset, 'custom'>) => void;
  /** Apply a custom window; both bounds must be valid `YYYY-MM-DD` dates. */
  applyCustom: (from: string, to: string) => void;
}

/** A non-custom preset, i.e. one the range sheet's preset list offers. */
export type ReportRangePreset = Exclude<ReportPreset, 'custom'>;

export function useReportRange(initial: ReportRangePreset = 'month'): ReportRangeState {
  const [preset, setPreset] = useState<ReportPreset>(initial);
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: '', to: '' });

  const range = useMemo(
    () => reportRange(preset, custom.from, custom.to),
    [preset, custom],
  );
  const granularity = useMemo(() => granularityFor(range.from, range.to), [range.from, range.to]);
  const rangeLabel = formatDateRange(range.from, range.to);
  const days = diffDays(range.from, range.to) + 1;

  const applyPreset = useCallback((next: ReportRangePreset) => {
    setPreset(next);
  }, []);

  const applyCustom = useCallback((from: string, to: string) => {
    setCustom({ from, to });
    setPreset('custom');
  }, []);

  return { preset, range, granularity, rangeLabel, days, custom, applyPreset, applyCustom };
}
