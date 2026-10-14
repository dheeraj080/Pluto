import { DocumentBuilder, type OpenAPIObject } from '@nestjs/swagger';

/**
 * Single source of truth for the OpenAPI document metadata.
 *
 * Extracted from `main.ts` so the document can be built without booting the
 * HTTP server — see `apps/server/scripts/generate-openapi.ts`, which feeds the
 * client generator in `packages/api-client`.
 */
export function buildSwaggerDocumentConfig(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle('Pluto Server API')
    .setDescription(
      'REST API backend for Android application supporting Google Sign-In, exchange rate synchronization, and cloud backups.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT access token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Health', 'System health checks and telemetry')
    .addTag('Auth', 'Authentication and session management')
    .addTag('Users', 'User profile management')
    .addTag('Rates', 'Exchange rate queries and synchronization')
    .addTag('Backups', 'Cloud backup upload, download, and metadata')
    .addTag('Expenses', 'Expense tracking, categories, budgets, and spending reports')
    .addTag('Admin', 'Administrator-only operations (requires ADMIN role)')
    .build();
}
