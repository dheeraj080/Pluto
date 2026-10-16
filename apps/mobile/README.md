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
scan the QR code. `npm run typecheck`, `npm run lint` and `npm run test` run from
this directory (or via Turbo).

### Expo Go or a development build

`expo-dev-client` is installed, so `expo start` targets a **development build** —
which is what Google Sign-In and any other native module require. To keep
running in Expo Go instead (JS-only, no native Google sign-in):

```bash
npx expo start --go
```

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
| `delete-account` | In-app account deletion (see below) |

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

Two ways in:

| | Offered | Endpoint |
| :--- | :--- | :--- |
| **Google Sign-In** | every build | `POST /v1/auth/google` |
| Development login | `__DEV__` builds only | `POST /v1/auth/dev-login`, needs `ENABLE_DEV_AUTH=true` |

Google runs through `src/lib/google-sign-in.ts`: the native SDK yields an ID
token, which is posted to the same endpoint the web client uses. The SDK is
imported **lazily**, so a session with no native module (Expo Go) still renders
the screen and reports why sign-in cannot start, instead of dying at launch.

Two client IDs are involved and are easy to mix up:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — the *web* client, the audience Google
  stamps on the ID token. It must be a **Web application** client: the native SDK
  hands this value to `requestIdToken`, so a native (Android/iOS) client ID here
  makes Google reject the sign-in intent as an invalid audience, which surfaces as
  the same `DEVELOPER_ERROR` (status `10`) as an unregistered Android client — see
  below. **`apps/server` must list the same ID in `GOOGLE_ALLOWED_CLIENT_IDS`**, or
  `/auth/google` rejects every token. This is the usual cause of a 401 after a
  successful-looking sign-in.
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` — the iOS client. Its reversed form
  (`com.googleusercontent.apps.<id>`) is registered as a URL scheme by the
  Google config plugin in `app.config.ts`, which is added *only* when this is
  set — the plugin refuses to run with neither that option nor Firebase files.

The Android client is a third, separate credential, keyed on the package name
(`com.pluto.app`) plus the **SHA-1** of the certificate that signed the installed
APK. The native SDK resolves it from the running app rather than being handed it,
so it is not an ID-token audience and does **not** belong in
`GOOGLE_ALLOWED_CLIENT_IDS` — only client IDs that can appear as the token's
`aud` (the web client, and the iOS client when iOS ships) go there.

`DEVELOPER_ERROR` (status `10`) has **two** causes, and the picker fails before
either is obvious:

1. no Android client matches the package name plus the installed APK's SHA-1;
2. `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is not a *Web application* client.

Both put a bad value in the same sign-in intent, so the status code alone cannot
tell them apart. Which client types a Console credential is can be checked on the
**Credentials** page — the type is printed under each client ID — and from the
command line without Console access, since a Web client requires a
`client_secret` while a native one does not:

```bash
# Web clients are confidential and demand a secret; native clients are not.
curl -s https://oauth2.googleapis.com/token \
  -d grant_type=authorization_code -d code=x \
  -d redirect_uri=http://localhost -d client_id="$CLIENT_ID"
#   "client_secret is missing"  -> Web client  (correct for this variable)
#   "Malformed auth code"       -> Android/iOS (belongs on the Android client)
```

The web target resolves `src/lib/google-sign-in.web.ts` instead, which points at
the web app — so the mobile bundle never pulls a native module in.

> The button reuses Pluto's `Button` rather than Google's branded control. If the
> client is ever submitted for OAuth verification that restricts displayed
> branding, swap in `GoogleSigninButton`.

## Account deletion

Google Play requires an app that offers account creation to offer account
*deletion* without leaving the app. `src/app/delete-account.tsx` is that surface,
linked from the **Danger zone** card on Settings; the website answers the same
requirement with `apps/web/src/app/(public)/delete-account/page.tsx`, and the
mobile flow mirrors it step for step:

