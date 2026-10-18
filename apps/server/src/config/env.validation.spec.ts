import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  it('should validate valid environment configuration with defaults', () => {
    const validConfig = {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pluto_db',
      JWT_ACCESS_SECRET: 'development_jwt_access_secret_min_32_characters_long_12345',
    };

    const result = validateEnvironment(validConfig);

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.DATABASE_URL).toBe(validConfig.DATABASE_URL);
    expect(result.API_PREFIX).toBe('v1');
  });

  it('should throw an error when DATABASE_URL is missing', () => {
    const invalidConfig = {};

    expect(() => validateEnvironment(invalidConfig)).toThrow(
      'Environment variable validation failed',
    );
  });

  it('should coerce PORT string to number and validate range', () => {
    const validConfig = {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pluto_db',
      JWT_ACCESS_SECRET: 'development_jwt_access_secret_min_32_characters_long_12345',
      PORT: '8080',
    };

    const result = validateEnvironment(validConfig);
    expect(result.PORT).toBe(8080);
  });

  it('should reject missing JWT secrets in production', () => {
    const prodConfigWithDefaultSecret = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pluto_db',
      GOOGLE_ALLOWED_CLIENT_IDS: 'client-id-123.apps.googleusercontent.com',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'real-access-key',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'real-secret-key-123',
    };

    expect(() => validateEnvironment(prodConfigWithDefaultSecret)).toThrow();
  });

  it('should reject weak JWT secrets in production', () => {
    const prodConfigWithWeakSecret = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pluto_db',
      JWT_ACCESS_SECRET: 'short',
      GOOGLE_ALLOWED_CLIENT_IDS: 'client-id-123.apps.googleusercontent.com',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'real-access-key',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'real-secret-key-123',
    };

    expect(() => validateEnvironment(prodConfigWithWeakSecret)).toThrow(
      'JWT_ACCESS_SECRET must be explicitly provided and at least 32 characters long',
    );
  });

  it('should reject empty GOOGLE_ALLOWED_CLIENT_IDS in production', () => {
    const prodConfigWithoutGoogleClient = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pluto_db',
      JWT_ACCESS_SECRET: 'production_super_secure_secret_key_exceeding_32_chars',
      GOOGLE_ALLOWED_CLIENT_IDS: '',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'real-access-key',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'real-secret-key-123',
    };

    expect(() => validateEnvironment(prodConfigWithoutGoogleClient)).toThrow(
      'GOOGLE_ALLOWED_CLIENT_IDS must be explicitly configured',
    );
  });

  it('should reject blank entries in GOOGLE_ALLOWED_CLIENT_IDS in production', () => {
    const prodConfigWithBlankEntries = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pluto_db',
      JWT_ACCESS_SECRET: 'production_super_secure_secret_key_exceeding_32_chars',
      GOOGLE_ALLOWED_CLIENT_IDS: ' , , ',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'real-access-key',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'real-secret-key-123',
    };

    expect(() => validateEnvironment(prodConfigWithBlankEntries)).toThrow();
  });

  it('should accept multiple valid Google client IDs in production', () => {
    const validProdConfig = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pluto_db',
      JWT_ACCESS_SECRET: 'production_super_secure_secret_key_exceeding_32_chars',
      CORS_ORIGIN: 'https://app.example.com',
      GOOGLE_ALLOWED_CLIENT_IDS:
        'client1.apps.googleusercontent.com, client2.apps.googleusercontent.com',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'prod-s3-key',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'prod-s3-secret',
    };

    const result = validateEnvironment(validProdConfig);
    expect(result.NODE_ENV).toBe('production');
  });

  it('should accept valid production configuration with strong secrets', () => {
    const validProdConfig = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pluto_db',
      JWT_ACCESS_SECRET: 'production_super_secure_secret_key_exceeding_32_chars',
      CORS_ORIGIN: 'https://app.example.com,https://example.com',
      GOOGLE_ALLOWED_CLIENT_IDS: 'valid-client-id.apps.googleusercontent.com',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'prod-s3-key',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'prod-s3-secret',
    };

    const result = validateEnvironment(validProdConfig);
    expect(result.NODE_ENV).toBe('production');
  });

  it('should reject a wildcard CORS origin in production', () => {
    const prodConfigWithWildcardCors = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pluto_db',
      JWT_ACCESS_SECRET: 'production_super_secure_secret_key_exceeding_32_chars',
      CORS_ORIGIN: '*',
      GOOGLE_ALLOWED_CLIENT_IDS: 'valid-client-id.apps.googleusercontent.com',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'prod-s3-key',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'prod-s3-secret',
    };

    expect(() => validateEnvironment(prodConfigWithWildcardCors)).toThrow(
      'CORS_ORIGIN must list explicit origins',
    );
  });

  it('should allow placeholder storage credentials in production when object storage is disabled', () => {
    const prodConfigWithoutStorage = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pluto_db',
      JWT_ACCESS_SECRET: 'production_super_secure_secret_key_exceeding_32_chars',
      CORS_ORIGIN: 'https://app.example.com',
      GOOGLE_ALLOWED_CLIENT_IDS: 'valid-client-id.apps.googleusercontent.com',
      OBJECT_STORAGE_ENABLED: 'false',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'minioadmin',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'minioadmin',
    };

    const result = validateEnvironment(prodConfigWithoutStorage);
    expect(result.OBJECT_STORAGE_ENABLED).toBe(false);
  });

  it('should still reject minioadmin credentials in production when object storage is enabled', () => {
    const prodConfigWithDefaultStorage = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pluto_db',
      JWT_ACCESS_SECRET: 'production_super_secure_secret_key_exceeding_32_chars',
      GOOGLE_ALLOWED_CLIENT_IDS: 'valid-client-id.apps.googleusercontent.com',
      OBJECT_STORAGE_ENABLED: 'true',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'minioadmin',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'minioadmin',
    };

    expect(() => validateEnvironment(prodConfigWithDefaultStorage)).toThrow(
      'default minioadmin credentials must not be used',
    );
  });

  describe('boolean coercion', () => {
    const baseConfig = {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pluto_db',
      JWT_ACCESS_SECRET: 'development_jwt_access_secret_min_32_characters_long_12345',
    };

    it('should honour documented defaults when boolean variables are unset', () => {
      const result = validateEnvironment(baseConfig);

      expect(result.TRUST_PROXY).toBe(true);
      expect(result.ENABLE_DEV_AUTH).toBe(false);
      // Storage is opt-in: production S3 usually needs a billing account.
      expect(result.OBJECT_STORAGE_ENABLED).toBe(false);
      expect(result.OBJECT_STORAGE_FORCE_PATH_STYLE).toBe(true);
    });

    it('should treat blank values as unset and fall back to the defaults', () => {
      const result = validateEnvironment({
        ...baseConfig,
        TRUST_PROXY: '',
        OBJECT_STORAGE_ENABLED: '',
      });

      expect(result.TRUST_PROXY).toBe(true);
      expect(result.OBJECT_STORAGE_ENABLED).toBe(false);
    });

    it('should parse explicit false-ish values', () => {
      const result = validateEnvironment({
        ...baseConfig,
        TRUST_PROXY: 'false',
        ENABLE_DEV_AUTH: '0',
        OBJECT_STORAGE_ENABLED: 'false',
        OBJECT_STORAGE_FORCE_PATH_STYLE: 'no',
      });

      expect(result.TRUST_PROXY).toBe(false);
      expect(result.ENABLE_DEV_AUTH).toBe(false);
      expect(result.OBJECT_STORAGE_ENABLED).toBe(false);
      expect(result.OBJECT_STORAGE_FORCE_PATH_STYLE).toBe(false);
    });

    it('should parse explicit true-ish values', () => {
      const result = validateEnvironment({
        ...baseConfig,
        TRUST_PROXY: '1',
        ENABLE_DEV_AUTH: 'true',
        OBJECT_STORAGE_ENABLED: 'TRUE',
      });

      expect(result.TRUST_PROXY).toBe(true);
      expect(result.ENABLE_DEV_AUTH).toBe(true);
      expect(result.OBJECT_STORAGE_ENABLED).toBe(true);
    });
  });
});
