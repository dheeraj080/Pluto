# pluto-mobile

Expo (React Native + TypeScript + Expo Router) client for Pluto, living in the
`apps/mobile` workspace of the Pluto monorepo.

## Prerequisites

- Node >= 20.19 (repo `engines`), npm 11
- Install from the **repository root** so npm workspaces hoist correctly:
  ```bash
  npm install
  ```

## Running

The API must be reachable; see `apps/server` and `apps/mobile/.env.example`.
Start it first, in its own terminal:

```bash
npm run dev --workspace pluto-server
```

Then start Metro. Prefer `dev:lan`, which detects this machine's LAN address,
writes it to `.env`, and launches Expo — one value that works for both the
physical device and the web preview:

```bash
# from the repo root
npm run dev:lan --workspace pluto-mobile
```

Plain `npm run dev --workspace pluto-mobile` also works, but only uses whatever
`.env` already holds. Then press `a` (Android) or `i` (iOS) in the Expo CLI, or
scan the QR code. `npm run typecheck` and `npm run lint` run from this directory
(or via Turbo).

### Backend must be up, or every screen shows "Internal server error"

That message is the server's 500 envelope, not a client bug. The usual cause is
that `apps/server/.env`'s `DATABASE_URL` points at a host Prisma cannot reach,
which surfaces as:

```
PrismaClientInitializationError: Can't reach database server at `<host>:5432`
```

Every request that touches the database then fails after a ~5s connection
timeout. `/v1/health` is the fastest way to tell: `"database":{"status":
"connected"}` means good, `"status":"unreachable"` means the DB is the problem,
not the app.

For local development run the bundled Postgres and point `DATABASE_URL` at it:

```bash
docker compose -f apps/server/docker-compose.yml up -d postgres
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pluto_db?schema=public"
npm exec --workspace pluto-server -- prisma migrate deploy
```

### Never build or test the server while its watcher is running

`npm run build`/`npm test` in `pluto-server` overwrite `apps/server/dist/` while
`nest start --watch` is serving from it, which kills the running API. Stop the
watcher first.

### API base URL

`EXPO_PUBLIC_API_URL` (see `.env.example`) is inlined by Metro at build time.
It must include the `/v1` prefix:

| Target | Value |
| :--- | :--- |
| Android emulator | `http://10.0.2.2:3000/v1` |
| iOS simulator | `http://localhost:3000/v1` |
| Physical device | `http://<your-lan-ip>:3000/v1` |

## App structure

Routes live in `src/app` (Expo Router, typed routes enabled):

| Route | Screen |
| :--- | :--- |
| `(tabs)/index` | Dashboard — spending, budget, comparison, recent, categories, rate |
| `(tabs)/transactions` | Activity — full list, search, sort, category filter, infinite scroll |
| `(tabs)/budgets` | Budgets — per-category and whole-account limits, month by month |
| `(tabs)/categories` | Categories — create, rename, recolour, delete |
| `(tabs)/settings` | Profile, base currency, sign out |
| `expense/new` | Create (modal) |
| `expense/[id]/index` | Detail, with edit and delete |
| `expense/[id]/edit` | Edit |

Reports is the one web surface still missing a tab. Its loaders
(`src/hooks/use-reports.ts`) and date helpers (`src/lib/ranges.ts`) are in place,
and the charts it needs now exist in `src/components/charts.tsx`, so the screen
is the remaining piece rather than the foundation.

`(tabs)/_layout.tsx` guards the whole shell: `loading` shows a spinner and
`signed-out` redirects to `/sign-in`, so no tab ever mounts and fires an
authenticated request before the session is restored.

Data access is TanStack Query. Hooks in `src/hooks` own every request
(`use-expenses` — list and summary, `use-expense`, `use-expense-mutations`,
`use-categories` + `use-category-mutations`, `use-currencies`, `use-user`,
`use-budgets`, `use-pair`, `use-rates`, `use-dashboard`, `use-reports`);
screens never call `fetch` directly. Query keys and the filter/sort vocabulary
are in `src/lib/query-keys.ts`.

The dashboard's month comparison has its own key namespace
(`queryKeys.dashboard.comparison`) even though it takes the same parameters as
the reports one: it pairs month-to-date with *the same days of last month*,
while a report range pairs with the trailing window of equal length. Same
parameters, different requests — sharing a cache entry would serve the wrong
figures.

