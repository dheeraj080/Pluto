/**
 * Google Sign-In, web target.
 *
 * The mobile app's web output is a development preview — the real browser client
 * is `apps/web`. Selecting the native Google SDK here would pull a native module
 * into the web bundle, so this build simply says where sign-in actually lives.
 *
 * Metro resolves this file instead of `google-sign-in.ts` when targeting web, so
 * the two must keep the same exported signature.
 */
export async function requestGoogleIdToken(): Promise<string | null> {
  throw new Error(
    'Google Sign-In is not available in the web preview. Use the web app, or run the mobile app on a device.',
  );
}
