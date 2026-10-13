# Pluto Web

> Public website, admin dashboard, and expense tracker for the Pluto Android application — compliance pages, marketing site, live status, account deletion flow, a role-gated operator panel, and multi-currency expense tracking with budgets and reports. Built with Next.js 16 (App Router), TypeScript, and Tailwind CSS 4.

Companion repository to **`pluto-server`** (the NestJS API).

---

## Routes

### Public (statically prerendered, SEO-friendly)

| Route | Purpose |
| :--- | :--- |
| `/` | Landing page: features, live ECB rates, backup walkthrough, Play Store CTA |
| `/login` | **Sign-in** - Google Sign-In for any account; redirects to `/expenses` when a session is already valid. |
| `/privacy` | Privacy Policy (drafted from the API's actual data flows — review with counsel) |
| `/terms` | Terms of Service (draft — governing law placeholder flagged in source) |
| `/support` | FAQ / support page |
| `/status` | Live health dashboard (`GET /v1/health` + `GET /v1/rates/latest`, auto-refresh) |
| `/delete-account` | **Google Play data-deletion URL** — web Google Sign-In → optional backup export → typed confirmation → `DELETE /v1/users/me` |
| `404` | Not-found page |

### Admin (client-rendered, requires `ADMIN_EMAILS` role)

| Route | Purpose |
| :--- | :--- |
| `/admin/login` | Google web sign-in; rejects non-admin accounts |
| `/admin` | Overview: users, backups, storage, sessions, latest rate snapshot, scheduler locks |
| `/admin/users` | User list with search + pagination |
| `/admin/users/[id]` | User detail: revoke sessions, delete backups, delete account |
| `/admin/backups` | All backups across users, status filter, delete |
| `/admin/rates` | Rate snapshot history (sync/provider health) |
| `/admin/system` | API/DB health, environment, scheduler locks |

The admin layout gates every `/admin/*` route (except `/admin/login`) by calling
`GET /v1/admin/stats`; a `403` renders the "no admin access" screen, a `401` clears
the session.

### Expenses (client-rendered, requires sign-in)

| Route | Purpose |
| :--- | :--- |
| `/expenses` | Dashboard: period summary with vs-previous delta, top expenses, category breakdown, filterable + paginated list, CSV export |
| `/expenses/new` | Record an expense |
| `/expenses/[id]/edit` | Edit an existing expense |
| `/expenses/categories` | Manage categories (create, rename, recolour, delete) |
| `/expenses/budgets` | Manage budgets and see budget-vs-actual for the month |
| `/expenses/reports` | Charts: monthly spending trend, day-of-week pattern and category breakdown, with click-through and CSV export |

The dashboard and reports pages accept deep links: `/expenses?categoryId=…&from=…&to=…`
pre-filters the list, which is how selecting a chart element on `/expenses/reports`
drills into the matching expenses. The "Export CSV" button on either page downloads
`GET /v1/expenses/export.csv` for the current filters.

The expenses layout gates every `/expenses/*` route by calling `GET /v1/users/me`
(any signed-in user, not just admins). A `401` — after the client's transparent
refresh replay — clears the session and renders a "Sign-in required" screen that
links to `/login`. `/login` is the entry point for regular accounts; `/admin/login`
is separate because it rejects non-admins.

Amounts can be entered in any supported currency. Reports convert to a chosen
**base currency**, resolved as `?base=` URL override → `localStorage`
(`pluto.baseCurrency`) → the server's `EXCHANGE_RATE_BASE_CURRENCY` default. The
base picker is populated from the public `GET /v1/rates/supported-currencies`
endpoint. When no rate snapshot is available the reports degrade gracefully —
native per-currency figures still render and the converted totals show as
unavailable rather than erroring.

---

## Local development

### Prerequisites

- pluto-server running locally (see its README) — default `http://localhost:3000/v1`
- Node.js 20.19+ / 22+

### Setup

```powershell
npm install
Copy-Item .env.example .env.local   # then fill in real values
npm run dev                          # http://localhost:3001
```

The dev server intentionally runs on **port 3001** to avoid clashing with pluto-server on 3000.

**For local development:** Set up Google OAuth with a test client ID (add `http://localhost:3001` to authorized origins) and ensure `GOOGLE_ALLOWED_CLIENT_IDS` includes it. The server also supports `ENABLE_DEV_AUTH=true` + `POST /v1/auth/dev-login` for programmatic access (no UI on `/login`).

### Environment variables

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Base URL of pluto-server including the version prefix (e.g. `http://localhost:3000/v1`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth 2.0 **Web** Client ID. Must also be listed in the server's `GOOGLE_ALLOWED_CLIENT_IDS`, and this origin (e.g. `http://localhost:3001`) must be in the client's *Authorized JavaScript origins* |
| `NEXT_PUBLIC_ENABLE_DEV_AUTH` | No longer used (dev UI removed). Can be omitted. |
| `NEXT_PUBLIC_SITE_URL` | Absolute site URL for metadata/OpenGraph |

### Server-side configuration checklist (pluto-server)

1. `ADMIN_EMAILS="your.email@example.com"` — promotes you to `ADMIN` on sign-in
2. `GOOGLE_ALLOWED_CLIENT_IDS` — includes the same Web Client ID as above
3. `CORS_ORIGIN` — includes this site's origin (e.g. `http://localhost:3001`)

---

## Scripts

```powershell
npm run dev     # dev server on :3001
npm run build   # production build (static prerender of all public routes)
npm run start   # serve production build on :3001
npm run lint    # ESLint (Next 16 + react-hooks strict rules)
```

## Architecture notes

- **API client** (`src/lib/api.ts`): access token in memory, refresh token in
  `localStorage`, single-flight rotation on `401` with one replay of the original
  request, responses unwrapped from the server's `{ success, data, timestamp }` envelope.
- **Google Sign-In** (`src/components/google-sign-in.tsx`): Google Identity Services
  button → ID token → `POST /v1/auth/google` (same endpoint the Android app uses).
  Mounted at `/login` (any account), `/admin/login` (admins only), and
  `/delete-account`.
- **Session state** (`src/lib/api.ts`): the persisted refresh token is exposed to
  React as an external store (`subscribeSession` / `getSessionSnapshot`, notified by
  `saveSession` and `clearSession`), so the header's Sign in / Sign out control
  switches without an effect-driven read of `localStorage`.
- **Charts** (`recharts`): the expense report charts are the only non-Next/React
  runtime dependency. `Tooltip.formatter` values are normalized before `Number()`
  because Recharts types them as `number | string | Array<…> | undefined`.
- **Base currency** (`src/lib/base-currency.ts`): read through `useSyncExternalStore`
  (a genuine external store) so the value is correct on the first render — no
  effect-driven refetch and no hydration mismatch from reading `window` during render.
- **Legal pages** are drafts derived from the implemented data flows — have counsel
  review before launch (flagged `DRAFT` in source).

## Launch checklist

- [ ] Replace `support@pluto.app` placeholders in `/privacy`, `/terms`, `/support`
- [ ] Fill in governing law in `/terms` §11
- [ ] Replace the Play Store URL in `src/app/(public)/page.tsx`
- [ ] Real Google Web Client ID + Authorized JavaScript origins
- [ ] `NEXT_PUBLIC_SITE_URL` for the production domain
- [ ] Submit `/delete-account` as the data-deletion URL in Google Play Console
