import type { RecurrenceFrequency } from '@/hooks/use-recurring';

const SIMPLE: Record<RecurrenceFrequency, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

const PLURAL: Record<RecurrenceFrequency, string> = {
  WEEKLY: 'weeks',
  MONTHLY: 'months',
  YEARLY: 'years',
};

/**
 * The cadence in words: "Monthly" for every period, "Every 3 months" for a
 * wider interval. The server stores the period and the step separately, and the
 * UI never shows the raw enum, so the wording lives here.
 */
export function describeCadence(frequency: RecurrenceFrequency, interval: number): string {
  if (interval <= 1) return SIMPLE[frequency];
  return `Every ${interval} ${PLURAL[frequency]}`;
}
