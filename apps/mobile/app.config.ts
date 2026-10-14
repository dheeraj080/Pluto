import type { ExpoConfig } from 'expo/config';

/**
 * Expo app configuration.
 *
 * Kept as a `.ts` config (rather than `app.json`) so the same file can read
 * per-environment values — currently just the API base URL. `EXPO_PUBLIC_*`
 * variables are inlined by Metro at build time, so they are also readable
 * directly from app code via `process.env.EXPO_PUBLIC_API_URL`.
 *
 * The Android package / iOS bundle identifier must match the Android OAuth
 * client registered in Google Cloud Console, or Google Sign-In fails with
 * `DEVELOPER_ERROR`.
 */
const config: ExpoConfig = {
  name: 'Pluto',
  slug: 'pluto',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'pluto',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: 'com.pluto.app',
    supportsTablet: true,
  },
  android: {
    package: 'com.pluto.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
