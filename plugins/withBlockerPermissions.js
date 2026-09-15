/**
 * FocusQuizBlocker config plugin.
 *
 * Adds the Android permissions and the foreground-service declaration the
 * quiz blocker needs:
 *  - SYSTEM_ALERT_WINDOW   (draw the quiz overlay over other apps)
 *  - PACKAGE_USAGE_STATS   (detect the foreground app; granted in Settings)
 *  - FOREGROUND_SERVICE + FOREGROUND_SERVICE_SPECIAL_USE (keep the watcher alive)
 *  - QUERY_ALL_PACKAGES    (list installed apps for the blocklist UI;
 *                           side-loaded only — Play Store would require a declaration)
 *
 * The WatcherService is declared with foregroundServiceType="specialUse" plus
 * the Android 14+ PROPERTY_SPECIAL_USE_FGS_SUBTYPE property describing the use.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const WATCHER_SERVICE = 'com.frankxu.focusquiz.watcher.WatcherService';

const PERMISSIONS = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.PACKAGE_USAGE_STATS',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.QUERY_ALL_PACKAGES',
];

function ensurePermissions(manifest) {
  manifest['uses-permission'] = manifest['uses-permission'] || [];
  const list = manifest['uses-permission'];
  for (const name of PERMISSIONS) {
    if (!list.some((e) => e && e.$ && e.$['android:name'] === name)) {
      list.push({ $: { 'android:name': name } });
    }
  }
}

function ensureWatcherService(manifest) {
  const app = manifest.application && manifest.application[0];
  if (!app) return;
  app.service = app.service || [];
  if (app.service.some((s) => s && s.$ && s.$['android:name'] === WATCHER_SERVICE)) {
    return;
  }
  app.service.push({
    $: {
      'android:name': WATCHER_SERVICE,
      'android:exported': 'false',
      'android:foregroundServiceType': 'specialUse',
    },
    // Required on Android 14+ for specialUse foreground services.
    property: [
      {
        $: {
          'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
          'android:value':
            'Monitors the foreground app so a study quiz overlay can appear when a distracting app is opened.',
        },
      },
    ],
  });
}

module.exports = function withBlockerPermissions(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    ensurePermissions(manifest);
    ensureWatcherService(manifest);
    return modConfig;
  });
};
