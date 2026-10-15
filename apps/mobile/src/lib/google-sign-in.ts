/**
 * Google Sign-In, native builds.
 *
 * The SDK is a *native* module, so it is imported lazily rather than at the top
 * of the file: Expo Go ships no such module, and a static import would take the
 * whole sign-in screen down with it at launch. Loading it inside the call means
 * an Expo Go session still renders the screen and gets an explainable error.
 *
 * `webClientId` is the *web* OAuth client, not the Android one. Google stamps it
 * on the ID token as the audience, and pluto-server checks that audience against
 * `GOOGLE_ALLOWED_CLIENT_IDS` — so a mismatch here is the usual cause of a 401
 * from `/auth/google`.
 *
 * The web target uses `google-sign-in.web.ts` instead; Metro picks it by
 * platform, which keeps the native SDK out of the web bundle.
 */

import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from './env';

type Sdk = typeof import('@react-native-google-signin/google-signin');

let sdkPromise: Promise<Sdk> | null = null;

/** Imports the SDK once, configuring it on first use. */
function loadSdk(): Promise<Sdk> {
  sdkPromise ??= import('@react-native-google-signin/google-signin')
    .then((sdk) => {
      sdk.GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        // Only meaningful on iOS; omitted so the Android path stays untouched.
        ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
      });
      return sdk;
    })
    .catch(() => {
      // Reset so a later attempt (e.g. after installing a dev build) can retry.
      sdkPromise = null;
      throw new Error(
        'Google Sign-In needs a development build — it cannot run in Expo Go.',
      );
    });
  return sdkPromise;
}

/**
 * Runs the native Google flow and returns the ID token to exchange with the API,
 * or `null` if the user dismissed the account sheet.
 */
export async function requestGoogleIdToken(): Promise<string | null> {
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error(
      'Google Sign-In is not configured: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing.',
    );
  }

  const { GoogleSignin } = await loadSdk();

  // Updates Google Play Services when it is too old to sign in; a no-op on iOS.
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();
  if (response.type !== 'success') return null;

  const idToken = response.data.idToken;
  if (!idToken) throw new Error('Google did not return an ID token.');
  return idToken;
}
