/**
 * Base URL of the Pluto API, including the `/v1` prefix.
 *
 * `EXPO_PUBLIC_*` variables are inlined by Metro at build time (see
 * `.env.example` for the per-target values).
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

/**
 * Google OAuth *web* client ID — the audience Google stamps onto the ID token.
 *
 * pluto-server verifies that audience against `GOOGLE_ALLOWED_CLIENT_IDS`, so the
 * two sides must agree on this value or `/auth/google` rejects every token. The
 * native SDK also requires it to start the flow on Android.
 */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

/** Google OAuth *iOS* client ID. Only needed for iOS builds. */
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
