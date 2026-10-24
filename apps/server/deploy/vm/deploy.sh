#!/usr/bin/env bash
#
# Deploy the Pluto API on a single Docker host.
#
#   bash deploy.sh          # build the image locally, migrate, restart
#   bash deploy.sh pull     # pull PLUTO_IMAGE from a registry instead of building
#
# Safe to re-run: migrations are idempotent and the API container is recreated
# only when the image or configuration changed.
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

MODE="${1:-build}"

say() { printf '\n==> %s\n' "$*"; }
fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Preconditions
# ---------------------------------------------------------------------------
command -v docker >/dev/null 2>&1 ||
  fail "docker is not installed (https://docs.docker.com/engine/install/)"
docker compose version >/dev/null 2>&1 ||
  fail "the Docker Compose v2 plugin is required (the 'docker compose' command)"

[ -f .env ] || fail "missing .env -- copy .env.example to .env and fill it in"
chmod 600 .env 2>/dev/null || true

# Read one KEY=VALUE from .env without sourcing it (values such as the cron
# schedule contain spaces, and sourcing user-controlled files is avoidable).
env_value() {
  local key="$1"
  sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//p" .env |
    tail -n 1 |
    sed -e 's/\r$//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

for key in API_DOMAIN DATABASE_URL JWT_ACCESS_SECRET CORS_ORIGIN GOOGLE_ALLOWED_CLIENT_IDS; do
  [ -n "$(env_value "$key")" ] || fail "$key is empty in .env"
done

[ "$(env_value API_DOMAIN)" != "api.example.com" ] ||
  fail "API_DOMAIN is still the example value -- set the hostname that points at this VM"
case "$(env_value API_DOMAIN)" in
  *://* | */*) fail "API_DOMAIN must be a bare hostname (for example api.pluto.example), not a URL" ;;
esac
case "$(env_value DATABASE_URL)" in
  *ep-example*) fail "DATABASE_URL is still the example value" ;;
esac

jwt_secret="$(env_value JWT_ACCESS_SECRET)"
[ "${#jwt_secret}" -ge 32 ] ||
  fail "JWT_ACCESS_SECRET must be at least 32 characters (openssl rand -hex 32)"
[ "$jwt_secret" != "development_jwt_access_secret_min_32_characters_long_12345" ] ||
  fail "JWT_ACCESS_SECRET is still the development default"

case "$(env_value CORS_ORIGIN)" in
  *'*'*) fail "CORS_ORIGIN must list explicit origins; a wildcard is refused in production" ;;
  *example.com*) fail "CORS_ORIGIN still uses example.com -- set the real web origin" ;;
esac

if [ "$(env_value ACME_EMAIL)" = "you@example.com" ]; then
  printf 'warning: ACME_EMAIL is still the example value; certificate expiry notices will go nowhere\n' >&2
fi

case "$MODE" in
  build | pull) ;;
  *) fail "usage: $0 [build|pull]" ;;
esac

# A multi-stage npm build needs roughly 2 GB. Refuse early on a small VM with a
# clear message instead of letting the kernel OOM-kill the build halfway.
if [ "$MODE" = "build" ] && [ -r /proc/meminfo ]; then
  mem_kb="$(awk '/^MemTotal:|^SwapTotal:/ { total += $2 } END { print total + 0 }' /proc/meminfo)"
  [ "$mem_kb" -ge 1800000 ] ||
    fail "building needs ~2 GB of RAM/swap; use 'bash deploy.sh pull' with PLUTO_IMAGE, or add swap"
fi

# Compose parses .env itself; this catches malformed interpolation early
# (e.g. API_DOMAIN missing) before anything is built or pulled.
docker compose config --quiet

# ---------------------------------------------------------------------------
# Image
# ---------------------------------------------------------------------------
case "$MODE" in
  build)
    say "Building the server image"
    docker compose build api
    ;;
  pull)
    [ -n "$(env_value PLUTO_IMAGE)" ] ||
      fail "PLUTO_IMAGE must be set in .env when using 'bash deploy.sh pull'"
    say "Pulling $(env_value PLUTO_IMAGE)"
    docker compose pull api
    ;;
esac

# ---------------------------------------------------------------------------
# Schema, then application
# ---------------------------------------------------------------------------
# Migrations run before the new code starts. They are forward-only; a deploy
# that changes columns incompatibly still needs a compatible rollback plan.
say "Applying database migrations"
docker compose --profile tools run --rm --no-deps --no-build migrate

say "Starting the API and reverse proxy"
docker compose up -d --remove-orphans --no-build

say "Waiting for /v1/health/ready"
for _ in $(seq 1 60); do
  if docker compose exec -T api node -e \
    "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/v1/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" \
    >/dev/null 2>&1; then
    docker compose ps
    # Keep two weeks of rollback images; the running image is never pruned.
    say "Pruning unused images older than 14 days"
    docker image prune -af --filter "until=336h" >/dev/null || true
    if [ "$MODE" = "build" ]; then
      docker builder prune -f --filter "until=168h" >/dev/null || true
    fi
    domain="$(env_value API_DOMAIN)"
    case "$domain" in
      :*) printf '\nAPI is ready on http://<this-host>%s/v1\n' "$domain" ;;
      *) printf '\nAPI is ready at https://%s/v1\n' "${domain%% *}" ;;
    esac
    exit 0
  fi
  sleep 2
done

docker compose ps || true
docker compose logs --tail=50 api || true
fail "the API did not become ready within 120s (see the logs above)"
