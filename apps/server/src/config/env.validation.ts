import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().min(1).max(65535).default(3000),
    API_PREFIX: z.string().default('v1'),
    CORS_ORIGIN: z.string().default('*'),

    TRUST_PROXY: z.preprocess(
      (val) => val === 'true' || val === true || val === '1' || val === 1,
      z.boolean().default(true),
    ),

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
    ENABLE_DEV_AUTH: z.preprocess(
      (val) => val === 'true' || val === true || val === '1' || val === 1,
      z.boolean().default(false),
    ),

    // Rate Limiting (Throttler)
    THROTTLE_TTL: z.coerce.number().default(60),
    THROTTLE_LIMIT: z.coerce.number().default(100),
    AUTH_THROTTLE_LIMIT: z.coerce.number().default(20),

    // Exchange Rates
    EXCHANGE_RATE_PROVIDER: z
      .enum(['frankfurter', 'exchangerate_host', 'mock'])
      .default('frankfurter'),
    EXCHANGE_RATE_API_KEY: z.string().optional().default(''),
    EXCHANGE_RATE_BASE_URL: z.string().default('https://api.frankfurter.dev/v1'),
    EXCHANGE_RATE_BASE_CURRENCY: z.string().default('USD'),
    SUPPORTED_CURRENCIES: z.string().default('USD,EUR,GBP,INR,JPY,CNY,CAD,AUD,CHF,SGD,NZD'),
    EXCHANGE_RATE_SCHEDULE: z.string().default('0 4 * * *'), // Default 4 AM UTC daily

    // Object Storage (AWS S3 or S3-compatible like MinIO / LocalStack / Cloudflare R2)
    OBJECT_STORAGE_ENDPOINT: z.string().optional(),
    OBJECT_STORAGE_REGION: z.string().default('us-east-1'),
    OBJECT_STORAGE_BUCKET: z.string().default('pluto-backups'),
    OBJECT_STORAGE_ACCESS_KEY_ID: z.string().default('minioadmin'),
    OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
    OBJECT_STORAGE_FORCE_PATH_STYLE: z.preprocess(
      (val) => val === 'true' || val === true || val === '1' || val === 1,
      z.boolean().default(true),
    ),

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

      if (
        data.OBJECT_STORAGE_ACCESS_KEY_ID === 'minioadmin' ||
        data.OBJECT_STORAGE_SECRET_ACCESS_KEY === 'minioadmin'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['OBJECT_STORAGE_ACCESS_KEY_ID'],
          message:
            'In production, default minioadmin credentials must not be used for object storage',
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
