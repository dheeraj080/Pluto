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
| `DATABASE_URL` | Use TLS (`sslmode=require`) if the DB requires it. |
| `JWT_ACCESS_SECRET` | At least 32 chars, must be explicitly set (defaults rejected). |
| `JWT_REFRESH_SECRET` | If your implementation introduces a separate refresh secret, enforce similar length/strength. |
| `GOOGLE_ALLOWED_CLIENT_IDS` | Comma-separated, non-empty. No wildcard. |
| `CORS_ORIGIN` | Comma-separated list of explicit origins (e.g. `https://app.example.com,https://example.com`). **Never** `*` in production. |
| `OBJECT_STORAGE_*` | If `OBJECT_STORAGE_ENABLED=true`, non-default credentials must be provided. |
| `ENABLE_DEV_AUTH` | Must be `false`. |

## Security

- **CORS**: Tightened to explicit origins. If behind a CDN/proxy, ensure the `Origin` header is passed through correctly.
- **Rate Limiting**: Global via `@nestjs/throttler` (`THROTTLE_TTL`/`THROTTLE_LIMIT`). Auth endpoints declare their own stricter per-route limits (10/min for `POST /auth/google`, 30/min for the dev-only login, 20/min for `POST /auth/refresh`). `GET /expenses/export.csv` is throttled to 10/min. Consider adding more for heavy endpoints as needed.
- **Headers**: The app sets basic security headers (X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy). Add CSP/Permissions-Policy at the edge (reverse proxy/CDN) for stronger control.
- **Secrets**: Store in your cloud secret manager (AWS Secrets Manager, GCP Secret Manager, etc.). Do not commit `.env` files.
- **Logs**: Production logs go to stdout/stderr (captured by your platform). Every response carries an `X-Request-Id` (honouring an upstream value when present). Consider structured JSON + error tracking (Sentry/Bugsnag).

## Health & Readiness

- `/v1/health` is exposed (HealthModule). It returns `200` when the database probe succeeds and `503` when it fails, so orchestrators and platform health checks stop routing to an instance that cannot reach Postgres. Use it for liveness/readiness probes.
- Graceful shutdown is enabled (`enableShutdownHooks()`); ensure your platform allows for SIGTERM handling.

## CI/CD Recommendations

1. Run `prisma:generate`, `typecheck`, `lint`, `test`, `api:generate`, and `git diff --exit-code` (already in CI).
2. Add `build` verification (`npm run build` for server/web) to catch compile-time issues.
3. Run `prisma:migrate:deploy` in the release job before starting containers.
4. Tag releases and consider rolling deployments.

## Rollback Notes

- Database: Migrations are forward-only by default. Plan backward migrations if your schema changes are breaking. Keep rollback scripts documented per release.
- Application: Blue/green or rolling with health checks is recommended. The app boots quickly and has shutdown hooks.