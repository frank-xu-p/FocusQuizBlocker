import Constants from 'expo-constants';

/** This app's own package — never blockable, never watched. */
export const OWN_PACKAGE = 'com.frankxu.focusquiz';

/**
 * Packages that can never be blocked (hidden from the blocklist UI):
 * phone, SMS, contacts, system settings. Launchers are detected natively
 * (InstalledApp.isLauncher) and hidden the same way.
 */
export const ALWAYS_WHITELIST = new Set<string>([
  OWN_PACKAGE,
  'com.google.android.dialer',
  'com.samsung.android.dialer',
  'com.android.dialer',
  'com.google.android.apps.messaging',
  'com.samsung.android.messaging',
  'com.android.mms',
  'com.google.android.contacts',
  'com.samsung.android.contacts',
  'com.android.contacts',
  'com.android.settings',
]);

/** Suggested distractors: shown in their own section, OFF by default. */
export const SUGGESTED_APPS: { packageName: string; label: string }[] = [
  { packageName: 'com.instagram.android', label: 'Instagram' },
  { packageName: 'com.zhiliaoapp.musically', label: 'TikTok' },
  { packageName: 'com.twitter.android', label: 'X (Twitter)' },
  { packageName: 'com.google.android.youtube', label: 'YouTube' },
  { packageName: 'com.reddit.frontpage', label: 'Reddit' },
  { packageName: 'com.facebook.katana', label: 'Facebook' },
  { packageName: 'com.snapchat.android', label: 'Snapchat' },
  { packageName: 'com.pinterest', label: 'Pinterest' },
  { packageName: 'com.instagram.barcelona', label: 'Threads' },
  { packageName: 'com.netflix.mediaclient', label: 'Netflix' },
];

export const GRACE_PRESETS = [5, 15, 30, 60];

/** Server URL baked in at build time via app.json extra.serverUrl. */
export function defaultServerUrl(): string {
  const extra = Constants.expoConfig?.extra as { serverUrl?: string } | undefined;
  return extra?.serverUrl && !extra.serverUrl.includes('PLACEHOLDER')
    ? extra.serverUrl
    : '';
}
