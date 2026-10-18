# syntax=docker/dockerfile:1

# This is an npm-workspaces monorepo, so the image must be built from the REPO
# ROOT (not from apps/server) so the root lockfile and the whole workspace graph
# are available:
#
#   docker build -f apps/server/Dockerfile -t pluto-server .

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

# Install only the server workspace (plus the root) rather than the whole
# monorepo: the web (Next.js) and mobile (Expo) dependency trees are irrelevant
# to this image.
RUN npm ci --workspace pluto-server --include-workspace-root

# Source needed to generate the Prisma client and compile the API.
COPY apps/server ./apps/server
COPY packages/api-client ./packages/api-client

RUN npm run prisma:generate --workspace pluto-server
RUN npm run build --workspace pluto-server

# ---------------------------------------------------------------------------
# Runtime stage
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Production dependencies only. `--ignore-scripts` skips Prisma's postinstall
# `generate` step (the CLI is a devDependency and is not installed here); the
# generated client is copied from the builder below instead.
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json

RUN npm ci --omit=dev --workspace pluto-server --include-workspace-root --ignore-scripts \
  && npm cache clean --force

# The Prisma client is generated into node_modules/.prisma at build time; a
# production-only install never runs `prisma generate`, so carry it across.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Compiled output and the schema/migrations (used by an out-of-band
# `prisma migrate deploy`; the container itself only runs the API).
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma

# Non-root user for security
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/v1/health/ready').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "apps/server/dist/main.js"]
