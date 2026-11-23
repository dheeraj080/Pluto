# Pluto

Monorepo for the Pluto application ecosystem: a native Android client, a
NestJS backend API and a Next.js website/admin dashboard.

```
pluto/
├── apps/
│   ├── mobile/     # native Kotlin/Jetpack Compose Android app (Gradle)
│   ├── server/     # pluto-server — NestJS API (port 3000), Prisma/Postgres, Swagger /docs
│   └── web/        # pluto-web — Next.js 16 site + admin UI (port 3001)
└── packages/       # shared code (api-types, domain)
```

`apps/mobile` is a standalone Gradle project, not an npm workspace. The API
and web app are npm workspaces and are orchestrated by Turborepo.

## Quick start

```powershell
npm install          # single root install for server + web
npm run dev          # turbo: API on :3000 + web on :3001, in parallel
npm run build        # build both workspaces (dependency-ordered, cached)
npm run lint         # lint both workspaces
npm run test         # test both workspaces (server: jest unit + e2e)
```

Individual workspaces: `npm run dev -w apps/server`, `npm run build -w apps/web`, etc.
The Android app uses its own wrapper:

```powershell
cd apps/mobile
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:assembleDebug
```

## Configuration

Each app keeps its own env file (never committed):

- `apps/server/.env` — see `apps/server/.env.example` (DB, JWT, `GOOGLE_ALLOWED_CLIENT_IDS`, `ADMIN_EMAILS`, CORS)
- `apps/web/.env.local` — see `apps/web/.env.example` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_SITE_URL`)
- `apps/mobile/.env` — see `apps/mobile/.env.example` (`DEV_MODE`, `SEED_SAMPLE_DATA`)
- `apps/mobile/app/google-services.json` — copy from `google-services.example.json` and replace with your Pluto Firebase project's config; it is git-ignored

The web dev server runs on **:3001** to avoid clashing with the API on :3000.

## Environments

Development, staging and production each get their **own database and secrets** —
never share a `DATABASE_URL` or `JWT_ACCESS_SECRET` between tiers. See
[`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md) for the full model (Neon branches,
the Render staging service, per-environment `NEXT_PUBLIC_*`, and the mobile
build configuration).

## Per-app docs

- Android app, Firebase setup, builds and tests: [`apps/mobile/README.md`](apps/mobile/README.md)
- API reference, runbooks, deployment: [`apps/server/README.md`](apps/server/README.md)
- Routes, launch checklist, architecture notes: [`apps/web/README.md`](apps/web/README.md)
- Release checklist: [`docs/RELEASE.md`](docs/RELEASE.md)

## Tooling

- **npm workspaces** — one root `node_modules` + lockfile for server and web
- **Turborepo** — task graph, caching, parallel `dev`
- **Gradle** — the Android app is built and tested with the wrapper in `apps/mobile`

History: `apps/server` and `apps/web` were merged from their standalone
repositories via `git subtree` (pre-migration history preserved).
