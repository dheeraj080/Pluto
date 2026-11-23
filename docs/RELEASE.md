# Releasing Pluto

What has to exist before a build reaches Google Play, in the order it has to
happen. `apps/mobile/README.md` explains how the Android app is built; this file
is the release checklist.

Status legend: **[done]** committed and verified, **[your console]** needs a
Google/Firebase account and a browser, **[blocked]** cannot be finished until the
item above it is.

## 1. Firebase project — [your console]

The native app is tied to its own Firebase project. Before a release build:

1. Create a Firebase Android app with package **`com.pluto.app`**.
2. Enable Cloud Firestore's **`(default)`** database and deploy `apps/mobile/firestore.rules`.
3. Download that project's `google-services.json` and either place it at
   `apps/mobile/app/google-services.json` locally or store it as the
   `GOOGLE_SERVICES_JSON` repository secret for CI. The file is git-ignored;
   only `app/google-services.example.json` is committed.
4. Add the Web OAuth client to the same Google Cloud project so the Google
   Services plugin can generate `default_web_client_id` for Google Sign-In.

The old AI Studio Firebase config is not committed. Do not reuse it: it is bound
to `com.example.nhpnee` and a different Firestore database.

## 2. Production API — [blocked: not deployed]

The native app does not call the API yet (see the deferred-integration section in
`apps/mobile/README.md`), but the web app and the future data port do. The
placeholder `https://api.pluto.example/v1` in `docs/ENVIRONMENTS.md` must be
replaced with a deployed API first.

Provision it following `docs/ENVIRONMENTS.md`: Neon `main` branch → `pluto-server`
on Render → `prisma migrate deploy`.

## 2b. The server on Render — [done in repo / your console]

`apps/server/render.yaml` defines both services. Sync the Blueprint, then fill in
the `sync: false` values (they differ per environment; see `docs/ENVIRONMENTS.md`):

| Variable | Production value |
| :--- | :--- |
| `DATABASE_URL` | the Neon `main` branch's **pooled** connection string, with SSL parameters; drop `channel_binding=require` if the provider added it |
| `JWT_ACCESS_SECRET` | 32+ random characters (**not** the development default; boot is refused otherwise) |
| `CORS_ORIGIN` | the web app's origin, e.g. `https://pluto.example` (a wildcard is refused in production) |
| `GOOGLE_ALLOWED_CLIENT_IDS` | the production Web client ID |
| `ADMIN_EMAILS` | your own address, so `/v1/admin/*` is reachable |
| `RATES_SYNC_TOKEN` | `openssl rand -hex 32` |

### The rate sync on a free (idle-spinning) plan — [your console]

`POST /v1/rates/sync` runs the same database-locked sync as the in-process cron.
It is guarded by `RATES_SYNC_TOKEN` and 404s when unset.

Set these repository values:

| Kind | Name | Value |
| :--- | :--- | :--- |
| variable | `RATES_SYNC_URL` | deployed API base including `/v1`, e.g. `https://pluto-server.onrender.com/v1` |
| secret | `RATES_SYNC_TOKEN` | the same value as the server's `RATES_SYNC_TOKEN` |

### Cloud backups are deferred — [decided]

`OBJECT_STORAGE_ENABLED=false` for this release, so every `/v1/backups/*` route
returns `503`. The native app's local JSON backup/restore is independent of the
server. Do not advertise cloud backup in the Play listing.

## 3. Google OAuth — [your console]

| Client type | Used for | Registered with |
| :--- | :--- | :--- |
| **Web** | ID-token audience the eventual server port will verify | `GOOGLE_ALLOWED_CLIENT_IDS` and the Firebase Android app's OAuth client |
| **Android** | the installed app itself | package `com.pluto.app` + the SHA-1 of the certificate that signed the APK |

The Android SHA-1 must be registered for **each** signing certificate you ship:
local debug, CI debug and release/Play signing. With Play App Signing, use the
app-signing fingerprint from Play Console (Release → Setup → App signing) for
the certificate users actually receive. Read any built APK's fingerprint with:

```sh
node scripts/apk-fingerprint.mjs apps/mobile/app/build/outputs/apk/debug/app-debug.apk
```

A missing SHA-1 makes Google sign-in fail with `DEVELOPER_ERROR` (status 10).
iOS is not configured; this is an Android-only release.

## 4. Release signing and CI — [your console]

`apps/mobile/app/build.gradle.kts` reads the release keystore from environment
variables or Gradle properties; nothing sensitive is committed. CI
(`.github/workflows/android.yml`) needs:

| Secret | Purpose |
| :--- | :--- |
| `GOOGLE_SERVICES_JSON` | Firebase config injected before every Gradle build |
| `PLUTO_RELEASE_KEYSTORE_B64` | base64 of the release/upload keystore |
| `PLUTO_RELEASE_STORE_PASSWORD` | keystore password |
| `PLUTO_RELEASE_KEY_ALIAS` | key alias |
| `PLUTO_RELEASE_KEY_PASSWORD` | key password |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Play Console service account (Release manager) for the optional upload |

Generate a keystore locally with `keytool`, base64 it, and store the five
signing values as secrets. `assembleRelease` fails fast when any are missing.
Debug builds use Android's default debug key and need no secrets beyond the
Firebase config.

Raise `versionCode` and `versionName` in `apps/mobile/app/build.gradle.kts` for
each store release.

## 5. Store listing — [your console]

| Item | Where it comes from |
| :--- | :--- |
| Privacy policy URL | `/privacy` on the website; have counsel review it before launch |
| Data safety form | Firebase Auth profile, Firestore expenses/wallets/settings, exchange-rate requests. The native app has no Sentry/crash reporting. |
| Account deletion | **Not implemented in the native app.** Google Play requires an in-app deletion path when accounts can be created. Add one (Firestore user + subcollections + Firebase Auth user) before release, or use the web deletion page only if it is updated to delete the same account. |
| Content rating, target audience | Play Console questionnaire |
| Screenshots, feature graphic, description | Play Console; nothing is committed |

## 6. Build and submit

From `apps/mobile`, with the Firebase config and signing values in place:

```powershell
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:assembleRelease
```

Or dispatch `.github/workflows/android.yml` with `submit: true` to build in CI
and upload the APK as a **draft** production release. Promote it in Play Console
when ready.

Before the first production build, install the debug APK and walk the app on a
device. CI's JVM and emulator tests cannot catch a screen that paints nothing.
