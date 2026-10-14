/**
 * Base URL of the Pluto API, including the `/v1` prefix.
 *
 * `EXPO_PUBLIC_*` variables are inlined by Metro at build time (see
 * `.env.example` for the per-target values).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
