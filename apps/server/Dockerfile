# syntax=docker/dockerfile:1

# This is an npm-workspaces monorepo, so the image must be built from the REPO
# ROOT (not from apps/server) so the root lockfile and the whole workspace graph
# are available:
#
#   docker build -f apps/server/Dockerfile -t pluto-server .
#
# The runtime image carries the Prisma CLI as well as the generated client, so
# `prisma migrate deploy` can run from the same image on any host. See
# `apps/server/deploy/vm` for the Docker Compose + Caddy deployment used on a
# plain Linux VM.

# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

# Copy the workspace manifests and the single lockfile first so dependency
# installation is cached independently of the source tree. Every workspace
# package.json is required for npm to validate the lockfile against the graph.
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
COPY packages/domain/package.json ./packages/domain/package.json

# Install only the server workspace (plus the root) rather than the whole
# monorepo: the web (Next.js) and mobile (Expo) dependency trees are irrelevant
# to this image.
RUN npm ci --workspace pluto-server --include-workspace-root

# Source needed to generate the Prisma client and compile the API.
COPY apps/server ./apps/server
COPY packages/api-client ./packages/api-client
# The server's currency registry re-exports `packages/domain/src/currencies.ts`
# by relative path (see `apps/server/src/common/currency/currency.registry.ts`),
# so tsc needs its source at build time.
COPY packages/domain ./packages/domain

RUN npm run prisma:generate --workspace pluto-server
RUN npm run build --workspace pluto-server

# ---------------------------------------------------------------------------
# Runtime stage
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Keep deploy logs quiet and avoid outbound telemetry/update checks hanging
# behind a restrictive firewall.
ENV CHECKPOINT_DISABLE=1
ENV PRISMA_HIDE_UPDATE_MESSAGE=1

# Production dependencies only. `--ignore-scripts` skips Prisma's postinstall
# `generate`/engine-download steps; the generated client and the native engines
# are copied from the builder below. The `prisma` CLI is a production dependency
# (see package.json), so its JavaScript dependency tree is installed here.
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
COPY packages/domain/package.json ./packages/domain/package.json

RUN npm ci --omit=dev --workspace pluto-server --include-workspace-root --ignore-scripts \
  && npm cache clean --force

# The Prisma client is generated into node_modules/.prisma at build time, and
# the native engine binaries are downloaded by the `prisma` postinstall. Both
# are skipped by `--ignore-scripts`, so carry them across from the builder.
# The `prisma` CLI itself is a production dependency (see package.json), so its
# JavaScript dependency tree (c12, effect, ...) is already installed here; only
# the platform-specific engines need the copy. That is what lets
# `prisma migrate deploy` run from this image (and from the one-off Compose
# service) without installing devDependencies on the host.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines

# Compiled output and the schema/migrations (used by `prisma migrate deploy`).
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma

# Non-root user for security
USER node

EXPOSE 3000

# Liveness only. Pointing the Docker healthcheck at /ready would run SELECT 1
# every 30s and keep a scale-to-zero database (Neon) awake 24/7, burning the
# free compute allowance. Deploys and uptime checks gate on /v1/health/ready.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/v1/health/live').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "apps/server/dist/apps/server/src/main.js"]
