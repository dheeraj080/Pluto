/**
 * Shared ISO 4217 registry — re-exported from its single source of truth in
 * `@pluto/domain` (`packages/domain/src/currencies.ts`), which the mobile app
 * also uses to seed its offline `currencies` table. All existing server
 * imports keep working through this path.
 *
 * The reach is deliberately the *relative* file rather than the package name:
 *
 * - `nest build` compiles every file in the program into `apps/server/dist`.
 *   A relative import pulls the registry into that tree, where the emitted
 *   `require('../../../../../packages/domain/src/currencies')` resolves
 *   against the mirrored `dist/packages/domain/src/currencies.js` at runtime.
 *   Importing `@pluto/domain` by package name instead would leave a bare
 *   `require('@pluto/domain')` whose package `main` points at TypeScript
 *   source, which plain Node cannot load in production.
 * - A consequence of the file joining the program: tsc infers the common root
 *   as the repo root, so output lands in `dist/apps/server/src/...` rather
 *   than `dist/`. `start:prod`, the Dockerfile CMD and render.yaml all
 *   address that path — keep them in sync if this ever changes. The Nest CLI
 *   looks for its entry at `dist/<sourceRoot>/main`, which that layout does
 *   not satisfy, so the `nest start` scripts pass
 *   `--sourceRoot apps/server/src` to point the CLI at the real entry.
 */
export * from '../../../../../packages/domain/src/currencies';
