# Pluto (Android)

The native Android client for Pluto, written in Kotlin with Jetpack Compose,
Material 3 and Gradle. It replaced the former Expo/React Native app in
`apps/mobile`. This is an **Android-only** app; there is no iOS or web target.

## Prerequisites

- JDK 21 (the Gradle toolchain compiles with Java 21)
- Android SDK with platform 36 and build-tools 36
- A Pluto-owned Firebase project with an Android app registered as `com.pluto.app`

Install the root npm dependencies only for the server and web workspaces; the
Android app has no npm scripts and is not an npm workspace:

```powershell
npm install   # from the repository root
```

## Firebase configuration

`app/google-services.json` is deliberately **not** committed. Copy the template
and replace every placeholder with the values from your own Firebase project:

```powershell
Copy-Item app\google-services.example.json app\google-services.json
```

The committed template contains obvious placeholders and matches the package
name `com.pluto.app`, so Gradle can parse it during a first build, but Firebase
Auth, Firestore and Google Sign-In will not work until you replace it.

Setup checklist:

1. Create (or use) a Firebase project and add an Android app with package
   `com.pluto.app`.
2. Enable Cloud Firestore using the **(default)** database. The app reads the
   database id from `app/src/main/res/values/firebase_applet_config.xml`, which
   is set to `(default)`; `firebase.json` uses the same value for the emulator.
3. Download `google-services.json` into `app/`. The Google Services Gradle
   plugin generates `default_web_client_id` from the type-3 OAuth client in that
   file; `GoogleAuthManager` uses it for Google Sign-In.
4. In Google Cloud Console, register the Android OAuth client for
   `com.pluto.app` and the SHA-1 of every signing certificate that ships a build
   (local debug, CI debug, release). `scripts/apk-fingerprint.mjs` prints the
   pair from a built APK:
   ```powershell
   node scripts/apk-fingerprint.mjs apps/mobile/app/build/outputs/apk/debug/app-debug.apk
   ```
5. Deploy `firestore.rules` to the project. The rules scope every
   `users/{uid}/...` collection to the signed-in Firebase Auth user and require
   decimal-string amounts plus `createdAt`/`updatedAt`. Documents written by the
   previous app version use numbers and are **not** accepted; migrate or archive
   them before rolling this version out to existing signed-in users.

`.env` is local-only. `DEV_MODE` enables developer controls in Settings and
`SEED_SAMPLE_DATA` populates a fresh install with sample expenses.

## Build and test

From `apps/mobile`:

```powershell
.\gradlew.bat :app:testDebugUnitTest     # hermetic JVM/Robolectric tests
.\gradlew.bat :app:assembleDebug         # app/build/outputs/apk/debug/app-debug.apk
.\gradlew.bat :app:assembleRelease       # requires signing values (below)
```

Two tests (`FirestoreSyncRepositoryRuleTest` and `OfflineModeAndCloudMergeTest`)
talk to the Firebase Auth and Firestore emulators and are excluded from
`testDebugUnitTest`. Run them explicitly:

```powershell
npx --yes firebase-tools@latest emulators:exec `
  --only firestore,auth --project demo-no-project --config firebase.json `
  '.\gradlew.bat :app:testEmulator --no-daemon'
```

The Firestore rules themselves have a Node test suite (`firestore.test.js`) that
uses the same emulators:

```powershell
npx --yes firebase-tools@latest emulators:exec `
  --only firestore,auth --project demo-no-project --config firebase.json `
  'node --test --test-reporter=spec firestore.test.js'
# needs @firebase/rules-unit-testing available to node
```

`.github/workflows/android.yml` runs the unit tests, emulator tests and a debug
build on every push that touches this directory, and reports the APK's signing
fingerprint in the job summary.

## Release signing

Release builds are signed from the environment, never from a committed
keystore. Set either environment variables or Gradle properties:

| Environment variable | Gradle property |
| :--- | :--- |
| `PLUTO_RELEASE_STORE_FILE` | `pluto.release.storeFile` |
| `PLUTO_RELEASE_STORE_PASSWORD` | `pluto.release.storePassword` |
| `PLUTO_RELEASE_KEY_ALIAS` | `pluto.release.keyAlias` |
| `PLUTO_RELEASE_KEY_PASSWORD` | `pluto.release.keyPassword` |

`assembleRelease` fails with an explicit message when these are missing. Debug
builds use Android's own default debug key; the old project's custom
`debugConfig` pointed at a `debug.keystore` that was never checked in.

`versionCode` and `versionName` live in `app/build.gradle.kts`; raise both for
each store release.

CI secrets used by `android.yml`:

- `GOOGLE_SERVICES_JSON` — the Firebase config described above
- `PLUTO_RELEASE_KEYSTORE_B64`, `PLUTO_RELEASE_STORE_PASSWORD`,
  `PLUTO_RELEASE_KEY_ALIAS`, `PLUTO_RELEASE_KEY_PASSWORD` — release signing
- `GOOGLE_SERVICE_ACCOUNT_KEY` — only for the optional Play upload (Release
  manager service-account key)

## Architecture

- `ui/` — Compose screens (home, expenses, wallets, converter, budgets,
  insights, settings, onboarding, auth) and the shared theme tokens. Expenses
  support category/date filters and custom date ranges; the home dashboard is
  split into independently customizable cards.
- `domain/` — models (`BigDecimal`-backed `Money`), repository interfaces and
  use cases. Expenses carry `createdAt`/`updatedAt` audit timestamps and an
  immutable FX snapshot recorded when the transaction was saved.
- `data/local/` — Room database `global_expense.db` (schema v9, migrations 1→9)
  with a market-rate cache, plus SharedPreferences settings/session state. The
  app is usable offline.
- `data/remote/exchange/` — Retrofit client for `https://open.er-api.com/`,
  with an LRU → Room → network cache in `OfflineFirstExchangeRateRepository`.
  Historical dates use strict date-matched API cache entries and never fall
  back to today's rate.
- `data/remote/cloud/` — optional Google Sign-In and Firestore sync decorators;
  signed-out users stay in "Local Vault" mode and merge when they sign in.
  Firestore documents store money as exact decimal strings with server
  timestamps; `firestore.rules` rejects the older numeric schema.
- `data/worker/` — WorkManager prefetch of exchange rates and processing of
  recurring expenses.
- Manual dependency wiring lives in `MainActivity.kt`; there is no DI framework.

## Deferred integration with `apps/server`

This app currently uses **Firebase Auth + Firestore** for sign-in and data. It
does not call the Pluto NestJS API. That is deliberate for this swap: a Pluto
JWT cannot authorize Firestore rules, so changing auth alone would break sync.

The next step is a data-layer port with these constraints:

- Sign-in must either keep Firebase Auth in parallel or exchange the Google ID
  token with both Firebase and `POST /v1/auth/google`.
- The server stores expenses, categories, budgets and recurring rules, but has
  no wallets, wallet ledger, dual-currency expense fields, persona/term
  settings, or Firestore-style realtime listeners.
- `/v1/sync` and `/v1/backups` are PAID-gated. FREE users' offline writes need
  to replay through the ordinary REST endpoints; PAID users can use
  `/sync/push` (batches ≤ 500, client-generated UUIDs, `clientUpdatedAt` wins)
  and paged `/sync/pull` (expenses only, with a separate cursor).
- Restore, realtime merge and the unsupported native features need explicit
  decisions before the Firebase code is removed.
