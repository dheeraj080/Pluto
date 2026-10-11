# Pluto Server

> Production-ready TypeScript backend service for the Pluto Android mobile application, providing Google Sign-In, automated daily exchange-rate synchronization, and versioned cloud backups with S3-compatible object storage.

---

## Table of Contents

- [Architecture & Tech Stack](#architecture--tech-stack)
- [System Architecture Diagram](#system-architecture-diagram)
- [Project Directory Structure](#project-directory-structure)
- [Prerequisites](#prerequisites)
- [Local Development Setup (Windows / PowerShell)](#local-development-setup-windows--powershell)
- [Environment Configuration](#environment-configuration)
- [External Services Setup](#external-services-setup)
  - [1. Google Cloud Console (OAuth 2.0)](#1-google-cloud-console-oauth-20)
  - [2. S3 / MinIO Object Storage](#2-s3--minio-object-storage)
- [Database Migrations & Prisma](#database-migrations--prisma)
- [API Reference & Usage Examples](#api-reference--usage-examples)
  - [Health & Diagnostics](#health--diagnostics)
  - [Authentication](#authentication)
  - [User Profile](#user-profile)
  - [Exchange Rates](#exchange-rates)
  - [Expense Tracker](#expense-tracker)
  - [Cloud Backups](#cloud-backups)
  - [Admin (role-gated)](#admin-role-gated)
- [Mobile Client Integration Runbook](#mobile-client-integration-runbook)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Production Deployment](#production-deployment)
- [License](#license)

---

## Architecture & Tech Stack

Pluto Server is designed as a robust modular monolith following clean architecture principles, strict typing, and comprehensive security standards.

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Framework** | [NestJS 11](https://nestjs.com/) | Structured dependency injection, modular encapsulation, declarative decorators |
| **Language** | [TypeScript 5.7+](https://www.typescriptlang.org/) | Strict mode enabled (`noImplicitAny`, `strictNullChecks`, `noImplicitOverride`) |
| **Database** | [PostgreSQL 17](https://www.postgresql.org/) | Relational consistency, JSONB metadata support, ACID transactions |
| **ORM** | [Prisma 6](https://www.prisma.io/) | Type-safe queries, declarative schema migrations, connection pooling |
| **Storage** | AWS SDK v3 (`@aws-sdk/client-s3`) | S3-compatible object storage (AWS S3, Cloudflare R2, MinIO) with presigned URLs |
| **Authentication**| Passport + Google Auth Library | Cryptographic ID token verification, JWT access tokens, rotating refresh sessions |
| **Scheduling** | `@nestjs/schedule` | Cron-based background synchronization with database-backed distributed locking |
| **Rate Limiting**| `@nestjs/throttler` | Per-IP and per-route throttling to guard against abuse |
| **Validation** | Zod + Class Validator | Fail-fast environment parsing and strict incoming request validation |
| **Documentation**| OpenAPI 3 / Swagger | Interactive live API documentation and schema explorer |

---

## System Architecture Diagram

```mermaid
graph TD
    Client[Android Application] -->|HTTPS REST| Gateway[NestJS API Gateway]

    subgraph Security & Middlewares
        Gateway --> Throttler[Rate Limiter]
        Throttler --> AuthGuard[JWT / Public Guard]
        AuthGuard --> ValPipe[Zod / Validation Pipe]
    end

    subgraph Pluto Modules
        ValPipe --> AuthMod[Auth Module]
        ValPipe --> UserMod[Users Module]
        ValPipe --> RatesMod[Rates Module]
        ValPipe --> BackupMod[Backups Module]
    end

    subgraph External & Persistence
        AuthMod -->|Verify ID Token| GoogleOAuth[Google Identity Services]
        RatesMod -->|Fetch Rates| Frankfurter[Frankfurter ECB Provider]
        BackupMod -->|Presigned URLs| S3[AWS S3 / MinIO Storage]
        AuthMod --> Prisma[(PostgreSQL Database)]
        RatesMod --> Prisma
        BackupMod --> Prisma
        UserMod --> Prisma
    end

    subgraph Background Tasks
        Scheduler[NestJS Scheduler] -->|Distributed Lock| Lock[SystemLock Table]
        Scheduler -->|Daily Sync| RatesMod
        Scheduler -->|Hourly Cleanup| BackupMod
    end
```

---

## Project Directory Structure

```text
pluto-server/
├── prisma/
│   ├── migrations/             # Versioned SQL migrations
│   │   ├── 20261009000000_init/
│   │   └── migration_lock.toml
│   └── schema.prisma           # Prisma schema definition
├── src/
│   ├── common/                 # Global cross-cutting concerns
│   │   ├── decorators/         # @Public(), @CurrentUser()
│   │   ├── dto/                # ApiResponseDto, standardized response wrappers
│   │   ├── filters/            # AllExceptionsFilter (RFC 7807 compliant error format)
│   │   └── interceptors/       # LoggingInterceptor, TransformInterceptor
│   ├── config/                 # Environment validation via Zod
│   │   ├── config.module.ts
│   │   └── env.validation.ts
│   ├── database/               # Prisma client wrapper and database lifecycle
│   │   ├── database.module.ts
│   │   └── prisma.service.ts
│   ├── health/                 # Liveness, readiness, and DB/S3 probes
│   │   ├── health.controller.ts
│   │   └── health.service.ts
│   ├── modules/
│   │   ├── auth/               # Google OAuth, JWT tokens, refresh sessions
│   │   │   ├── guards/         # JwtAuthGuard
│   │   │   ├── services/       # GoogleAuthService
│   │   │   ├── strategies/     # JwtStrategy
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.service.ts
│   │   ├── users/              # User profile management
│   │   │   ├── users.controller.ts
│   │   │   └── users.service.ts
│   │   ├── rates/              # Exchange rates sync, caching, Frankfurter provider
│   │   │   ├── interfaces/     # IExchangeRateProvider
│   │   │   ├── providers/      # FrankfurterProvider (with retry & fallback)
│   │   │   ├── rates.controller.ts
│   │   │   ├── rates.scheduler.ts
│   │   │   └── rates.service.ts
│   │   ├── expenses/           # Expense tracking: categories, expenses, budgets, reports
│   │   │   ├── dto/            # Request/response contracts
│   │   │   ├── currency-converter.service.ts
│   │   │   ├── expenses.controller.ts
│   │   │   ├── expenses-reports.service.ts
│   │   │   ├── expenses.service.ts
│   │   │   ├── expenses.utils.ts
│   │   │   └── expenses.module.ts
│   │   └── backups/            # Cloud backup metadata, S3 presigned URLs, retention pruning
│   │       ├── storage/        # StorageService (AWS S3 Client)
│   │       ├── backups.controller.ts
│   │       ├── backups.scheduler.ts
│   │       └── backups.service.ts
│   ├── app.module.ts           # Root module with global guards and schedulers
│   └── main.ts                 # Application bootstrap, Swagger UI, shutdown hooks
├── test/                       # E2E test suite (app.e2e-spec.ts)
├── .env.example                # Documented environment variables template
├── docker-compose.yml          # Local PostgreSQL 17 & MinIO containers
├── Dockerfile                  # Multi-stage production container build
├── eslint.config.mjs           # ESLint 9 flat configuration
├── tsconfig.json               # TypeScript configuration with path aliases
└── package.json
```

---

## Prerequisites

Before starting, install the following tools:
1. **Node.js** (v20.x or v22.x/v24.x LTS): [Download Node.js](https://nodejs.org/)
2. **Docker Desktop for Windows**: [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)
3. **Git**: [Download Git](https://git-scm.com/)

---

## Local Development Setup (Windows / PowerShell)

Follow these steps in **PowerShell**:

### 1. Clone the repository
```powershell
git clone <repository-url>
cd d:\Projeckt\pluto-server
```

### 2. Install dependencies
```powershell
npm install
```

### 3. Configure environment variables
Create a `.env` file from the provided template:
```powershell
Copy-Item .env.example .env
```

### 4. Start Local Infrastructure via Docker Compose
Start PostgreSQL 17 and MinIO (local S3 equivalent):
```powershell
docker compose up -d
```
Verify the services are healthy:
```powershell
docker compose ps
```
- **PostgreSQL**: `localhost:5432` (User: `postgres`, Password: `postgres_password`, DB: `pluto_db`)
- **MinIO S3 API**: `http://localhost:9000`
- **MinIO Console**: `http://localhost:9001` (User: `minioadmin`, Password: `minioadmin_password`)

### 5. Run Database Migrations
Apply migrations to PostgreSQL and generate the Prisma Client:
```powershell
npm run prisma:generate
npm run prisma:migrate:dev
```

### 6. Start the Application
Run the application in development mode with live code reload:
```powershell
npm run start:dev
```

Once launched:
- **Base API URL**: `http://localhost:3000/v1`
- **Interactive Swagger UI**: `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/v1/health`

---

## Environment Configuration

All environment variables are validated at startup via Zod in [src/config/env.validation.ts](file:///d:/Projeckt/pluto-server/src/config/env.validation.ts). If required variables are missing or malformed, the application will exit immediately with descriptive error messages.

| Variable | Description | Default | Required |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Application environment (`development`, `production`, `test`) | `development` | No |
| `PORT` | HTTP port to listen on | `3000` | No |
| `API_PREFIX` | Global route prefix | `v1` | No |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres_password@localhost:5432/pluto_db?schema=public` | **Yes** |
| `JWT_SECRET` | Secret key for signing access tokens (min 32 chars in production) | — | **Yes** |
| `JWT_ACCESS_TOKEN_TTL` | Access token lifetime (e.g. `15m`, `1h`) | `15m` | No |
| `JWT_REFRESH_TOKEN_TTL_DAYS` | Refresh token session lifetime in days | `30` | No |
| `GOOGLE_CLIENT_IDS` | Comma-separated list of permitted Google OAuth Client IDs (Android, Web) | `test-client-id.apps.googleusercontent.com` | **Yes** |
| `S3_ENDPOINT` | Custom endpoint for MinIO / LocalStack (empty for AWS S3) | `http://localhost:9000` | No |
| `S3_REGION` | S3 Region | `us-east-1` | **Yes** |
| `S3_BUCKET_NAME` | S3 bucket for storing mobile backups | `pluto-backups` | **Yes** |
| `S3_ACCESS_KEY_ID` | AWS / MinIO Access Key | `minioadmin` | **Yes** |
| `S3_SECRET_ACCESS_KEY` | AWS / MinIO Secret Key | `minioadmin_password` | **Yes** |
| `S3_FORCE_PATH_STYLE` | Set `true` for MinIO path style routing | `true` | No |
| `MAX_BACKUPS_PER_USER` | Maximum retained backups per user before automatic FIFO pruning | `10` | No |
| `BACKUP_UPLOAD_URL_TTL_SECONDS` | Lifetime of presigned upload URLs (seconds) | `900` (15 min) | No |
| `BACKUP_DOWNLOAD_URL_TTL_SECONDS` | Lifetime of presigned download URLs (seconds) | `300` (5 min) | No |
| `THROTTLE_TTL` | Rate limiter window in seconds | `60` | No |
| `THROTTLE_LIMIT` | Global maximum requests per window per IP | `100` | No |
| `ADMIN_EMAILS` | Comma-separated e-mail addresses promoted to the `ADMIN` role on sign-in (grants access to `/v1/admin/*`) | `""` | No |
| `ENABLE_DEV_AUTH` | Enable the mock `POST /v1/auth/dev-login` endpoint (dev only — refused at boot when `NODE_ENV=production`) | `false` | No |

---

## External Services Setup

### 1. Google Cloud Console (OAuth 2.0)
To configure Google Sign-In for the Android mobile application:
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select your Google Cloud project.
3. Go to **APIs & Services** > **Credentials**.
4. Click **Create Credentials** > **OAuth client ID**.
5. Create **two** Client IDs:
   - **Android Client ID**: Specify your package name (e.g., `com.pluto.app`) and SHA-1 signing fingerprint from your keystore (`keytool -list -v -keystore ...`).
   - **Web Application Client ID**: Used by the backend to verify the ID tokens issued to the Android app.
6. Copy the **Web Client ID** and set it in your `.env`:
   ```dotenv
   GOOGLE_CLIENT_IDS="your-web-client-id.apps.googleusercontent.com,your-android-client-id.apps.googleusercontent.com"
   ```

### 2. S3 / MinIO Object Storage
For local development, MinIO is automatically provisioned via `docker-compose.yml`.

#### Using MinIO locally:
1. Open MinIO Console at `http://localhost:9001` (Credentials: `minioadmin` / `minioadmin_password`).
2. Create bucket named `pluto-backups`.
3. Set CORS policy on bucket if testing web uploads directly:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

#### Using AWS S3 in Production:
1. Create an S3 bucket in your target region (e.g., `pluto-prod-backups`).
2. Enable default server-side encryption (SSE-S3 or KMS).
3. Block public access completely (all access is conducted via presigned URLs).
4. Create an IAM user or role with least-privilege permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::pluto-prod-backups",
           "arn:aws:s3:::pluto-prod-backups/*"
         ]
       }
     ]
   }
   ```
5. Set `S3_FORCE_PATH_STYLE="false"` and leave `S3_ENDPOINT=""` for direct AWS endpoint routing.

---

## Database Migrations & Prisma

The repository contains version-controlled Prisma migrations in `prisma/migrations/`.

```powershell
# Generate Prisma client after schema changes
npm run prisma:generate

# Apply pending migrations (development)
npm run prisma:migrate:dev

# Apply migrations in production CI/CD pipelines
npm run prisma:migrate:deploy

# Inspect database visually with Prisma Studio
npm run prisma:studio
```

---

## API Reference & Usage Examples

All requests return a consistent JSON response envelope:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-10-09T04:30:00.000Z"
}
```

### Health & Diagnostics

#### `GET /v1/health`
Check service liveness, readiness, uptime, memory, and database connectivity.
```powershell
curl.exe -i http://localhost:3000/v1/health
```

---

### Authentication

#### `POST /v1/auth/google`
Authenticate an Android user via Google ID Token. If user does not exist, an account is automatically provisioned.
```powershell
curl.exe -i -X POST http://localhost:3000/v1/auth/google `
  -H "Content-Type: application/json" `
  -d '{"idToken": "eyJhbGciOiJSUzI1NiIs..."}'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "4a7f9b8c2d1e0f3a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "email": "user@example.com",
      "name": "Jane Doe",
      "pictureUrl": "https://lh3.googleusercontent.com/a/...",
      "createdAt": "2026-10-09T00:00:00.000Z"
    }
  }
}
```

#### `POST /v1/auth/dev-login`
**Development only** — passwordless mock sign-in that mints a session without Google.
Useful for exercising the web app when no real OAuth client ID is configured. Available
only when `ENABLE_DEV_AUTH=true` **and** `NODE_ENV != production`; the server refuses
to boot with the flag set in production, and when disabled the route returns `404` so
it is indistinguishable from a missing endpoint.
```powershell
# Creates / reuses the shared dev@pluto.local account
curl.exe -i -X POST http://localhost:3000/v1/auth/dev-login `
  -H "Content-Type: application/json" `
  -d '{}'

# Or sign in as a specific account
curl.exe -i -X POST http://localhost:3000/v1/auth/dev-login `
  -H "Content-Type: application/json" `
  -d '{"email": "tester@example.com", "name": "Tester"}'
```
Synthetic accounts are created with a namespaced `googleId` (`dev:<email>`) so they can
never be mistaken for real Google accounts. The response matches the Google flow exactly
(access token + one-time refresh token + user), so the web client stores it the same way.

#### `POST /v1/auth/refresh`
Rotate refresh session. Uses one-time tokens with replay detection: if an already-used refresh token is presented, all user sessions are immediately invalidated.
```powershell
curl.exe -i -X POST http://localhost:3000/v1/auth/refresh `
  -H "Content-Type: application/json" `
  -d '{"refreshToken": "4a7f9b8c2d1e0f3a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a"}'
```

#### `POST /v1/auth/logout`
Revoke the active refresh session upon user logout.
```powershell
curl.exe -i -X POST http://localhost:3000/v1/auth/logout `
  -H "Content-Type: application/json" `
  -d '{"refreshToken": "4a7f9b8c2d1e0f3a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a"}'
```

---

### User Profile

#### `GET /v1/users/me`
Retrieve authenticated user profile. Requires `Authorization: Bearer <accessToken>`.
```powershell
curl.exe -i -H "Authorization: Bearer <accessToken>" http://localhost:3000/v1/users/me
```

#### `PATCH /v1/users/me`
Update profile display name.
```powershell
curl.exe -i -X PATCH http://localhost:3000/v1/users/me `
  -H "Authorization: Bearer <accessToken>" `
  -H "Content-Type: application/json" `
  -d '{"name": "Jane Smith"}'
```

#### `DELETE /v1/users/me`
GDPR-compliant account deletion. Deletes all user backups, sessions, and database records.
```powershell
curl.exe -i -X DELETE -H "Authorization: Bearer <accessToken>" http://localhost:3000/v1/users/me
```

---

### Exchange Rates

#### `GET /v1/rates/supported-currencies`
Public endpoint returning supported currencies list, base currency, and latest snapshot date.
```powershell
curl.exe -i http://localhost:3000/v1/rates/supported-currencies
```

#### `GET /v1/rates/latest`
Fetch latest exchange rates with conditional HTTP caching (`ETag` and `If-None-Match`).
```powershell
# Initial fetch
curl.exe -i http://localhost:3000/v1/rates/latest

# Subsequent fetch returning HTTP 304 Not Modified if unchanged
curl.exe -i -H 'If-None-Match: "2026-10-09-v1"' http://localhost:3000/v1/rates/latest
```

---

### Expense Tracker

All `/v1/expenses/*` routes require a valid access token and operate strictly on the caller's own data.
A cross-account identifier returns `404 Not Found` rather than `403`, so the API never confirms that
another user's record exists.

Amounts are stored in the currency they were entered in. Report endpoints convert spending into a base
currency using the latest rate snapshot (see [Exchange Rates](#exchange-rates)); the base resolves from the
`base` query parameter, falling back to `EXCHANGE_RATE_BASE_CURRENCY`. Only currencies in `SUPPORTED_CURRENCIES`
are accepted — anything else is a `400`.

Conversion happens against a single snapshot: `amountInBase = amount / rates[C]`, where `rates[base] === 1.0`
and `rates` comes from one `GET /v1/rates/latest?base=<base>` call. If no snapshot is available the report
degrades instead of failing — the payload returns `converted: false`, null base-currency totals, and native
per-currency subtotals remain populated. An *unsupported* base currency is still a `400`, since that is a
client error rather than a missing-data condition.

#### Categories

A brand-new account is seeded lazily with a default category set on the first `GET /v1/expenses/categories`.

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/v1/expenses/categories` | List categories (ordered, with per-category expense counts) |
| `POST` | `/v1/expenses/categories` | Create a category (`409` on duplicate name) |
| `PATCH` | `/v1/expenses/categories/:id` | Rename / recolour / reorder |
| `DELETE` | `/v1/expenses/categories/:id` | Delete (`409` while expenses are still assigned) |

```powershell
curl.exe -i -H "Authorization: Bearer <accessToken>" http://localhost:3000/v1/expenses/categories

curl.exe -i -X POST http://localhost:3000/v1/expenses/categories `
  -H "Authorization: Bearer <accessToken>" `
  -H "Content-Type: application/json" `
  -d '{ "name": "Groceries", "color": "#f59e0b", "icon": "utensils" }'
```

#### Expenses

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/v1/expenses` | Paginated, filterable list (newest first by default) |
| `POST` | `/v1/expenses` | Record an expense |
| `GET` | `/v1/expenses/:id` | Fetch a single expense |
| `PATCH` | `/v1/expenses/:id` | Update an expense |
| `DELETE` | `/v1/expenses/:id` | Delete an expense |

`GET /v1/expenses` query parameters: `page` (default 1), `limit` (default 20, max 50), `categoryId`,
`from` / `to` (inclusive ISO dates), `minAmount` / `maxAmount`, `currency`, `search` (case-insensitive
over the description), and `sort` (`date_desc` \| `date_asc` \| `amount_desc` \| `amount_asc`).

`POST /v1/expenses` body: `categoryId`, `amount` (> 0), `currency` (supported code), `incurredOn`
(ISO date), and optional `description` (≤ 280 chars) / `paymentMethod` (≤ 32 chars).

```powershell
curl.exe -i -X POST http://localhost:3000/v1/expenses `
  -H "Authorization: Bearer <accessToken>" `
  -H "Content-Type: application/json" `
  -d '{
    "categoryId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "amount": 42.5,
    "currency": "USD",
    "incurredOn": "2026-10-10",
    "description": "Weekly groceries",
    "paymentMethod": "CARD"
  }'

curl.exe -i -H "Authorization: Bearer <accessToken>" "http://localhost:3000/v1/expenses?page=1&limit=20&sort=amount_desc&search=grocer"
```

**Response (200 OK) — list:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "9d2c4f1e-…",
        "categoryId": "f47ac10b-…",
        "categoryName": "Groceries",
        "amount": 42.5,
        "currency": "USD",
        "incurredOn": "2026-10-10",
        "description": "Weekly groceries",
        "paymentMethod": "CARD",
        "createdAt": "2026-10-10T08:00:00.000Z",
        "updatedAt": "2026-10-10T08:00:00.000Z"
      }
    ],
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  },
  "timestamp": "2026-10-10T08:00:00.000Z"
}
```

#### Budgets

Budgets apply to a single category, or to the whole account when `categoryId` is omitted. Only one budget
per `(category, period)` pair is allowed; the uniqueness check lives in the service layer because Postgres
treats `NULL` as distinct in the underlying unique index (so overall budgets would otherwise duplicate).

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/v1/expenses/budgets` | List budgets |
| `POST` | `/v1/expenses/budgets` | Create a budget (`409` on duplicate `(category, period)`) |
| `PATCH` | `/v1/expenses/budgets/:id` | Update the amount / start date |
| `DELETE` | `/v1/expenses/budgets/:id` | Delete a budget |

`POST` body: `amount` (> 0), `currency`, optional `categoryId` (omit for an overall budget), optional
`period` (`MONTHLY` \| `YEARLY`, default `MONTHLY`), optional `startDate` (default today).

```powershell
curl.exe -i -X POST http://localhost:3000/v1/expenses/budgets `
  -H "Authorization: Bearer <accessToken>" `
  -H "Content-Type: application/json" `
  -d '{ "categoryId": null, "amount": 1000, "currency": "USD", "period": "MONTHLY", "startDate": "2026-10-01" }'
```

#### Reports

| Method | Path | Query | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/expenses/summary` | `from`, `to`, `base` | Period total, average, per-category breakdown, per-currency subtotals |
| `GET` | `/v1/expenses/trends` | `months` (default 12, max 24), `base` | Continuous monthly totals for charts, empty months included |
| `GET` | `/v1/expenses/comparison` | `currentFrom`, `currentTo`, `previousFrom`, `previousTo`, `base` | Two summaries plus absolute/percentage deltas (period-over-period) |
| `GET` | `/v1/expenses/top` | `from`, `to`, `limit` (default 10, max 100), `base` | Largest expenses in the range, converted when possible |
| `GET` | `/v1/expenses/by-day-of-week` | `from`, `to`, `base` | Totals, counts and averages bucketed into Sun–Sat |
| `GET` | `/v1/expenses/export.csv` | `from`, `to`, `categoryId`, `currency`, `search`, `base` | CSV export of the filtered expenses |
| `GET` | `/v1/expenses/budgets/status` | `month` (`YYYY-MM`), `base` | Every budget compared against actual spend for the month |

`summary` defaults to the first day of the current month through today. `trends` returns months oldest-first
so a chart can render left to right. `comparison` returns two full `summary` payloads and a `delta` object;
`top` orders by native amount descending; `by-day-of-week` always returns seven rows (empty days included)
and is pointless once rate conversion is unavailable, so read the top-level `converted` flag. Every
conversion-dependent field follows the same rule as the rest of the module: when no rate snapshot exists the
payload comes back with `converted: false` and null converted figures rather than failing.
`budgets/status` evaluates each budget's own period window (a `YEARLY` budget sums the whole year to date),
not just the requested month.

```powershell
curl.exe -i -H "Authorization: Bearer <accessToken>" "http://localhost:3000/v1/expenses/summary?from=2026-10-01&to=2026-10-31&base=USD"
curl.exe -i -H "Authorization: Bearer <accessToken>" "http://localhost:3000/v1/expenses/trends?months=6&base=EUR"
curl.exe -i -H "Authorization: Bearer <accessToken>" "http://localhost:3000/v1/expenses/comparison?currentFrom=2026-10-01&currentTo=2026-10-31&previousFrom=2026-09-01&previousTo=2026-09-30&base=USD"
curl.exe -i -H "Authorization: Bearer <accessToken>" "http://localhost:3000/v1/expenses/top?from=2026-10-01&to=2026-10-31&limit=5&base=USD"
curl.exe -i -H "Authorization: Bearer <accessToken>" "http://localhost:3000/v1/expenses/by-day-of-week?from=2026-10-01&to=2026-10-31&base=USD"
curl.exe -i -H "Authorization: Bearer <accessToken>" "http://localhost:3000/v1/expenses/export.csv?from=2026-10-01&to=2026-10-31&base=USD" -o expenses.csv
curl.exe -i -H "Authorization: Bearer <accessToken>" "http://localhost:3000/v1/expenses/budgets/status?month=2026-10&base=USD"
```

**Response (200 OK) — summary:**
```json
{
  "success": true,
  "data": {
    "from": "2026-10-01",
    "to": "2026-10-31",
    "baseCurrency": "USD",
    "converted": true,
    "total": 239.13,
    "average": 47.83,
    "count": 5,
    "byCategory": [
      { "categoryId": "…", "categoryName": "Shopping", "total": 120, "count": 1, "percentage": 50.18 }
    ],
    "byCurrency": [
      { "currency": "USD", "total": 177.5, "count": 3 },
      { "currency": "EUR", "total": 55, "count": 2 }
    ]
  },
  "timestamp": "2026-10-10T08:00:00.000Z"
}
```

**Response (200 OK) — budget status:**
```json
{
  "success": true,
  "data": {
    "month": "2026-10",
    "baseCurrency": "USD",
    "converted": true,
    "items": [
      {
        "budgetId": "…",
        "categoryId": null,
        "categoryName": null,
        "period": "MONTHLY",
        "budgetAmount": 1000,
        "spent": 239.13,
        "remaining": 760.87,
        "percentage": 23.91,
        "overBudget": false,
        "applied": true
      }
    ]
  },
  "timestamp": "2026-10-10T08:00:00.000Z"
}
```

---

### Cloud Backups

The backup workflow follows a secure three-step lifecycle:
1. **Initiate**: Client requests an upload URL. Server generates a signed presigned PUT URL and registers a `PENDING` record.
2. **Upload**: Client streams the encrypted SQLite database directly to S3 via HTTP PUT.
3. **Complete**: Client notifies the server. Server verifies the object exists in S3, inspects byte size, updates status to `COMPLETED`, and prunes older backups beyond `MAX_BACKUPS_PER_USER`.

#### `POST /v1/backups/initiate`
Initiate a backup session.
```powershell
curl.exe -i -X POST http://localhost:3000/v1/backups/initiate `
  -H "Authorization: Bearer <accessToken>" `
  -H "Content-Type: application/json" `
  -d '{
    "appVersion": "1.4.0",
    "schemaVersion": 2,
    "deviceModel": "Pixel 8 Pro",
    "osVersion": "Android 15",
    "checksumSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "fileSizeBytes": 1048576,
    "metadata": { "notesCount": 128 }
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "backupId": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
    "sequenceNumber": 1,
    "uploadUrl": "http://localhost:9000/pluto-backups/backups/user-id/f81d4fae...snap?X-Amz-Signature=...",
    "expiresAt": "2026-10-09T04:45:00.000Z"
  }
}
```

#### Uploading File to S3
Upload the file payload directly to `uploadUrl`:
```powershell
curl.exe -i -X PUT "<uploadUrl>" `
  -H "Content-Type: application/octet-stream" `
  --data-binary "@backup.sqlite"
```

#### `POST /v1/backups/:id/complete`
Finalize backup status.
```powershell
curl.exe -i -X POST http://localhost:3000/v1/backups/f81d4fae-7dec-11d0-a765-00a0c91e6bf6/complete `
  -H "Authorization: Bearer <accessToken>"
```

#### `GET /v1/backups`
List completed backups for authenticated user with pagination.
```powershell
curl.exe -i -H "Authorization: Bearer <accessToken>" "http://localhost:3000/v1/backups?page=1&limit=10"
```

#### `GET /v1/backups/:id/download`
Generate presigned download URL for restoring data onto a device.
```powershell
curl.exe -i -H "Authorization: Bearer <accessToken>" "http://localhost:3000/v1/backups/f81d4fae-7dec-11d0-a765-00a0c91e6bf6/download"
```

#### `DELETE /v1/backups/:id`
Delete backup metadata and underlying S3 object.
```powershell
curl.exe -i -X DELETE -H "Authorization: Bearer <accessToken>" "http://localhost:3000/v1/backups/f81d4fae-7dec-11d0-a765-00a0c91e6bf6"
```

---

### Admin (role-gated)

All `/v1/admin/*` endpoints require an access token for a user whose `role` is `ADMIN`
(`403 Forbidden` otherwise). Users listed in the `ADMIN_EMAILS` environment variable are
promoted to `ADMIN` automatically on their next Google sign-in.

#### `GET /v1/admin/stats`
Dashboard aggregates: total users, completed backups, storage bytes, active sessions, latest published rate snapshot.
```powershell
curl.exe -i -H "Authorization: Bearer <adminToken>" http://localhost:3000/v1/admin/stats
```

#### `GET /v1/admin/locks`
Distributed scheduler locks (rates sync, backup cleanup) and their expiry.

#### `GET /v1/admin/rates`
Rate snapshot history (newest first, `?limit=` up to 100) — doubles as sync/provider health history.

#### `GET /v1/admin/users`
Paginated user list with backup/session counts; `?page=&limit=&search=` (case-insensitive e-mail/name search).

#### `GET /v1/admin/users/:id`
User detail: profile, 20 newest sessions (token hashes excluded), 20 newest backups.

#### `DELETE /v1/admin/users/:id`
Deletes another user's account, backups (including storage objects), and sessions.
Self-deletion is rejected (`400`).

#### `DELETE /v1/admin/users/:id/sessions/:sessionId`
Revokes a single refresh session (signs that device out).

#### `GET /v1/admin/backups`
Paginated backups across all users; `?page=&limit=&status=COMPLETED|PENDING|FAILED|DELETED`.

#### `DELETE /v1/admin/backups/:id`
Deletes any user's backup (storage object + metadata).

---

## Mobile Client Integration Runbook

### Android Implementation Guidelines

1. **Authentication Token Management**:
   - Store `accessToken` in memory or encrypted memory cache.
   - Store `refreshToken` securely in Android `EncryptedSharedPreferences` / Android Keystore.
   - When an API call returns `401 Unauthorized`, intercept the request, call `/v1/auth/refresh`, update the tokens, and replay the original request.
   - If the refresh call itself returns `401`, wipe local tokens and prompt the user to sign in again.

2. **Exchange Rates Caching**:
   - Store the `ETag` HTTP response header from `/v1/rates/latest` in local preferences.
   - When synchronizing rates, send `If-None-Match: <cached-etag>`.
   - On `304 Not Modified`, preserve existing cached rates without redundant parsing.

3. **Database Cloud Backup & Restore**:
   - **Pre-Upload**: Run `PRAGMA wal_checkpoint(TRUNCATE)` or use Room database checkpointing to guarantee SQLite database integrity before reading bytes.
   - **Compute SHA-256**: Calculate SHA-256 hash locally and pass it to `/v1/backups/initiate`.
   - **Chunked / Streaming Upload**: Use OkHttp `RequestBody` with streaming to upload directly to the presigned PUT URL.
   - **Post-Upload**: Immediately call `/v1/backups/:id/complete`.

---

## Testing & Quality Assurance

The repository includes strict test suites with complete mocks for external services:

```powershell
# Run ESLint validation
npm run lint

# Run type check and TypeScript compilation
npm run build

# Run unit tests
npm run test

# Run end-to-end (E2E) integration tests
npm run test:e2e

# Run tests with code coverage report
npm run test:cov
```

All test suites execute without dependencies on running databases or external network services.

---

## Production Deployment

### 1. Build Production Docker Image
```powershell
docker build -t pluto-server:latest .
```

### 2. Run Container in Production
```powershell
docker run -d `
  --name pluto-server `
  -p 3000:3000 `
  --env-file .env.production `
  --restart unless-stopped `
  pluto-server:latest
```

### 3. Graceful Shutdown & Health Probes
The container handles `SIGTERM` and `SIGINT` signals, closing active HTTP connections, S3 client sessions, and database connections gracefully.

Kubernetes configuration probes:
- **Liveness Probe**: `GET /v1/health` (initialDelaySeconds: 15, periodSeconds: 20)
- **Readiness Probe**: `GET /v1/health` (initialDelaySeconds: 5, periodSeconds: 10)

---

## License

Private and confidential. All rights reserved.
