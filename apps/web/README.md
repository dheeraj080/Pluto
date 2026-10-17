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
| `NEXT_PUBLIC_SITE_URL` | Absolute site URL for metadata/OpenGraph, and the origin written into `robots.txt` and `sitemap.xml` |

> `NEXT_PUBLIC_*` values are inlined into the client bundle at **build** time, not read at runtime. Set them when `next build` runs (locally in `.env.local`, or as Docker build args — see [Deployment](#deployment)).

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
- **Error boundaries** (`src/app/error.tsx`, `src/app/global-error.tsx`): route
  errors render a recoverable fallback (Next 16's `retry()`), and `global-error`
  covers a failure in the root layout itself — it renders its own document with
  inline styles, since it does not inherit `globals.css`.
- **Crawl policy**: `src/app/robots.ts` disallows the signed-in surfaces
  (`/admin`, `/expenses`, `/onboarding`) and points at the sitemap;
  `src/app/sitemap.ts` lists only the public pages. Both are anchored to
  `NEXT_PUBLIC_SITE_URL`.
- **Security headers** (`next.config.ts`): `nosniff`, `X-Frame-Options: DENY`,
  a referrer policy, a restrictive `Permissions-Policy`, HSTS, and
  `X-Robots-Tag: noindex` on `/admin/**` and `/expenses/**` as defence-in-depth
  alongside `robots.ts`. `poweredByHeader` is off. A Content-Security-Policy is
  intentionally **not** set here — Next injects inline bootstrap scripts, so a
  correct CSP needs per-request nonces and belongs at the edge/reverse proxy.

## Deployment

### Vercel (recommended)

Vercel ships a first-party (verified) Next.js adapter, so deployment is
zero-config beyond project settings:

1. Import the repository into Vercel.
2. Set **Root Directory** to `apps/web`. Vercel detects the npm workspace and
   installs from the repository root; leave the build command auto-detected.
3. Add the variables below **per Vercel environment** (Production / Preview /
   Development). `NEXT_PUBLIC_*` are inlined at build time, so each environment
   must build with its own values.

| Variable | Production | Preview / staging |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://api.pluto.example/v1` | `https://pluto-server-staging.onrender.com/v1` |
| `NEXT_PUBLIC_SITE_URL` | `https://pluto.example` | `https://staging.pluto.example` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | production Web client ID | staging Web client ID |

Every pull request then gets a preview deployment automatically. See
[`docs/ENVIRONMENTS.md`](../../docs/ENVIRONMENTS.md) for the cross-app picture.

> **Standalone output is disabled on Vercel.** `next.config.ts` sets
> `output: "standalone"` only when `process.env.VERCEL` is unset. On Next 16.3+
> a standalone build breaks Vercel's `onBuildComplete` (it can no longer find
> `.next/next-server.js.nft.json`); Vercel produces its own output instead.

`vercel.json` sets the **Ignored Build Step** so a commit that does not touch
`pluto-web` (or a package it depends on) skips the build:

```
turbo query affected --base=$VERCEL_GIT_PREVIOUS_SHA --packages pluto-web --exit-code
```

Vercel provides `turbo` globally, and treats exit `0` as *skip* / `≥1` as
*build* — so an error or missing `VERCEL_GIT_PREVIOUS_SHA` results in a normal
build, never a wrongly-skipped one.

#### CORS with preview deployments

Preview URLs are unique per commit (`pluto-web-git-<branch>-<team>.vercel.app`)
and the API's `CORS_ORIGIN` is an explicit list — a wildcard is rejected in
production and per-commit origins cannot be enumerated ahead of time. Rather
than chasing preview URLs:

- Assign a **stable domain** to the staging branch in Vercel (e.g.
  `staging.pluto.example`) and add that one origin to the *staging* API's
  `CORS_ORIGIN`.
- Add the production domain to the *production* API's `CORS_ORIGIN`.

Each origin must also be registered on its Google Web client's *Authorized
JavaScript origins*.

### Docker / self-hosting (alternative)

The app also builds to a self-contained Next.js **standalone** server
(`output: "standalone"` in `next.config.ts`) and ships as a small image. The
build context is the **repository root** (npm workspaces):

```bash
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/v1 \
  --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://app.example.com \
  -t pluto-web .

docker run -p 3001:3001 pluto-web
```

`NEXT_PUBLIC_*` must be supplied as build args: they are baked into the bundle,
so passing them to `docker run` has no effect. The runtime image runs as the
non-root `node` user and serves on `PORT=3001`. (Build locally — the Docker
image needs `output: "standalone"`, which the `VERCEL` guard skips only inside
Vercel's build environment.)

## Launch checklist

- [ ] Replace `support@pluto.app` placeholders in `/privacy`, `/terms`, `/support`
- [ ] Fill in governing law in `/terms` §11
- [ ] Replace the Play Store URL in `src/app/(public)/page.tsx`
- [ ] Real Google Web Client ID + Authorized JavaScript origins (per environment)
- [ ] Vercel project with **Root Directory = `apps/web`**
- [ ] `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` set per Vercel environment
- [ ] A stable staging domain assigned + added to the staging API's `CORS_ORIGIN`
- [ ] Production domain added to the production API's `CORS_ORIGIN`
- [ ] Submit `/delete-account` as the data-deletion URL in Google Play Console
- [ ] If using the Docker image instead: build it with real `NEXT_PUBLIC_*` **build args**
- [ ] Verify `/robots.txt` and `/sitemap.xml` resolve against each environment's `NEXT_PUBLIC_SITE_URL`