A category write invalidates both the `categories` and the `expenses`
namespaces, because a rename or a recolour changes the label and dot on every
cached expense row — not just the category list.

Shared UI lives in `src/components/ui`: `Card`/`StatCard`, `Button`, `Chip`,
`TextField`, `Badge`, `ChangePill`, `ConversionNote`, `AppPageHeader`, and the
`Spinner`/`ErrorNote`/`Skeleton`/`EmptyState` family. Screens compose those
rather than hand-rolling styles, so a change to the design language is one edit,
not twenty.

Dashboard cards share one frame (`src/components/dashboard/card.tsx`, ported
from the web's `ChartFrame`) so the six read as a single surface, and the
cross-currency display (`src/components/amount.tsx`) is the same
Base-plus-Second pairing the web uses.

Charts are drawn directly with `react-native-svg` in `src/components/charts.tsx`
rather than through a charting library. Recharts cannot run without a DOM, and
adding a React Native chart library for two line shapes would mean another
native dependency and another dev-client rebuild. Two deliberate differences
from the web:

- **No hover tooltip.** There is no pointer on a touch screen, so the figures a
  tooltip would reveal are stated in the card body instead of hiding behind a
  gesture nobody can perform.
- **No `Table` toggle** on the dashboard comparison card. The web passes
  `hideTableToggle` there too, so the two agree.

Three things are deliberate and easy to "fix" by mistake:

- `src/lib/routes.ts` casts a few hrefs. Typed routes derive their union from
  *file paths*, so `expense/[id]/index.tsx` generates `/expense/[id]/index`
  while the router serves `/expense/<id>`. The cast bridges that naming gap; the
  URLs themselves are the canonical ones.
- Icons and the brand mark are **Pluto's own**, drawn with `react-native-svg` in
  `src/components/icons.tsx` and `src/components/logo.tsx`, ported glyph-for-glyph
  from the web app. There is no icon font: every glyph takes an explicit `size`
  and `color`, because React Native has neither `currentColor` nor CSS sizing.
- Progress bars (`BudgetCard`, `TopCategoriesCard`) are **two flex children**
  rather than a percentage width. React Native's `DimensionValue` will not
  accept a computed percentage string, and the ratio is what matters anyway.

## Design system

`src/theme` is the single source of every colour, radius, spacing step and text
style. Screens compose those tokens; they do not invent values.

| Module | Holds |
| :--- | :--- |
| `src/theme/palette.ts` | `darkPalette` / `lightPalette` — the colour ramps |
| `src/theme/typography.ts` | `fontFamily`, `fontSize`, `text` (named styles) |
| `src/theme/tokens.ts` | `spacing`, `radius`, `controlHeight`, `borderWidth`, `layout` |

**Both palettes mirror `apps/web/src/app/globals.css` exactly.** `darkPalette`
matches the `:root` ramp and `lightPalette` matches `:root[data-theme="light"]`.
`npm run check:theme` cross-checks all 39 mapped tokens in both themes between
the two files and runs as part of `typecheck`, so editing one side without the
other fails the build.

Appearance is a user preference (`system` / `light` / `dark`), stored in
`src/lib/theme-preference.ts` and resolved into the active palette by
`src/hooks/use-color-scheme.ts`. The control lives on the Settings screen.

Fonts are Inter (body) and Space Grotesk (display/headings), loaded via
`expo-font` in `src/app/_layout.tsx`, which holds the splash screen until they
register. Each weight is registered as its own family name because Android will
not resolve a weight out of a bundled family.

App icons and the splash mark are generated, not hand-drawn:

```bash
npm run assets:brand   # writes assets/images/*.png from the brand geometry
```

`scripts/generate-brand-assets.mjs` rasterises the same planet-and-orbit mark as
the web's `lib/brand-mark.ts`, so the launcher icon, the splash and the in-app
`PlutoMark` cannot drift apart.

`scripts/generate-brand-assets.mjs` rasterises the same planet-and-orbit mark as
the web's `lib/brand-mark.ts`, so the launcher icon, the splash and the in-app
`PlutoMark` cannot drift apart.

## Dashboard

`src/app/(tabs)/index.tsx` answers six questions in order, and the order is the
web's own phone order — it is what the web's 12-column grid collapses to below
the `lg` breakpoint:

| Card | Question |
| :--- | :--- |
| `dashboard/spending-card` | how much have I spent this month? |
| `dashboard/budget-card` | am I on budget, and how much per day? |
| `dashboard/comparison-card` | faster or slower than last month? |
| `dashboard/recent-card` | what did I buy recently? |
| `dashboard/top-categories-card` | where is the money going? |
| `dashboard/rate-card` | what is today's rate, and what is X worth? |

A brand-new account gets one friendly empty card instead of a grid of empty
charts. Each card owns its own loading, error and retry state, so one failed
request degrades one card rather than the page.

The month comparison is **month-to-date against the same days of last month**,
never a partial month against a whole one; that pairing lives in
`monthToDate()` in `src/lib/ranges.ts`.

## Monorepo notes

`metro.config.js` is **required** and must not be removed:

- `watchFolders` includes the repo root so `packages/*` hot-reload.
- `nodeModulesPaths` lists the app's `node_modules` before the hoisted root
  one, because npm nests a second copy of `react`/`react-dom` here (the web app
  pins a different React).
- `resolver.disableHierarchicalLookup = true` prevents a second React copy
  being pulled in from the root — two React copies in one bundle breaks hooks.

Restart Metro (`npx expo start --clear`) after installing a package. Metro's
file map is built at startup, so a package added while it is running resolves as
missing — the symptom is an `UnableToResolveError` for an asset that is plainly
on disk.

`@types/react` is pinned via an `overrides` entry in the **root** `package.json`
so TypeScript sees a single React type identity across web and mobile.

## Shared code

- `@pluto/api-client` — OpenAPI-generated DTO types plus a typed fetch client
  that unwraps the server's `{ success, data, timestamp }` envelope and handles
  `401 → refresh → replay`. Regenerate with `npm run generate --workspace
  @pluto/api-client` after the server's API changes (see that package for how
  the spec is produced).

