# Running the API on a single VM

This directory deploys the NestJS API on **any Linux VM that runs Docker** — a
GCE e2-micro, Hetzner, Oracle Cloud, a homelab box — without Render or another
PaaS. It is the same image that `render.yaml` builds, plus:

| Piece | Role |
| :--- | :--- |
| `api` | the server container, not published on the host |
| `caddy` | TLS termination (automatic HTTPS) + compression on `:80` / `:443` |
| `migrate` | one-shot `prisma migrate deploy`, run from the same image before the API restarts |
| `deploy.sh` | validates `.env`, builds/pulls, migrates, restarts, waits for `/v1/health/ready` |

The database is **not** part of the stack on purpose: use a managed Postgres
(Neon branch) as described in [`docs/ENVIRONMENTS.md`](../../../../docs/ENVIRONMENTS.md).
A 1 GB VM should not run Postgres and the API together, and a free VM has no
managed backups.

## Requirements

- Linux, `x86_64` or `arm64`. **1 GB RAM minimum** for the API alone.
- Docker Engine 24+ with the Compose v2 plugin (`docker compose`, not the old
  `docker-compose`).
- A domain (or subdomain) with an `A`/`AAAA` record pointing at the VM, for TLS.
  An IP-only deployment (`API_DOMAIN=:80`) works but is HTTP and unsuitable for
  real users.
- A PostgreSQL connection string (Neon or equivalent) with `sslmode=require`.
- Inbound TCP `80` and `443`, plus UDP `443` if you want HTTP/3. **Do not** open
  the API port (`3000`) or the database port to the internet.

## 1. Prepare the host

