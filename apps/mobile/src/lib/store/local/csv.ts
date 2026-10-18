import type * as SQLite from 'expo-sqlite';

import { buildRateContext, convertAtDate, type RateTable } from '@pluto/domain';

/**
 * On-device CSV export.
 *
 * The column set, ordering and cell formatting mirror the server's
 * `ExpensesReportsService.exportCsv` line-for-line, so a file generated while
 * offline is byte-identical to `GET /expenses/export.csv` for the same data —
 * including the per-line rate provenance (`Rate Used`, `Rate Date`,
 * `Estimated`), which the shared `convertAtDate` resolution supplies directly.
 */

/** One expense row, in the projection the CSV needs. */
export interface CsvExpenseRow {
  /** `YYYY-MM-DD`, exactly as stored (the server formats its `Date` the same way). */
  incurredOn: string;
  description: string | null;
  /** Category name, or null for an uncategorised expense. */
  categoryName: string | null;
  amount: number;
  currency: string;
}

/** Matches the server's header row — unquoted, comma-separated. */
const CSV_HEADERS = [
  'Date',
  'Description',
  'Category',
  'Amount Paid',
  'Currency Paid',
  'Converted Amount',
  'Reporting Currency',
  'Rate Used',
  'Rate Date',
  'Estimated',
];

/**
 * Quotes one field and doubles any embedded quote (RFC 4180).
 *
 * The server quotes every free-form cell unconditionally; only the numeric and
 * enum columns ride bare. Free text (descriptions, category names) is
 * length-checked but otherwise arbitrary, so a value like `Books, "sale"` must
 * be quoted *and* escaped, otherwise it would close its own field early and
 * shift every subsequent column.
 */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Renders the range's expenses as CSV text.
 *
 * `to` anchors the rate context exactly as the server does (`buildRateContext`
 * resolves tables on-or-before the range *end*), so the same expense exports
 * with the same rate whether the range is computed here or by the API.
 */
export function buildExpensesCsv(
  rows: readonly CsvExpenseRow[],
  options: { base: string; to: string; tables: readonly RateTable[] },
): string {
  const baseCurrency = options.base.toUpperCase();
  const ctx = buildRateContext(baseCurrency, options.to, options.tables);
  const lines = [CSV_HEADERS.join(',')];

  for (const row of rows) {
    const description = row.description ?? '';
    const category = row.categoryName ?? 'Uncategorised';
    const amount = Number(row.amount).toFixed(2);

    const res = convertAtDate(ctx, row.amount, row.currency, row.incurredOn);
    const convertedAmount = res.value !== null ? res.value.toFixed(2) : '';
    const reportingCurrency = res.convertible ? baseCurrency : '';
    const rateUsed = res.rate != null ? Number(res.rate.toFixed(6)).toString() : '';
    const rateDate = res.rateDate ?? '';
    const estimated = res.policy === 'estimate' ? 'yes' : 'no';

    lines.push(
      [
        csvField(row.incurredOn),
        csvField(description),
        csvField(category),
        amount,
        row.currency,
        convertedAmount,
        reportingCurrency,
        rateUsed,
        rateDate,
        estimated,
      ].join(','),
    );
  }

  return lines.join('\n');
}

interface CsvRowRecord {
  incurred_on: string;
  description: string | null;
  amount: number;
  currency: string;
  category_name: string | null;
}

/**
 * The range's live expenses, newest first — the server's export ordering
 * (`incurredOn desc, createdAt desc`) rebuilt over the mirror.
 *
 * Soft-deleted rows are excluded, matching every other read of the mirror; the
 * optional list filters (`categoryId`, `currency`, `search`) are not applied
 * because the export endpoint never receives them from this app.
 */
export async function listLocalCsvRows(
  database: SQLite.SQLiteDatabase,
  from: string,
  to: string,
): Promise<CsvExpenseRow[]> {
  const rows = await database.getAllAsync<CsvRowRecord>(
    `SELECT e.incurred_on, e.description, e.amount, e.currency, c.name AS category_name
       FROM expenses e
       LEFT JOIN categories c ON c.id = e.category_id
      WHERE e.deleted_at IS NULL
        AND e.incurred_on >= ?
        AND e.incurred_on <= ?
      ORDER BY e.incurred_on DESC, e.created_at DESC`,
    [from, to],
  );
  return rows.map((row) => ({
    incurredOn: row.incurred_on,
    description: row.description,
    categoryName: row.category_name,
    amount: row.amount,
    currency: row.currency,
  }));
}
