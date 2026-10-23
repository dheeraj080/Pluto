# Environments

How Pluto separates **development**, **staging** and **production** across the
three apps. The goal is simple: development and staging must never be able to
read or write production data, tokens or credentials.

> TL;DR — the non-negotiable part is separate **databases** and **secrets** per
> environment. Staging is a *production-shaped* service (same build, same
> `NODE_ENV=production` guards) that talks to different data.

## The tiers

| Tier | Who uses it | Server | Database |
| :--- | :--- | :--- | :--- |
| **local dev** | you, on your machine | `npm run start:dev` on `:3000` | local Docker Postgres, or a Neon `dev` branch |
| **staging** | you / testers, before a release | `pluto-server-staging` on Render | a Neon `staging` branch |
| **production** | real users | `pluto-server` on Render | the Neon `main` branch |

Mobile already models three tiers in `apps/mobile/eas.json`: `development`,
`preview` (this is *staging*) and `production`. The web app and the API are the
pieces that need the split.

## What must differ per environment

| Concern | Rule |
| :--- | :--- |
| `DATABASE_URL` | A different Neon branch per tier. Never shared. |
| `JWT_ACCESS_SECRET` | A different value per tier (a leaked staging secret must not mint production tokens). |
| `CORS_ORIGIN` | The origins that actually call *that* server. |
| `GOOGLE_ALLOWED_CLIENT_IDS` | Per-tier OAuth audiences (see [Mobile](#mobile-eas--google-oauth)). |
| `RATES_SYNC_TOKEN` | A different value per tier: the trigger mutates the rate table, so a staging token must not be able to drive production's. |
| Adapters / buckets | Separate S3/MinIO bucket per tier if object storage is enabled. |

Everything else (TTLs, throttle limits, the Frankfurter URL, cron schedule) is
identical and lives in the shared `pluto-server-config` env group in
`apps/server/render.yaml`.

## Database — Neon branches

Neon's free plan includes **10 branches per project**, and branching is
copy-on-write (instant, no data copy), so extra tiers are effectively free.

Because there are no real users yet, the branch that holds migrations today can
simply become `main` (production). Create two more:

1. In the Neon console: **Branches → Create branch**
   - `dev` — branched from `main`
   - `staging` — branched from `main`
2. Copy each branch's **pooled** connection string (host contains `-pooler`).
3. Drop `channel_binding=require` if the provider added it — Prisma's driver does
   not implement it and the connection will fail.

Or with the Neon CLI (`npx neonctl …`; see `neonctl --help` for current flags):

```bash
npx neonctl branches create --name dev
npx neonctl branches create --name staging
npx neonctl connection-string dev
npx neonctl connection-string staging
```

### Pooling and migrations

The app runs fine against the **pooled** endpoint. For `prisma migrate dev`
(which needs a direct connection) prefer the **direct** (non-`-pooler`) host, or
append `?pgbouncer=true`. If you hit prepared-statement errors during a deploy
migration, add a `directUrl` to `apps/server/prisma/schema.prisma` pointing at
the direct host.

## Local development

Local dev runs against the Docker Postgres from `apps/server/docker-compose.yml`
(`postgres:17-alpine`, `localhost:5432`, database `pluto_db`) so it never touches
a hosted branch. `apps/server/.env` points `DATABASE_URL` at it; the production
Neon URL stays commented out in that file for reference.

```bash
docker compose -p pluto-server -f apps/server/docker-compose.yml up -d postgres
npm run prisma:migrate:deploy -w pluto-server
npm run start:dev -w pluto-server
```

The compose file also defines a MinIO service for object storage. If its image
cannot be pulled (`pull access denied for minio/minio` usually means Docker Hub is
rate-limiting anonymous pulls), either `docker login` first or start Postgres on
its own with `up -d postgres` — object storage is optional for local dev.

## Server — Render

`apps/server/render.yaml` defines two services:

- **`pluto-server`** — production
- **`pluto-server-staging`** — staging

Both build and run the same way and share the non-secret
`pluto-server-config` env group. Each declares its own `sync: false` secrets
(`DATABASE_URL`, `JWT_ACCESS_SECRET`, `CORS_ORIGIN`,
`GOOGLE_ALLOWED_CLIENT_IDS`, `ADMIN_EMAILS`, `RATES_SYNC_TOKEN`), which the
dashboard prompts for — secrets are never committed.

Steps:

1. Validate the blueprint before syncing (Render CLI ≥ 2.7):

   ```bash
   render blueprints validate apps/server/render.yaml
   ```

2. Sync the Blueprint in the Render dashboard. Render maps the existing
   `pluto-server` service by name (its current env vars are preserved) and
   creates `pluto-server-staging`.
3. Fill in the `sync: false` values for **both** services — different values per
   environment. For staging's `DATABASE_URL`, paste the Neon `staging` branch.
4. Apply migrations to the staging branch once (`npm run prisma:migrate:deploy`
   with `DATABASE_URL` set to the staging branch).

### Promotion flow

The staging service is wired to the **`staging` branch** (`branch: staging` in
the blueprint) and production to `main`:

```
feature ──PR──▶ main ──merge──▶ staging ──soak──▶ merge ──▶ main (production)
```

- Every PR is checked by CI (`.github/workflows/ci.yml`).
- Merge `main` → `staging` so `pluto-server-staging` (which deploys `staging`)
  picks the build up.
- Once staging looks right, merge `staging` → `main` and production deploys.
- To also make production wait for CI, set `autoDeployTrigger: checksPass` on
  the `pluto-server` service.

> Preview environments (`previews:` in the blueprint) are intentionally **not**
> enabled. Preview copies of a service reuse the `sync: false` values from the
> base service, so a preview would point at the *production* database. Use
> `pluto-server-staging` instead until a Neon branch-per-preview integration is
> in place.

### Alternative: a single VM (Docker Compose + Caddy)

`apps/server/deploy/vm` runs the same server image on any Docker host (a GCE
e2-micro, Hetzner, Oracle, ...) with automatic HTTPS and a migration step. The
per-tier rules above still apply: a VM deployment gets its own `DATABASE_URL`,
`JWT_ACCESS_SECRET`, `CORS_ORIGIN`, and so on.

A 1 GB VM is enough for the API alone with an external Postgres. Do not also
run Next.js or Postgres on it, and do not build the image there — publish it
from CI (`.github/workflows/publish-server-image.yml`) and use
`bash deploy.sh pull`. See
[`apps/server/deploy/vm/README.md`](../apps/server/deploy/vm/README.md).

## Web — Vercel

Vercel is the chosen host (it ships a verified Next.js adapter). The project's
**Root Directory** is `apps/web`; Vercel detects the npm workspace and installs
from the repo root. Per-PR **preview deployments** are the web app's staging —
no permanent extra environment is needed.

`NEXT_PUBLIC_*` values are **inlined at build time**, so each Vercel environment
(Production / Preview / Development) must define its own:

| Variable | Preview / staging | Production |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://pluto-server-staging.onrender.com/v1` | `https://api.pluto.example/v1` |
| `NEXT_PUBLIC_SITE_URL` | `https://staging.pluto.example` | `https://pluto.example` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | a staging Web client ID | the production Web client ID |

> `next.config.ts` sets `output: "standalone"` only when `VERCEL` is unset:
> standalone output breaks Vercel builds on Next 16.3+, and Vercel emits its own
> output. The guard is a no-op for the Docker image and `next start`.

### Skipping unaffected builds

`apps/web/vercel.json` sets the project's **Ignored Build Step** to Turbo's
recommended check:

```
turbo query affected --base=$VERCEL_GIT_PREVIOUS_SHA --packages pluto-web --exit-code
```

Vercel ships `turbo` globally and treats exit `0` as *skip*, `≥1` as *build*, so
an error or an empty `VERCEL_GIT_PREVIOUS_SHA` falls through to a normal build
rather than wrongly skipping one. Requiring `--base=$VERCEL_GIT_PREVIOUS_SHA`
(the previous successful deployment) is also what avoids the shallow-clone
problem `turbo query affected` otherwise has. Vercel's built-in *"skip
unaffected projects"* toggle is the zero-config alternative; this file makes the
choice explicit and uses the non-deprecated command (`turbo-ignore` is
deprecated).

### CORS and preview URLs

Preview URLs are unique per commit, and the API's `CORS_ORIGIN` is an explicit
list (a wildcard is rejected in production), so per-commit origins cannot be
pre-registered. Assign a **stable domain** to the staging branch in Vercel
(e.g. `staging.pluto.example`) and add:

- `https://staging.pluto.example` → the *staging* API's `CORS_ORIGIN`
- `https://pluto.example` → the *production* API's `CORS_ORIGIN`

Both origins must also be registered on their Google Web client's *Authorized
JavaScript origins*.

## Mobile (EAS + Google OAuth)

`eas.json` already provides the tiers; wire values per profile with EAS
environment variables (they are read at build time, never committed):

```bash
eas env:create --environment preview    --name EXPO_PUBLIC_API_URL --value https://pluto-server-staging.onrender.com/v1
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://api.pluto.example/v1
```

Each tier should have its **own Android OAuth client** with its own SHA-1, and
ideally its own application id so dev/staging builds do not collide with the
production client:

- production: `com.pluto.app`
- staging: `com.pluto.app.staging` (e.g. via `android.package` overridden per
  profile / `expo-build-properties`)

For iOS, a distinct `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` per tier is enough — its
reversed form becomes the app's URL scheme (see `apps/mobile/app.config.ts`).

## Secrets

- Never commit a `.env` file. `.env` is git-ignored; `.env.example` is the
  template and contains **no real secrets**.
- Production/staging secrets live in the platform: Render env vars (server),
  the web host's env vars, and EAS env vars (mobile).
- Do not copy production secrets into staging. If they leak from staging the
  blast radius should be limited to staging data.

## What not to do

- Do not run `prisma migrate dev` against production or staging — use
  `prisma:migrate:deploy`.
- Do not let staging and production share a `DATABASE_URL`, a JWT secret, or an
  object-storage bucket.
- Do not point CI at Neon — CI provisions its own throwaway Postgres
  (`pluto_ci`).

## Cost

- Neon dev + staging branches: **$0** (free-tier branching).
- One extra free Render web service (`pluto-server-staging`): **$0** (spins down
  when idle, like the production free service).
- Web preview deployments on Vercel: **$0** on the Hobby plan.
- EAS `preview` builds: within the free build quota.

## Enabling this (checklist)

- [ ] Create Neon `dev` and `staging` branches; note their pooled URLs.
- [x] Point local dev at its own database — the Docker Postgres (see
      [Local development](#local-development)).
- [ ] `render blueprints validate apps/server/render.yaml`.
- [ ] Sync the Blueprint; fill in the `sync: false` secrets for both services.
- [ ] Deploy migrations to the **Neon** `staging` branch (the git `staging`
      branch already exists on `origin`; merge `main` into it to soak a build).
- [ ] Vercel project with Root Directory `apps/web`; set `NEXT_PUBLIC_*` per
      Vercel environment and assign a stable staging domain.
- [ ] Set EAS env vars for the `preview` and `production` profiles.
- [ ] Add each environment's origins to the server's `CORS_ORIGIN`.
