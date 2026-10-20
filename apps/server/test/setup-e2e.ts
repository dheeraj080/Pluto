/**
 * Runs as a jest `setupFiles` entry — before the e2e spec imports anything.
 *
 * This matters because AppModule's ConfigModule.forRoot evaluates its env
 * loading the moment `AppModule` is imported (static import hoisting), so a
 * flag pinned from inside the spec file is too late. Setting it here guarantees
 * a locally enabled ENABLE_DEV_AUTH (.env / .env.local, used for manual mock
 * sign-in) can never leak into the e2e suite.
 */
process.env.ENABLE_DEV_AUTH = 'false';

/**
 * Enables the `POST /v1/rates/sync` trigger for the e2e suite.
 *
 * Same import-time reason as above: `RatesSyncGuard` reads `RATES_SYNC_TOKEN`
 * through the validated config that `ConfigModule.forRoot` builds when
 * `AppModule` is imported, so setting it in the spec's `beforeAll` would be too
 * late and the route would 404. The value must match `RATES_SYNC_TOKEN` in
 * `app.e2e-spec.ts`.
 */
process.env.RATES_SYNC_TOKEN = 'e2e-rates-sync-token-0123456789abcdef';
