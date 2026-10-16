# Production Deployment Notes (Server)

This document outlines the minimal production setup and common pitfalls. It's intentionally concise; expand as needed.

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
- **Rate Limiting**: Global via `@nestjs/throttler` (`THROTTLE_TTL`/`THROTTLE_LIMIT`). Auth endpoints use stricter limits (`AUTH_THROTTLE_LIMIT`). `GET /expenses/export.csv` is throttled to 10/min. Consider adding more for heavy endpoints as needed.
- **Headers**: The app sets basic security headers (X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy). Add CSP/Permissions-Policy at the edge (reverse proxy/CDN) for stronger control.
- **Secrets**: Store in your cloud secret manager (AWS Secrets Manager, GCP Secret Manager, etc.). Do not commit `.env` files.
- **Logs**: Production logs go to stdout/stderr (captured by your platform). Consider structured JSON + request IDs + error tracking (Sentry/Bugsnag).

## Health & Readiness

- `/health` is exposed (HealthModule). Use for liveness/readiness probes in your orchestrator (Kubernetes, etc.).
- Graceful shutdown is enabled (`enableShutdownHooks()`); ensure your platform allows for SIGTERM handling.

## CI/CD Recommendations

1. Run `prisma:generate`, `typecheck`, `lint`, `test`, `api:generate`, and `git diff --exit-code` (already in CI).
2. Add `build` verification (`npm run build` for server/web) to catch compile-time issues.
3. Run `prisma:migrate:deploy` in the release job before starting containers.
4. Tag releases and consider rolling deployments.

## Rollback Notes

- Database: Migrations are forward-only by default. Plan backward migrations if your schema changes are breaking. Keep rollback scripts documented per release.
- Application: Blue/green or rolling with health checks is recommended. The app boots quickly and has shutdown hooks.