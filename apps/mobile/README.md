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
| `(tabs)/index` | Overview — month summary, 5 most recent expenses |
| `(tabs)/transactions` | Full list — search, sort, category filter, infinite scroll |
| `(tabs)/settings` | Profile, base currency, sign out |
| `expense/new` | Create (modal) |
| `expense/[id]/index` | Detail, with edit and delete |
| `expense/[id]/edit` | Edit |

`(tabs)/_layout.tsx` guards the whole shell: `loading` shows a spinner and
`signed-out` redirects to `/sign-in`, so no tab ever mounts and fires an
authenticated request before the session is restored.

Data access is TanStack Query. Hooks in `src/hooks` own every request
(`use-expenses` — list and summary, `use-expense`, `use-expense-mutations`,
`use-categories`, `use-currencies`, `use-user`); screens never call `fetch`
directly. Query keys and the filter/sort vocabulary are in
`src/lib/query-keys.ts`.

Two things are deliberate and easy to "fix" by mistake:

- `src/lib/routes.ts` casts a few hrefs. Typed routes derive their union from
  *file paths*, so `expense/[id]/index.tsx` generates `/expense/[id]/index`
  while the router serves `/expense/<id>`. The cast bridges that naming gap; the
  URLs themselves are the canonical ones.
- Icons and the brand mark are **Pluto's own**, drawn with `react-native-svg` in
  `src/components/icons.tsx` and `src/components/logo.tsx`, ported glyph-for-glyph
  from the web app. There is no icon font: every glyph takes an explicit `size`
  and `color`, because React Native has neither `currentColor` nor CSS sizing.

## Design system

`src/theme` is the single source of every colour, radius, spacing step and text
style. Screens compose those tokens; they do not invent values.

| Module | Holds |
| :--- | :--- |
| `src/theme/palette.ts` | `darkPalette` / `lightPalette` — the colour ramps |
| `src/theme/typography.ts` | `fontFamily`, `fontSize`, `text` (named styles) |
| `src/theme/tokens.ts` | `spacing`, `radius`, `controlHeight`, `borderWidth`, `layout` |

**The dark palette mirrors `apps/web/src/app/globals.css` exactly.** The web app
is dark-only, so the light ramp is mobile's own invention and is asserted against
nothing. `npm run check:theme` cross-checks all 39 mapped tokens between the two
files and runs as part of `typecheck`, so editing one side without the other fails
the build.

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

`src/constants/theme.ts` is a **transitional** shim: it re-states the Expo
template's old token names (`Colors`, `Spacing`, `BottomTabInset`, and the
`textSecondary`/`backgroundElement` colour aliases) on top of the Pluto palette
so the screens written before the design system keep compiling. New code imports
from `@/theme`; the shim goes away as the screens are migrated.

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

Not set up yet. React Native uses Jest; see `internal/mobile-plan.md` Phase 5.
