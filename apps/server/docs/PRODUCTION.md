# Production Deployment Notes (Server)

This document outlines the minimal production setup and common pitfalls. It's intentionally concise; expand as needed.

For how development, staging and production are separated (databases, secrets,
the Render staging service, EAS profiles), see
[`docs/ENVIRONMENTS.md`](../../../docs/ENVIRONMENTS.md). Staging runs with
`NODE_ENV=production` — it enforces the same guards below, just against
different data.

## Database Migrations

**Always** run migrations with the deploy command in production:

```bash
npm run prisma:migrate:deploy --workspace pluto-server
```

- Never run `prisma:migrate:dev` in production. It may modify schemas and requires interactive input.
- Run migrations as part of your release pipeline **before** starting new application instances (zero-downtime deploys vary by platform).
- Ensure the database user has sufficient privileges to apply migrations (not just read/write data).

## Environment Variables

Production must override defaults in `.env`. Key requirements enforced by validation:

| Variable | Notes |
|---|---|
| `NODE_ENV=production` | Enables stricter validation. |
| `DATABASE_URL` | Use TLS (`sslmode=require`) if the DB requires it. The value is passed straight to Prisma, so the SSL parameters must be carried in the connection string itself. |
| `JWT_ACCESS_SECRET` | At least 32 chars, must be explicitly set (defaults rejected). |
| `GOOGLE_ALLOWED_CLIENT_IDS` | Comma-separated, non-empty. No wildcard. Must include the *Web* client ID the mobile app requests its ID token with. |
| `CORS_ORIGIN` | Comma-separated list of explicit origins (e.g. `https://app.example.com,https://example.com`). **Never** `*` in production. |
| `OBJECT_STORAGE_*` | If `OBJECT_STORAGE_ENABLED=true`, non-default credentials must be provided. Left `false`, every `/v1/backups/*` route returns `503` by design. |
| `ENABLE_DEV_AUTH` | Must be `false`. |
| `RATES_SYNC_TOKEN` | Optional. Enables the `POST /v1/rates/sync` external trigger; unset, the route `404`s. Needed where the instance is not always awake (see below). |

> Refresh tokens are opaque database-backed rows, not JWTs — there is no
> `JWT_REFRESH_SECRET`. Only `JWT_ACCESS_SECRET` exists.

## Security

- **CORS**: Tightened to explicit origins. If behind a CDN/proxy, ensure the `Origin` header is passed through correctly.
- **Rate Limiting**: Global via `@nestjs/throttler` (`THROTTLE_TTL`/`THROTTLE_LIMIT`). Auth endpoints declare their own stricter per-route limits (10/min for `POST /auth/google`, 30/min for the dev-only login, 20/min for `POST /auth/refresh`). `GET /expenses/export.csv` is throttled to 10/min. Consider adding more for heavy endpoints as needed.
- **Headers**: The app sets basic security headers (X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy). Add CSP/Permissions-Policy at the edge (reverse proxy/CDN) for stronger control.
- **Secrets**: Store in your cloud secret manager (AWS Secrets Manager, GCP Secret Manager, etc.). Do not commit `.env` files.
- **Logs**: Production logs go to stdout/stderr (captured by your platform). Every response carries an `X-Request-Id` (honouring an upstream value when present). Consider structured JSON + error tracking (Sentry/Bugsnag).

## Health & Readiness

- Three probes with distinct jobs: `/v1/health/live` (process only — never restarts an
  instance because Postgres is down), `/v1/health/ready` (probes Postgres, `503` when
  unreachable, for readiness/deploy gates), and `/v1/health` (full diagnostic report).
  `render.yaml` and the Dockerfile `HEALTHCHECK` both use `/ready`.
- Graceful shutdown is enabled (`enableShutdownHooks()`); ensure your platform allows for SIGTERM handling.

## Background work on an always-on vs idle instance

The daily rate sync (`EXCHANGE_RATE_SCHEDULE`) and the hourly backup cleanup run from
**in-process crons**, which only fire while the instance is running. A plan that spins an
idle service down (e.g. Render's free plan) therefore executes no crons, and every
converted report figure depends on a current rate snapshot.

For that case, set `RATES_SYNC_TOKEN` and let an external scheduler call
`POST /v1/rates/sync` (`.github/workflows/rates-sync.yml` does this daily). The route takes
the same database-backed `SystemLock` as the cron, so the two can never run concurrently —
whichever arrives second is a no-op.

## CI/CD Recommendations

CI (`.github/workflows/ci.yml`) already runs: a no-secrets check, `audit:deps` (a critical
advisory in a shipped dependency blocks), `prisma:generate`, `typecheck`, `lint`, `test`,
the server e2e suite, `build` (server + web), `api:generate`, and a `git diff --exit-code`
that fails if linting or generation left the tree changed. A `migrations` job applies the
committed migrations to a throwaway Postgres and fails on schema drift.

Still worth adding per release: run `prisma:migrate:deploy` against the target database
before starting new instances (the Render start command already folds it in), and consider
`autoDeployTrigger: checksPass` so production waits for CI.

## Rollback Notes

- Database: Migrations are forward-only by default. Plan backward migrations if your schema changes are breaking. Keep rollback scripts documented per release.
- Application: Blue/green or rolling with health checks is recommended. The app boots quickly and has shutdown hooks.