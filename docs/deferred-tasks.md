# Deferred and pending tasks

Things that are postponed or waiting on the owner. No keys, tokens or credentials belong in this file.
Update it as items are done.

## Waiting on the owner

| Item | Why it matters | Notes |
|---|---|---|
| Export `SENTRY_AUTH_TOKEN` in the shell or CI secrets used for release builds | Gradle reads the token from the environment, not from `.env`. The upload was verified on 2026-11-08 by loading the token from `.env` for a single build | Organization token `trackaexpense-sourcemaps`. A throwaway release `com.trackaexpense@0.0.0-sourcemap-check` was created in Sentry by that test and can be deleted |
| Check the minimum iOS version in App Store Connect | The iOS app target says iOS 26.0 (`ios/TrackaExpense.xcodeproj/project.pbxproj`); if the live build shipped that way, older iOS versions cannot install it | Expo SDK 58 needs iOS 16.4 or newer |
| Set branch protection on `staging` and `production` | Stops direct pushes | GitHub repository settings |
| Back up the Android release keystore | A single copy exists on the owner's machine, plus a safety copy made on 2026-11-09 in `../trackaexpense-audit/native-secrets-backup/` (owner-only permissions, outside the repo, with `keystore.properties`, the Firebase config files and the iOS plists) | Needed to ever update the Play Store listing. Move it to a password manager or encrypted storage and delete the loose copy |
| Decide whether `android/` and `ios/` stay committed or are regenerated on every EAS build | The Expo conversion currently leaves them committed. Regenerating means every customization must live in config plugins (they now do) and `.gitignore` gets `/android` and `/ios` | Recommended: regenerate. Also needs the EAS account and project ID and the Android keystore uploaded to EAS credentials |
| Decide on the CI workflow file | GitHub Actions fails at startup because of an account billing issue; every push creates a failed run | Either fix billing or delete `.github/workflows/ci.yml` |
| Answer the remaining audit questions | See `../trackaexpense-audit/03-open-questions.md` | Endpoint authentication (13), Revopush keys (16), App Check (19), store privacy declarations (20) |
| Restrict the Firebase API keys in Google Cloud | The keys have no package or bundle restrictions | Audit question 18 |

## Deferred until iOS work (blocked by the Apple billing issue)

- OneSignal iOS: create an APNs `.p8` key, upload it in the OneSignal dashboard with the Key ID, Team ID and bundle ID `com.dhruvchheda.trackaexpense`.
- OneSignal iOS app setup: add a Notification Service Extension target named `OneSignalNotificationServiceExtension` and an App Group (`group.com.dhruvchheda.trackaexpense.onesignal`) on both the app and the extension. Without them, rich notifications, confirmed delivery and badge counts do not work. The app already has the `remote-notification` background mode and the push entitlement.
- Sentry iOS: change the "Bundle React Native code and images" build phase to the Sentry wrapper script, add the debug-symbols upload build phase, and add `ios/sentry.properties` (org and project only). Verify with a release build and a token.
- Run and test the app on iOS (it builds on the iOS 26.5 simulator; flows were not tested). After the Expo SDK 58 prebuild the iOS project was generated but has never been built or run: run `pod install`, build, and test.
- iOS Firebase initialization: the React Native Firebase config plugin could not patch the new Swift `AppDelegate` ("Unable to determine correct Firebase insertion point"), so `FirebaseApp.configure()` is not added yet. Upgrade React Native Firebase (v27) and re-check, or add a small config plugin.
- iOS New Architecture: the old Podfile disabled it; RN 0.88 requires it. Every pod must be checked on iOS.
- iOS entitlements and capabilities after prebuild: confirm Sign in with Apple, `aps-environment` (currently `development`; store builds need `production`), background modes, the three URL schemes, and the OneSignal extension.

## Deferred until after Expo and the later phases

- Expo conversion (Phase 1b-ii): audit done (`../trackaexpense-audit/07-expo-conversion-audit.md`), SDK 58 chosen, step 2 done on Android. Remaining: Notifee to `expo-notifications` (Notifee is still installed and built), Firebase v21 to v27 together with the 19 `snapshot.exists` conversions, Google sign-in 16 to 17, EAS Update, EAS Build profiles, iOS bring-up.
- Behavior changes from step 2 to confirm with the owner: the CSV export now writes to app storage and opens the share sheet (it no longer writes into the public Downloads folder); receipt photos use `expo-image-picker`; the splash screen is the app icon on a navy background (it was the default React Native splash); the Android release build now includes the 32-bit ARM libraries (the old build shipped only arm64-v8a and x86_64); `usesCleartextTraffic` is still true in release (kept for parity, should be removed).
- Sentry was moved from 8.34.0 to 8.28.0 by `expo install --fix` (the version SDK 58 pins). Re-verify event delivery and source map upload on a release build.
- Remove Crashlytics, Firebase Analytics and Firebase Performance once Sentry and Mixpanel are confirmed in production.
- Android: Sentry Gradle plugin (native symbol and R8 mapping upload) is not set up; only JavaScript source maps are.
- Move push sending to Cloud Functions; the Express notification server is not deployed.
- Set `min_supported_version` in Firebase Remote Config when a forced update is needed (live change, needs approval).
- One store release after all phases are complete. Never ship this JavaScript over the air to the live store builds: it needs native modules they do not contain. CodePush and its release scripts were removed in the Expo conversion.
