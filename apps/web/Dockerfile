# syntax=docker/dockerfile:1

# npm-workspaces monorepo, so build from the REPO ROOT:
#
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/v1 \
#     --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://app.example.com \
#     -t pluto-web .
#
# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so they
# must be supplied here (or baked into the environment) rather than at runtime.

# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json

# Install only the web workspace (plus the root); the server/mobile trees are
# irrelevant here. api-client is a local workspace dependency of the web app.
RUN npm ci --workspace pluto-web --include-workspace-root

COPY packages/api-client ./packages/api-client
COPY apps/web ./apps/web

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN npm run build --workspace pluto-web

# ---------------------------------------------------------------------------
# Runtime stage (Next.js `output: "standalone"`)
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# The standalone bundle ships its own trimmed node_modules and server entry.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER node

EXPOSE 3001

CMD ["node", "apps/web/server.js"]
