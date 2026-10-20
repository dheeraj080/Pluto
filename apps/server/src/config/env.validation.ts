import { z } from 'zod';
import { DEFAULT_SUPPORTED_CURRENCIES } from '../common/currency/currency.registry';

/**
 * Environment variables arrive as strings, or are absent entirely. Note that
 * `z.preprocess(fn, z.boolean().default(x))` cannot be used here: the
 * preprocessor runs first and turns `undefined` into `false`, so the default
 * never applies. This helper preserves the declared default for unset/blank
 * values and only coerces real input.
 */
const envBoolean = (defaultValue: boolean) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return defaultValue;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    if (typeof val !== 'string') return false; // anything else is never true-ish
    const normalized = val.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }, z.boolean());

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().min(1).max(65535).default(3000),
    API_PREFIX: z.string().default('v1'),
    CORS_ORIGIN: z.string().default('*'),

    TRUST_PROXY: envBoolean(true),

    // Database
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // Auth / Google / JWT
    GOOGLE_ALLOWED_CLIENT_IDS: z.string().default(''),
    JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
    ACCESS_TOKEN_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
    // Comma-separated list of e-mail addresses promoted to ADMIN on sign-in
    ADMIN_EMAILS: z.string().default(''),
    // Dev-only mock sign-in (POST /v1/auth/dev-login). Hard-refused in production.
    ENABLE_DEV_AUTH: envBoolean(false),

    // Rate Limiting (Throttler)
    THROTTLE_TTL: z.coerce.number().default(60),
    THROTTLE_LIMIT: z.coerce.number().default(100),

    // Exchange Rates
    EXCHANGE_RATE_PROVIDER: z
      .enum(['frankfurter', 'exchangerate_host', 'mock'])
      .default('frankfurter'),
    EXCHANGE_RATE_API_KEY: z.string().optional().default(''),
    // Frankfurter v2 blends ~148 currencies from 104 sources. v1 was ECB-only.
    EXCHANGE_RATE_BASE_URL: z.string().default('https://api.frankfurter.dev/v2'),
    // Default reporting currency requested by clients when `?base=` is omitted.
    EXCHANGE_RATE_BASE_CURRENCY: z.string().default('USD'),
    // Base snapshots are *stored* against this single canonical currency; every
    // other reporting base is derived from it by dividing cross rates. Must be
    // one the provider quotes (USD is always quoted).
    EXCHANGE_RATE_CANONICAL_BASE: z.string().default('USD'),
    // The reporting/conversion universe. Defaults to the whole registry, which
    // Frankfurter v2 almost entirely quotes; pin a narrower list if your
    // provider is smaller.
    SUPPORTED_CURRENCIES: z.string().default(DEFAULT_SUPPORTED_CURRENCIES.join(',')),
    EXCHANGE_RATE_SCHEDULE: z.string().default('0 4 * * *'), // Default 4 AM UTC daily
    // Shared secret for POST /v1/rates/sync — the external trigger used where the
    // in-process cron cannot be relied on (an idle/spun-down instance runs no
    // crons). Empty disables the route entirely (it 404s), so an unconfigured
    // deployment exposes nothing.
    RATES_SYNC_TOKEN: z.string().default(''),
    // Maximum age (in days) of a snapshot before a transaction-date rate is
    // relabeled from `historical` to a clearly-labeled `estimate`.
    EXCHANGE_RATE_HISTORICAL_LOOKBACK_DAYS: z.coerce.number().int().min(0).max(365).default(10),

    // Object Storage (AWS S3 or S3-compatible like MinIO / LocalStack / Cloudflare R2)
    // Opt-in: production-grade S3 normally needs a billing account, so the
    // default is off. When false the server still boots and every non-storage
    // feature works; the backup endpoints report 503 Service Unavailable
    // instead of failing obscurely. (No-card free alternative: Filebase.)
    OBJECT_STORAGE_ENABLED: envBoolean(false),
    OBJECT_STORAGE_ENDPOINT: z.string().optional(),
    OBJECT_STORAGE_REGION: z.string().default('us-east-1'),
    OBJECT_STORAGE_BUCKET: z.string().default('pluto-backups'),
    OBJECT_STORAGE_ACCESS_KEY_ID: z.string().default('minioadmin'),
    OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
    OBJECT_STORAGE_FORCE_PATH_STYLE: envBoolean(true),

    // Backups
    BACKUP_MAX_SIZE_BYTES: z.coerce.number().default(52428800), // 50 MB
    BACKUP_RETENTION_COUNT: z.coerce.number().default(5), // Retain latest 5 completed backups
    BACKUP_UPLOAD_URL_TTL: z.coerce.number().default(900), // 15 mins (seconds)
    BACKUP_DOWNLOAD_URL_TTL: z.coerce.number().default(900), // 15 mins (seconds)
    BACKUP_PENDING_EXPIRY_HOURS: z.coerce.number().default(24),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (
        !data.JWT_ACCESS_SECRET ||
        data.JWT_ACCESS_SECRET === 'development_jwt_access_secret_min_32_characters_long_12345' ||
        data.JWT_ACCESS_SECRET.length < 32
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_ACCESS_SECRET'],
          message:
            'In production, JWT_ACCESS_SECRET must be explicitly provided and at least 32 characters long',
        });
      }

      const clientIds = data.GOOGLE_ALLOWED_CLIENT_IDS.split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      if (clientIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_ALLOWED_CLIENT_IDS'],
          message:
            'In production, GOOGLE_ALLOWED_CLIENT_IDS must be explicitly configured with at least one non-empty client ID',
        });
      }

      // Only enforce real credentials when storage is actually in use: a
      // deployment that has not wired up a bucket runs with
      // OBJECT_STORAGE_ENABLED=false and leaves the placeholders in place.
      if (
        data.OBJECT_STORAGE_ENABLED &&
        (data.OBJECT_STORAGE_ACCESS_KEY_ID === 'minioadmin' ||
          data.OBJECT_STORAGE_SECRET_ACCESS_KEY === 'minioadmin')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['OBJECT_STORAGE_ACCESS_KEY_ID'],
          message:
            'In production, default minioadmin credentials must not be used for object storage',
        });
      }

      // A wildcard origin would let any site call the API with the user's
      // browser. Production must name its origins explicitly.
      if (
        data.CORS_ORIGIN.split(',').some((origin) => origin.trim() === '*' || origin.includes('*'))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGIN'],
          message:
            'In production, CORS_ORIGIN must list explicit origins; a wildcard ("*") is not allowed',
        });
      }

      // The mock sign-in bypasses Google entirely, so it must never be
      // reachable in production. Refusing to boot is safer than silently
      // ignoring the flag.
      if (data.ENABLE_DEV_AUTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ENABLE_DEV_AUTH'],
          message: 'ENABLE_DEV_AUTH must not be enabled when NODE_ENV=production',
        });
      }
    }
  });

export type EnvironmentVariables = z.infer<typeof envSchema>;

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const errorMessages = parsed.error.issues
      .map((issue) => ` - [${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment variable validation failed:\n${errorMessages}`);
  }

  return parsed.data;
}