1. **What will be erased** — the profile, every cloud backup, and all sessions.
2. **Download a copy (optional)** — the completed backups are listed and each is
   opened through its presigned URL (`openBrowserAsync`).
3. **Type `DELETE`** — the destructive button stays disabled until the phrase
   matches. A tap alone is too little consent for the one irreversible action in
   the app.
4. `DELETE /v1/users/me` — the server cascades the profile, backups and refresh
   sessions (deleting the S3 objects first), so a failure leaves the account
   intact and retryable.

`deleteAccount()` in `src/lib/api.ts` clears the local session **only once the
server confirms**. Unlike `signOut()` it skips the web client's best-effort
`/auth/logout` call first: there is no session row left to revoke. The done state
returns to `/sign-in`.

## Crash reporting

Sentry, behind `EXPO_PUBLIC_SENTRY_DSN`. `src/lib/crash-reporting.ts` wraps the
SDK so that **every export is a no-op when the DSN is unset**: local development,
Expo Go and CI run identically with no Sentry project, and a release opts in by
setting the variable on its EAS profile. The native config plugin in
`app.config.ts` is registered under the same condition, so a repo that never sets
a DSN never sees a missing-organization warning from `expo config`.

- `initCrashReporting()` runs at module scope in `src/app/_layout.tsx` — before
  the first render, and idempotent — so a crash in the layout itself is caught.
- `Sentry.ErrorBoundary` wraps the providers rather than sitting inside them, so a
  crash in a provider is reported; its fallback paints from module-level theme
  values because it cannot use hooks.
- `setCrashReportingUser()` attaches **only the user id**, never the email or
  name: an opaque id is enough to say "one account or many?" without shipping PII
  to a third party.
- `captureException()` is for errors the app *recovers* from (a failed export, a
  dropped request); render errors reach Sentry through the boundary.

## Testing

Vitest — the runner the other workspaces use; the app's config is
`vitest.config.ts`. From this directory (or via Turbo):

```bash
npm run test          # vitest run
npm run test:watch    # vitest
```

The suite is deliberately node-only (`environment: 'node'`): no component
renderer and no native modules, because the logic worth pinning does not need a
device. What each file holds still:

| File | What it pins down |
| :--- | :--- |
| `ranges.test.ts` | the window math — month-to-date against *the same days of last month*, equal-length trailing windows, granularity thresholds |
| `format.test.ts` | `parseAmount` / `isValidIsoDate` / `formatBytes` — the contract with the DTOs and the backup list |
| `date.test.ts`, `date-grouping.test.ts` | Today/Yesterday labelling and Activity list bucketing |
| `recurrence.test.ts`, `errors.test.ts` | cadence wording and error-message extraction |
| `session.test.ts` | a sign-out drops the token *and* the query cache |
| `api.test.ts` | `401 → refresh → replay`, refused vs unreachable rotation, and that `deleteAccount` clears the session only once the server confirms |
| `crash-reporting.test.ts` | every reporting call is a no-op without `EXPO_PUBLIC_SENTRY_DSN` |
| `app.config.test.ts` | the production guard — https API URL, a real host, a Google client ID — and that the Sentry config plugin registers only with a DSN |

`@pluto/api-client` is aliased straight to its TypeScript source and the
secure-store boundary is mocked, so the suite needs no device, network or native
build.

## Building and releasing

There are two paths: the **Android development client** is built by GitHub
Actions and needs no local toolchain and no Expo account; **release builds** go
through EAS.

### Android dev client (GitHub Actions)

`.github/workflows/android-dev-client.yml` runs `expo prebuild` and
`gradlew assembleDebug` on a GitHub runner and uploads the APK as the
`pluto-android-dev-client` artifact. Trigger it from **Actions → Android dev
client → Run workflow**, or push to `main` with a change under `apps/mobile/**`.
Nothing is installed on your machine; download the artifact and `adb install` it.