## Auth

- Access token: memory only (`src/lib/session.ts`).
- Refresh token: `expo-secure-store` on device, `localStorage` on web
  (`src/lib/session-storage.ts`).
- Development sign-in uses the server's mock endpoint
  (`POST /v1/auth/dev-login`, requires `ENABLE_DEV_AUTH=true`).

**Google Sign-In is not wired up yet.** `@react-native-google-signin/google-signin`
is a native module and does **not** run in Expo Go — it needs an EAS development
build, which also means `expo-sqlite` and any other native module added later
must be tested in a dev build, not Expo Go.

## Testing

Not set up yet. React Native uses Jest; the mobile workspace has no `test`
script, so `turbo run test` skips it today.

## Building and releasing

Builds are EAS builds (`eas.json`); there is no local signing setup. Install the
CLI once and sign in with the Expo account that owns the project:

```bash
npm install -g eas-cli      # or call `npx eas-cli@latest` directly
eas login
eas init                    # once: links the app to the EAS project
```

Then, from this directory:

| Command | Profile | Output |
| :--- | :--- | :--- |
| `npm run eas:build:dev` | `development` | Dev client, for native modules |
| `npm run eas:build:preview` | `preview` | Installable APK / ad-hoc iOS build |
| `npm run eas:build:prod` | `production` | Store-ready AAB / IPA |
| `npm run eas:submit:prod` | `production` | Upload to Google Play / App Store |

### The API URL is per profile

`EXPO_PUBLIC_API_URL` is inlined at bundle time and defaults to
`http://localhost:3000/v1`, which is correct only for local development. Set it
as an **EAS environment variable** scoped to each non-development profile
(`eas env:create`), pointing at the deployed API over HTTPS.

`app.config.ts` refuses a `production` build whose `EXPO_PUBLIC_API_URL` is
missing, plain `http`, or a development host, so a misconfigured release fails
at build time rather than on a user's phone.

### Versioning

`cli.appVersionSource` is `remote`, so EAS owns the iOS build number and the
Android version code and the `production` profile increments them automatically.
The user-facing `version` in `app.config.ts` is still edited by hand.

The `development` profile builds a dev client and needs `expo-dev-client`
(`npx expo install expo-dev-client`). Until it is installed, Expo Go still runs
the app; once it is, `npx expo start --go` is the way to keep using Expo Go.
