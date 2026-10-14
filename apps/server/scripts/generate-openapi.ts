/**
 * Writes a committed OpenAPI snapshot to `apps/server/openapi.json`.
 *
 * Why a script instead of "curl the running server":
 *   - `packages/api-client` must regenerate in CI, where no database is
 *     running. Document construction never touches the database, so we only
 *     need env validation to pass — hence the throwaway defaults below.
 *   - The `.env` lookups happen at module-evaluation time, so the defaults are
 *     set *before* `AppModule` is imported (dynamic import inside `main`).
 *
 * Run with: `npm run openapi:generate` from `apps/server`.
 */

async function main(): Promise<void> {
  // Satisfy env validation without a real database or secret. Never used to
  // connect: building the Swagger document only reads route decorators.
  process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/pluto_db';
  process.env.JWT_ACCESS_SECRET ??= 'openapi-generation-placeholder-min-32-chars';

  const { NestFactory } = await import('@nestjs/core');
  const { SwaggerModule } = await import('@nestjs/swagger');
  const { writeFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const { AppModule } = await import('../src/app.module');
  const { buildSwaggerDocumentConfig } = await import('../src/config/swagger.config');

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix(process.env.API_PREFIX ?? 'v1');

  const document = SwaggerModule.createDocument(app, buildSwaggerDocumentConfig());

  const outFile = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(outFile, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
  // eslint-disable-next-line no-console
  console.log(`OpenAPI document written to ${outFile}`);
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Failed to generate the OpenAPI document:', error);
  process.exit(1);
});