A development client loads its JavaScript from Metro, so `EXPO_PUBLIC_*` values
still come from `.env` on the machine running `expo start` — restart Metro after
changing them. (Only release builds bake the bundle in.) The APK's *signing*,
however, is fixed at build time, which is why the key below matters.

#### The signing key, and why the SHA-1 matters

Google rejects Android sign-in unless the Cloud Console **Android** OAuth client
lists the app's package name (`com.pluto.app`) *and* the SHA-1 of the certificate
that signed the installed APK. Runner filesystems are discarded after each job,
so unless a key is pinned, every run signs with a throwaway one and both the
SHA-1 and the registration go stale.

Set the **`ANDROID_DEBUG_KEYSTORE_B64`** repository secret to the base64 of a
`debug.keystore` (alias `androiddebugkey`, storepass/keypass `android`); the
`keytool` command that generates it is in the workflow's header comment. Without
it the workflow warns that the reported SHA-1 will not survive the next run.

The **Verify and report the signing fingerprint** step prints `PLUTO_ANDROID_PACKAGE=` and
`PLUTO_ANDROID_SHA1=` and writes both to the run's *Summary*. Register that pair
on the Android client, or the native SDK fails with `DEVELOPER_ERROR` (status
code `10`) — which looks like a broken app but is really an unregistered build.

To read the same pair off *any* APK — a local build, an EAS build, or one pulled
from a device — without an Android SDK:

```bash
npm run apk:fingerprint --workspace pluto-mobile -- ../../internal/app-debug.apk
```

It prints the package name and the SHA-1/SHA-256 of every signing certificate in
the APK, in the form Console wants. It reads the v2/v3 signing block directly,
because a modern APK no longer carries the v1 JAR signature that
`keytool -printcert -jarfile` looks for, and the library's own `config-doctor`
needs a paid licence. The app also names this command itself: a
`DEVELOPER_ERROR` is rewritten on the sign-in screen into the two values to
compare.

CI runs this same reader (`--sha1`) against the built APK and fails the job if
the artifact's certificate cannot be read or does not match the pinned key — so
a green run reporting `PLUTO_ANDROID_SHA1_SOURCE=apk` means the artifact really
is signed with that key, not merely that a keystore file was present.

This is a *debug* key: right for dev clients, never for a release build. A
release build needs its own key (see below); if you enable Play App Signing, the
fingerprint that matters is Google's app-signing one, which only exists after the
first upload.

### Release builds (EAS)

Release builds go through EAS (`eas.json`); there is no local signing setup.
Install the CLI once and sign in with the Expo account that owns the project:

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

### Build-time environment variables

`EXPO_PUBLIC_API_URL` is inlined at bundle time and defaults to
`http://localhost:3000/v1`, which is correct only for local development.
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is inlined the same way, and is the audience
the server's token check matches against.

Set both as **EAS environment variables** scoped to each non-development profile
(`eas env:create`), pointing at the deployed API over HTTPS.

`EXPO_PUBLIC_SENTRY_DSN` turns on crash reporting (see above) and is inlined the
same way. When it is set, EAS also needs `SENTRY_ORG`, `SENTRY_PROJECT` and
`SENTRY_AUTH_TOKEN` so the config plugin can upload sourcemaps; those are read
from the build environment and are never written into the app config.

`app.config.ts` refuses a `production` build whose `EXPO_PUBLIC_API_URL` is
missing, plain `http`, or a development host — or whose
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is unset, which would ship a release with no
way to sign in — so a misconfigured build fails at build time rather than on a
user's phone.

### Versioning

`cli.appVersionSource` is `remote`, so EAS owns the iOS build number and the
Android version code and the `production` profile increments them automatically.
The user-facing `version` in `app.config.ts` is still edited by hand.

`expo-dev-client` is installed, so the `development` profile is usable as-is.
`npx expo start --go` is the fallback for keeping to Expo Go (JS-only, no
native Google sign-in) while you work.
