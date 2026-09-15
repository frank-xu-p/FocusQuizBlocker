# FocusQuizBlocker

Android focus app: opening a distracting app triggers a full-screen Adobe Expert
cert quiz overlay you must answer to proceed. Built with Expo (dev build —
Expo Go can't do usage-access or screen overlays).

## How it works

- `modules/foreground-watcher` — native foreground service polling
  `UsageStatsManager` ~once a second; emits `ForegroundAppChanged` to JS.
- `modules/quiz-overlay` — native `SYSTEM_ALERT_WINDOW` full-screen view hosting
  a second React root (`FocusQuizOverlay`) that renders the quiz. Back button is
  consumed; hard mode has no skip.
- `src/` — onboarding (two manual Settings grants), blocklist UI (comms apps
  can never be blocked), settings (hard/gentle toggle, grace period, server URL,
  manual sync), and the quiz flow.
- `server/` — Python-stdlib quiz server (see `server/README.md`).

## Build the APK (on a machine with the Android SDK)

This repo was scaffolded and validated on a VM without the Android SDK, so the
APK must be built where the SDK exists (e.g. Peigang's laptop):

```sh
npm install
npx expo run:android
```

This compiles the dev-client APK and installs it on the connected device /
emulator. `npx expo prebuild --clean --platform android` was already validated
here (config plugin OK).

Alternative: EAS Build (`eas build --platform android --profile development`)
with an Expo account — no local SDK needed.

## First run on the phone

1. Install the dev-build APK.
2. Open FocusQuiz → grant **Usage access** and **Display over other apps**
   (the onboarding screen walks through both).
3. Pick the apps to block (Instagram, TikTok… — all off by default; phone,
   messages and contacts can't be blocked).
4. Set the quiz server URL in Settings (default is baked in from
   `app.json` → `extra.serverUrl` at build time).

## Known limitations

- The Home gesture can't be intercepted by Android: swiping home dismisses the
  overlay, but reopening the blocked app re-triggers the quiz.
- Banking/secure apps (`FLAG_SECURE`) block all overlays by OS design.
- Quiz questions are fetched live; offline, the app uses one cached spare
  question, then blocks without a quiz until it's back online.
