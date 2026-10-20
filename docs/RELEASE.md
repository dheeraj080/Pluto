# Releasing Pluto

What has to exist before a build reaches Google Play, in the order it has to
happen. `apps/mobile/README.md` explains *how the app is built*; this file is
the release checklist.

Status legend: **[done]** committed and verified, **[your console]** needs a
Google/Expo account and a browser, **[blocked]** cannot be finished until the
item above it is.

## 1. The EAS project — [done]

`app.config.ts` carries `owner: 'dheeeraj_k'` and
`extra.eas.projectId = e16a7e39-5cd9-4368-9a1e-3fa231a1a523`
(https://expo.dev/accounts/dheeeraj_k/projects/pluto). Both are required: the
project ID is what `eas build` resolves, and `owner` is what lets a
non-interactive build (CI) pick the account without a logged-in CLI. A unit test
in `app.config.test.ts` pins them so a refactor cannot quietly unlink the app
from its release pipeline.

## 2. A production API — [blocked: not deployed]

The production profile inlines `EXPO_PUBLIC_API_URL` at bundle time, and
`app.config.ts` **refuses to build** a production artifact when it is missing,
not https, or pointing at `localhost` / `127.0.0.1` / `10.0.2.2`. The value that
exists today (`https://api.pluto.example/v1`) is a placeholder.

Provision it first, following `docs/ENVIRONMENTS.md`: Neon `main` branch →
`pluto-server` on Render → `prisma migrate deploy`. Then set, from
`apps/mobile`:

```sh
eas env:create --environment production --name EXPO_PUBLIC_API_URL \
  --value https://api.pluto.example/v1 --visibility plaintext

eas env:create --environment production --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID \
  --value <the production Web client ID> --visibility plaintext
```

`eas.json` scopes each profile to its matching EAS environment
(`development` / `preview` / `production`), which is what makes these variables
apply to the right builds. `EXPO_PUBLIC_*` values are **inlined into the bundle**
— they are public by construction, so plaintext visibility is correct and a
secret must never be put here.

> Use `preview` (an installable APK, against the staging API) to prove all of
> this before a production build. `docs/ENVIRONMENTS.md` documents the staging
> choices.

## 2b. The server on Render — [done in repo / your console]

`apps/server/render.yaml` defines both services. Sync the Blueprint, then fill in
the `sync: false` values (they differ per environment; see
`docs/ENVIRONMENTS.md`):

| Variable | Production value |
| :--- | :--- |
| `DATABASE_URL` | the Neon `main` branch's **pooled** connection string, with its SSL parameters (`sslmode=require`); drop `channel_binding=require` if the provider added it — Prisma cannot use it |
| `JWT_ACCESS_SECRET` | 32+ random characters (**not** the development default; boot is refused otherwise) |
| `CORS_ORIGIN` | the web app's origin, e.g. `https://pluto.example` (a wildcard is refused in production) |
| `GOOGLE_ALLOWED_CLIENT_IDS` | the same **Web** client ID as mobile's `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| `ADMIN_EMAILS` | your own address, so `/v1/admin/*` is reachable |
| `RATES_SYNC_TOKEN` | `openssl rand -hex 32` (see below) |

### The rate sync on a free (idle-spinning) plan — [your console]

The daily rate sync and the hourly backup cleanup are **in-process crons**, and a
Render free instance spins down when idle, so on a quiet day they never run. That
matters: every converted report figure depends on a current rate snapshot, and
staleness degrades quietly (`converted: false`, null base-currency totals) rather
than failing loudly.

The repo answers this with an external trigger:

- `POST /v1/rates/sync` runs the **same** database-locked sync as the cron, so
  the two can never run concurrently — whichever arrives second is a no-op.
- It is guarded by `RATES_SYNC_TOKEN` (constant-time comparison) and **404s when
  that is unset**, so an unconfigured deployment exposes nothing.
- `.github/workflows/rates-sync.yml` calls it daily (and on demand), retrying
  through the cold-start 502s a spun-down instance returns.

Set these repository values so the workflow can run:

| Kind | Name | Value |
| :--- | :--- | :--- |
| variable | `RATES_SYNC_URL` | the deployed API base including `/v1`, e.g. `https://pluto-server.onrender.com/v1` |
| secret | `RATES_SYNC_TOKEN` | the same value as the server's `RATES_SYNC_TOKEN` |

> GitHub disables scheduled workflows after 60 days of repository inactivity, and
> `schedule` runs can be delayed — which is why this is a *supplement* to the
> cron, not a replacement.

### Cloud backups are deferred — [decided]

`OBJECT_STORAGE_ENABLED=false` for this release, so every `/v1/backups/*` route
returns `503` by design and nothing is stored server-side. The app and the
policy were corrected to match rather than promising a feature that is absent:

- the mobile delete-account screen treats a `503` as "backup is not enabled" and
  drops the backup promises from its consequence list;
- the web policy describes backup as an optional feature this deployment does not
  enable, and points data export at the CSV export that does work.

To enable it later, see `apps/server/README.md` (S3/MinIO) and override the
storage variables per environment. Do **not** advertise cloud backup in the Play
listing until then.

## 3. Google OAuth — [your console]

Three separate credentials, and they are the usual cause of a release that looks
broken but is misconfigured:

| Client type | Used for | Registered with |
| :--- | :--- | :--- |
| **Web** | the ID-token audience the native SDK requests | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, and the server's `GOOGLE_ALLOWED_CLIENT_IDS` |
| **Android** | the installed app itself | package `com.pluto.app` + the SHA-1 of the certificate that signed the APK/AAB |
| **iOS** | not configured (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is unset) | treat this as an Android-only release |

The Android SHA-1 is the one that does not exist yet. Two cases:

- **Play App Signing (the default).** Google re-signs uploads with an app-signing
  certificate that only exists after the first upload, and *that* is the
  fingerprint the installed app has. Read it from Play Console (Release →
  Setup → App signing) and register it on the Android client.
- **No Play App Signing.** EAS generates the first upload key during the first
  `production` build; read its fingerprint off the artifact with the
  no-SDK-needed reader:

  ```sh
  npm run apk:fingerprint --workspace pluto-mobile -- <path-to.apk-or.aab>
  ```

Both values must be on the same Android client, or the native SDK fails with
`DEVELOPER_ERROR` (status 10) — which the app rewrites on the sign-in screen
into the two values to compare. `apps/mobile/README.md` ("The signing key, and
why the SHA-1 matters") has the full explanation.

## 4. Crash reporting — [your console, optional]

`EXPO_PUBLIC_SENTRY_DSN` turns Sentry on; without it every reporting call is a
deliberate no-op and the release ships blind to its own crashes. To enable it:

```sh
eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN \
  --value https://<key>@<org>.ingest.sentry.io/<project> --visibility plaintext
```

Sourcemap upload also needs `SENTRY_ORG`, `SENTRY_PROJECT` and
`SENTRY_AUTH_TOKEN` in the build environment; the config plugin registers only
when a DSN is present.

## 5. Store listing — [your console]

Everything here is Google's requirement rather than the repo's, and none of it
can be generated for you:

| Item | Where it comes from |
| :--- | :--- |
| Privacy policy URL | `/privacy` already exists and covers Google Sign-In, encrypted backups, session metadata (IP/user-agent), retention, GDPR rights and account deletion — **have counsel review it before launch** (it carries that comment at the top of the file), then point Play at `https://<your-domain>/privacy` |
| Data safety form | the same page is the source: email, name, avatar, user id, backup files, IP/user-agent; no advertising IDs, no data sold |
| Account deletion | in-app flow exists (`delete-account`) and matches the web's `/delete-account`; paste the web URL into Play as the deletion option for users without the app |
| Content rating, target audience | Play Console questionnaire |
| Screenshots, feature graphic, short/full description | Play Console; nothing is committed |

## 6. Build and submit

From `apps/mobile` with an Expo login (or in CI — see below):

```sh
npm run eas:build:preview   # APK against staging: install it, run the Maestro flows
npm run eas:build:prod      # AAB for Play
npm run eas:submit:prod     # upload
```

`appVersionSource` is `remote`, so the production profile auto-increments the
Android version code. The user-facing `version` in `app.config.ts` is still
edited by hand — raise it for each store release.

The `production` submit profile targets the Play **production** track and uploads
as a **draft** (`eas.json`), so a submission never goes live to all users the
moment it lands — promote it in Play Console when you are ready. The default
EAS track is `internal`, which would quietly put a store release on a closed
track instead.

**Before the first production build, run the device flows against the preview
APK.** Nothing in CI renders a screen, so this is the only check that catches a
screen that paints nothing:

```sh
npm run e2e --workspace pluto-mobile    # see .maestro/README.md for prerequisites
```

## 7. CI release workflow — [done]

`.github/workflows/eas-release.yml` runs the same build from GitHub's runner
(`workflow_dispatch` → profile, optional submit). It needs two repository
secrets; both are read from the environment by `eas-cli`, never logged:

- `EXPO_TOKEN` — expo.dev → Account settings → Access tokens. Without it the
  workflow fails fast with that instruction.
- `GOOGLE_SERVICE_ACCOUNT_KEY` — only for the submit step: the raw JSON key of a
  Play Console service account with *Release manager* access and the Android
  Publisher API enabled.

The workflow gates on `typecheck` and `test` **before** starting a cloud build,
since an EAS build is the slowest check in the repo, and it uses `--wait` so a
native compile failure fails the run instead of silently producing no artifact.

## Still open after this checklist

- Nothing in CI installs the built artifact on a device — the Maestro flows stay
  a deliberate, manual step.
- iOS is unconfigured (needs an Apple Developer account, a bundle/cert/provision
  profile through EAS, and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`).
- `docs/ENVIRONMENTS.md`'s own provisioning checklist is still unticked; the
  production API in step 2 is the same work.