Install Docker from the [official instructions](https://docs.docker.com/engine/install/),
then let your user run it without `sudo`:

```bash
sudo usermod -aG docker "$USER"
newgrp docker            # or log out and back in
docker compose version
```

Point DNS at the VM before the first deploy so Caddy can obtain a certificate.
On a 1 GB VM add swap so an occasional spike does not OOM-kill the container:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 2. Configure

From the repository root on the VM:

```bash
cd apps/server/deploy/vm
cp .env.example .env
chmod 600 .env
$EDITOR .env
```

At minimum fill in:

| Variable | Notes |
| :--- | :--- |
| `API_DOMAIN` | `api.pluto.example`, or `:80` for an HTTP-only test |
| `ACME_EMAIL` | certificate expiry notices |
| `DATABASE_URL` | managed Postgres, `sslmode=require`, `connection_limit=5` |
| `JWT_ACCESS_SECRET` | 32+ random chars (`openssl rand -hex 32`) |
| `CORS_ORIGIN` | explicit browser origin(s), https, no wildcard |
| `GOOGLE_ALLOWED_CLIENT_IDS` | the Web client ID the app signs in with |
| `ADMIN_EMAILS` | your address, for `/v1/admin/*` |

`deploy.sh` refuses to run while a required value is empty, the JWT secret is
short or the development default, or `CORS_ORIGIN` contains a wildcard. The
server repeats the same checks at boot and will not start on a bad config.

`TRUST_PROXY` means "number of proxy hops": `true` is one hop (Caddy). Use `2`
if you add Cloudflare in front of Caddy, otherwise rate limiting keys on the
CDN's edge IP instead of the client's.

## 3. Deploy

```bash
bash deploy.sh          # build on this machine
bash deploy.sh pull     # pull PLUTO_IMAGE from a registry
```

Both modes run migrations first, then recreate the containers and poll the
readiness probe for up to two minutes. Re-running is safe. If a migration fails,
the script exits before recreating the API, so the previously running version
keeps serving.

### Building vs pulling

Building needs roughly 2 GB of RAM (the npm install and Nest compile). On a
1 GB e2-micro, publish the image from CI instead:

1. `.github/workflows/publish-server-image.yml` pushes
   `ghcr.io/<owner>/pluto-server` on every push to `main` and on tags.
2. On the VM, log in once if the package is private:
   ```bash
   echo "$GHCR_PAT" | docker login ghcr.io -u <github-user> --password-stdin
   ```
3. Set `PLUTO_IMAGE=ghcr.io/<owner>/pluto-server:latest` in `.env` and run
   `bash deploy.sh pull`.

Any registry works; `PLUTO_IMAGE` is just a tag. To deploy a specific build,
use the `sha-<short>` tag the workflow produces.

## 4. Verify

```bash
docker compose ps
docker compose logs -f api
curl -fsS https://api.pluto.example/v1/health/ready
```

- `live` proves the process is up.
- `ready` additionally proves Postgres is reachable (503 while it is not).
- `https://api.pluto.example/v1/rates/latest` is a useful authenticated-free
  smoke test of the rate table.

Set `EXPO_PUBLIC_API_URL=https://api.pluto.example/v1` for the mobile/web
clients, and add the web origin to `CORS_ORIGIN` and to the Google Web client's
authorized origins.

## Operating

**Logs.** `docker compose logs -f api` (capped at 10 MB × 3 files per
container). The API logs one line per request and prints to stdout.

**Updates.**

```bash
git pull --ff-only
bash deploy.sh          # or bash deploy.sh pull
```

**Rollback.** Deploy the previous image tag; the schema stays as migrated:

```bash
PLUTO_IMAGE=ghcr.io/<owner>/pluto-server:sha-abc1234 bash deploy.sh pull
```

Migrations are forward-only. A code rollback across an incompatible migration
needs its own plan (see [`docs/PRODUCTION.md`](../../docs/PRODUCTION.md)). For a
migration that is not backward-compatible with the running version, stop the
API first (`docker compose stop api`) and accept a short outage.

**Migrations only.**

```bash
docker compose --profile tools run --rm migrate
```

**Background jobs.** The VM is always on, so the daily rate sync and hourly
cleanup cron run in-process — unlike Render's free plan, which spins down and
runs nothing. `RATES_SYNC_TOKEN` and the GitHub `rates-sync` workflow are
therefore optional here; if both run, the database lock makes the second one a
no-op.

**Backups.** Use the database provider's automated backups / PITR. Nothing on
the VM is a backup: the only durable state is PostgreSQL (object storage, when
enabled, is S3-compatible and external).

**Monitoring.** Point an external uptime check at `/v1/health/ready` (and, if
you want an alert on a database outage, at `/v1/health`). The app has no Sentry
integration, so the container logs are the only error trail.

## Memory on a 1 GB VM

`docker-compose.yml` caps the API container at `API_MEMORY_LIMIT=512m` and the
Node heap at `NODE_OPTIONS=--max-old-space-size=320`; Caddy is capped at 128 MB.
Leave those in place on an e2-micro — without a heap cap, Node's default can
grow far past the VM's RAM and the OOM killer takes down the host, not just the
container.

If you also want the Next.js site on the same box, use a 2 GB+ VM and give each
service its own limit. Do not add Postgres.

> **GCP free-tier egress.** The free e2-micro also includes only about 1 GB per
> month of North America egress. That is a traffic cap, not a memory cap; check
> the current allowance before treating the free instance as production.

## How it works

- Compose builds from the **repository root** (`context: ../../../..`) because
  the npm workspace lockfile is required.
- The runtime image includes the Prisma CLI and the generated client, so the
  `migrate` service needs no devDependencies, no Node on the host and no
  network fetch at deploy time.
- The API container **never migrates on boot**. That keeps its resilience: if
  Postgres is down, the process still starts and reports `503` from `/ready`
  instead of crash-looping. `deploy.sh` runs migrations as a separate step.
- Only Caddy publishes ports. The API is reachable only on the Compose network.
- Caddy gets certificates automatically and forwards `X-Forwarded-*`; the app
  trusts one hop (`TRUST_PROXY=true`) and sets HSTS itself.

## Troubleshooting

| Symptom | Likely cause |
| :--- | :--- |
| `deploy.sh` exits on `API_DOMAIN` | `.env` is missing, the value is empty, or it is still `api.example.com`; Compose interpolates it with `:?` |
| Caddy logs `obtaining certificate` errors | DNS does not point at the VM yet, or inbound `80`/`443` is blocked |
| `502` from Caddy | the API container is restarting — `docker compose logs api` |
| `/ready` stays `503` | `DATABASE_URL` is wrong, the DB is asleep/unreachable, or `channel_binding=require` was left in the URL |
| `prisma migrate deploy` fails with P1001 | the migration service cannot reach the database; check the URL and the provider's IP allow-list |
| `prisma migrate deploy` fails with a prepared-statement/pooler error | the pooled endpoint cannot run this migration; point `DATABASE_URL` at the direct (non-`-pooler`) host, or append `pgbouncer=true` |
| 429s for all users at once behind Cloudflare | `TRUST_PROXY` is `true` (one hop) but there are two proxies — set `2` |
| Container killed with exit 137 | hit `API_MEMORY_LIMIT`; raise it and `NODE_OPTIONS` together, or add swap |

## Security checklist

- [ ] Firewall allows only `22` (ideally from a bastion/IAP), `80`, `443/tcp`,
      `443/udp`.
- [ ] `.env` is `chmod 600` and never committed (the repo ignores `.env*`).
- [ ] `JWT_ACCESS_SECRET`, `RATES_SYNC_TOKEN` and DB credentials differ from
      staging.
- [ ] `ENABLE_DEV_AUTH=false`, `OBJECT_STORAGE_ENABLED=false` until you have a
      bucket.
- [ ] OS security updates enabled (`unattended-upgrades` on Debian/Ubuntu).
- [ ] Docker daemon access is restricted to trusted users (it is root-equivalent).
