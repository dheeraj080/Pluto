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

/**
 * Google Play Services' status code for "no OAuth client matches this app".
 *
 * The native module stringifies the numeric status (`ErrorDto.code`), so on the
 * JS side a `DEVELOPER_ERROR` arrives as `code === '10'`. The message Google
 * attaches — "Developer console is not set up correctly" — points at the
 * Console without naming either of the two values that are actually wrong, so
 * it is worth translating.
 */
const DEVELOPER_ERROR_CODE = '10';

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

  const sdk = await loadSdk();

  // Updates Google Play Services when it is too old to sign in; a no-op on iOS.
  await sdk.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // A dismissal is a *response* (`{ type: 'cancelled' }`), not a rejection, so
  // anything thrown here is a real failure worth explaining.
  const response = await sdk.GoogleSignin.signIn().catch((cause: unknown) => {
    throw explainSignInFailure(cause, sdk);
  });
  if (response.type !== 'success') return null;

  const idToken = response.data.idToken;
  if (!idToken) throw new Error('Google did not return an ID token.');
  return idToken;
}

/**
 * Turns the one failure whose message cannot be acted on into instructions.
 *
 * `DEVELOPER_ERROR` means Google could not match a registered Android OAuth
 * client to this build's package name and signing SHA-1 — a Console mismatch,
 * not a broken app. There is nothing to fix in JS, so the best this can do is
 * say which pair to compare and how to read it off the APK that is installed.
 */
function explainSignInFailure(cause: unknown, sdk: Sdk): Error {
  if (sdk.isErrorWithCode(cause) && cause.code === DEVELOPER_ERROR_CODE) {
    return new Error(
      'Google could not match this build to an Android OAuth client ' +
        '(DEVELOPER_ERROR). Register this build\'s package name and signing SHA-1 ' +
        'on an *Android* OAuth client in the same Google Cloud project as the web ' +
        'client, then reinstall. Read the pair from the APK with ' +
        '`npm run apk:fingerprint --workspace pluto-mobile -- <path-to.apk>`.',
    );
  }
  return cause instanceof Error ? cause : new Error(String(cause));
}
