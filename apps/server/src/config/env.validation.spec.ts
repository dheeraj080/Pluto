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
      OBJECT_STORAGE_ACCESS_KEY_ID: 'real-access-key',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'real-secret-key-123',
    };

    expect(() => validateEnvironment(prodConfigWithoutGoogleClient)).toThrow(
      'GOOGLE_ALLOWED_CLIENT_IDS must be explicitly configured',
    );
  });

  it('should accept valid production configuration with strong secrets', () => {
    const validProdConfig = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/pluto_db',
      JWT_ACCESS_SECRET: 'production_super_secure_secret_key_exceeding_32_chars',
      GOOGLE_ALLOWED_CLIENT_IDS: 'valid-client-id.apps.googleusercontent.com',
      OBJECT_STORAGE_ACCESS_KEY_ID: 'prod-s3-key',
      OBJECT_STORAGE_SECRET_ACCESS_KEY: 'prod-s3-secret',
    };

    const result = validateEnvironment(validProdConfig);
    expect(result.NODE_ENV).toBe('production');
  });
});
