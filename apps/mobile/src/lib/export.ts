/**
 * Export the Reports range as a CSV, and hand it to the OS share sheet.
 *
 * The CSV text itself comes from the report store: generated on-device from
 * the expense mirror on native (offline, byte-identical to the server's
 * format), fetched from `GET /expenses/export.csv` on web — where the string
 * is wrapped in the usual success envelope, so the ordinary JSON client
 * unwraps it to the CSV text with no extra plumbing.
 *
 * The text is written to a real file in the cache directory before sharing:
 * `expo-sharing` shares a file URL, not a string, so this is what turns the
 * response into something Mail, Drive or Files can accept. Sharing out needs no
 * config plugin (only receiving shares does), so there is nothing to register in
 * `app.config.ts`.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { reportStore } from '@/lib/store';

export interface ExportCsvParams {
  from: string;
  to: string;
  /** Reporting currency the CSV's converted column should use. */
  base?: string | null;
}

/**
 * Get the range's expenses as CSV and open the share sheet.
 *
 * Resolves once the sheet has been dismissed (or immediately, with `false`,
 * when the platform cannot share files at all). Rejects with the store's error
 * if the export itself fails — an API error on web, or a local database
 * failure on native (a range the rate mirror could not convert exports with
 * empty rate cells rather than failing).
 */
export async function shareExpensesCsv(params: ExportCsvParams): Promise<boolean> {
  // Bail before spending a request if the platform cannot share at all.
  if (!(await Sharing.isAvailableAsync())) return false;

  const csv = await reportStore.exportCsv(params);

  const file = new File(Paths.cache, 'pluto-expenses.csv');
  file.create({ overwrite: true });
  file.write(csv);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Export expenses',
  });
  return true;
}
