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
export const SCHEMA_VERSION = 3;

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

/**
 * Report mirrors (v2).
 *
 * `rate_tables` holds the immutable exchange-rate snapshots a report needs to
 * convert on-device, keyed by the reporting base so a base change keeps its own
 * window. `rates`/`dates` are the snapshot's maps serialized as JSON — the
 * engine hands them straight back to `RateResolver`:
 *
 * - `rates` maps a quote currency to decimal strings, `dates` to its observation
 *   date when it differs from `effective_date`.
 *
 * `budgets` mirrors the account's budgets so budget-vs-actual can be computed
 * offline. It stores only the fields the engine needs; the category name and
 * colour come from the `categories` mirror.
 */
export const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS rate_tables (
  base_currency TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  version INTEGER NOT NULL,
  provider TEXT NOT NULL,
  rates TEXT NOT NULL,
  dates TEXT,
  PRIMARY KEY (base_currency, effective_date)
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  period TEXT NOT NULL,
  start_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

/**
 * Offline decisions (v3).
 *
 * - `pending_profile` is the queued `PATCH /users/me` — a single row (a newer
 *   base-currency choice replaces an older one), replayed by the sync engine
 *   once the server answers again.
 *
 * - `occurrences` mirrors the recurring rules' due charges so the Recurring
 *   screen renders, and decides, with no connection. It stores the fields the
 *   screen and the confirm payload both read; the category name/colour stay in
 *   the `categories` mirror.
 *
 * - `recurring_actions` is the write-ahead queue for confirms/skips the server
 *   has not seen yet. A queued `confirm` carries the local expense it created
 *   so the replay can retire that row the moment the server materialises its
 *   own copy (the server mints the authoritative expense id).
 */
export const SCHEMA_V3 = `
CREATE TABLE IF NOT EXISTS pending_profile (
  id INTEGER PRIMARY KEY CHECK (id = 0),
  payload TEXT NOT NULL,
  client_updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS occurrences (
  id TEXT PRIMARY KEY NOT NULL,
  recurring_expense_id TEXT NOT NULL,
  due_on TEXT NOT NULL,
  status TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  category_id TEXT NOT NULL,
  description TEXT,
  payment_method TEXT,
  expense_id TEXT,
  confirmed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS occurrences_status_idx ON occurrences (status, due_on);

CREATE TABLE IF NOT EXISTS recurring_actions (
  occurrence_id TEXT PRIMARY KEY NOT NULL,
  action TEXT NOT NULL,
  local_expense_id TEXT,
  created_at TEXT NOT NULL
);
`;
