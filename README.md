# Pluto

Monorepo for the Pluto Android application ecosystem: the NestJS backend API and
the Next.js website/admin dashboard.

```
pluto/
├── apps/
│   ├── server/     # pluto-server — NestJS API (port 3000), Prisma/Postgres, Swagger /docs
│   └── web/        # pluto-web — Next.js 16 site + admin UI (port 3001)
└── packages/       # reserved for shared code (e.g. api-types)
```

## Quick start

```powershell
npm install          # single root install (workspaces)
npm run dev          # turbo: API on :3000 + web on :3001, in parallel
npm run build        # build both apps (dependency-ordered, cached)
npm run lint         # lint both apps
npm run test         # test both apps (server: jest unit + e2e)
```

Individual apps: `npm run dev -w apps/server`, `npm run build -w apps/web`, etc.

## Configuration

Each app keeps its own env file (never committed):

- `apps/server/.env` — see `apps/server/.env.example` (DB, JWT, `GOOGLE_ALLOWED_CLIENT_IDS`, `ADMIN_EMAILS`, CORS)
- `apps/web/.env.local` — see `apps/web/.env.example` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_SITE_URL`)

The web dev server runs on **:3001** to avoid clashing with the API on :3000.

## Environments

Development, staging and production each get their **own database and secrets** —
never share a `DATABASE_URL` or `JWT_ACCESS_SECRET` between tiers. See
[`docs/ENVIRONMENTS.md`](docs/ENVIRONMENTS.md) for the full model (Neon branches,
the Render staging service, per-environment `NEXT_PUBLIC_*`, and the EAS
profiles).

## Per-app docs

- API reference, runbooks, deployment: [`apps/server/README.md`](apps/server/README.md)
- Routes, launch checklist, architecture notes: [`apps/web/README.md`](apps/web/README.md)

## Tooling

- **npm workspaces** — one root `node_modules` + lockfile
- **Turborepo** — task graph, caching, parallel `dev`

History: `apps/server` and `apps/web` were merged from their standalone
repositories via `git subtree` (pre-migration history preserved).
