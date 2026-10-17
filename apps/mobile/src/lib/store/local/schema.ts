/**
 * On-device schema.
 *
 * Columns are snake_case to match SQL; `expenses.ts`/`categories.ts` map them to
 * the camelCase DTOs the screens consume. Two columns are local-only:
 *
 * - `sync_state` marks whether a row has ever reached the server. An unsynced
 *   row's edits rewrite its queued `create` instead of stacking an `update`.
 * - `mutations` is the write-ahead queue that survives a crash or a kill.
 */
export const SCHEMA_VERSION = 1;

export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  description TEXT,
  payment_method TEXT,
  incurred_on TEXT NOT NULL,
  recurring_expense_id TEXT,
  client_updated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_state TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS expenses_incurred_on_idx ON expenses (incurred_on);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses (category_id);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  expense_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mutations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  op TEXT NOT NULL,
  client_updated_at TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mutations_entity_idx ON mutations (entity, entity_id);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);
`;
