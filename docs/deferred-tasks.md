# Deferred and pending tasks

Things that are postponed or waiting on the owner. No keys, tokens or credentials belong in this file.
Update it as items are done.

## Waiting on the owner

| Item | Why it matters | Notes |
|---|---|---|
| Export `SENTRY_AUTH_TOKEN` in the shell or CI secrets used for release builds | Gradle reads the token from the environment, not from `.env`. The upload was verified on 2026-11-08 by loading the token from `.env` for a single build | Organization token `trackaexpense-sourcemaps`. A throwaway release `com.trackaexpense@0.0.0-sourcemap-check` was created in Sentry by that test and can be deleted |
| Check the minimum iOS version in App Store Connect | The iOS app target says iOS 26.0 (`ios/TrackaExpense.xcodeproj/project.pbxproj`); if the live build shipped that way, older iOS versions cannot install it | Expo SDK 58 needs iOS 16.4 or newer |
| Set branch protection on `staging` and `production` | Stops direct pushes | GitHub repository settings |
| Back up the Android release keystore | A single copy exists on the owner's machine (`credentials/android/`, gitignored), plus a safety copy made on 2026-11-09 in `../trackaexpense-audit/native-secrets-backup/` (owner-only permissions, outside the repo, with `keystore.properties`, the Firebase config files and the iOS plists) | Needed to ever update the Play Store listing. Move it to a password manager or encrypted storage and delete the loose copy |
| Keep `GOOGLE_SERVICE_INFO_PLIST` on EAS identical to the local `GoogleService-Info.plist` | The fingerprint runtime version hashes the contents of the Firebase config files, and a mismatch between the EAS copy and the local copy stops the build ("Runtime version mismatch"). This happened for `google-services.json` on the first EAS build (the EAS copy differed, so it was replaced with the local file on 2026-11-09). The plist variable was not compared because secret variables cannot be read, so the same stop will appear on the first iOS build if it differs | Whenever either Firebase file changes, update the EAS variable too (`eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --force --environment development --environment preview --environment production`). iOS credentials also need the Apple account (blocked by the billing issue) |
| Decide on the CI workflow file | GitHub Actions fails at startup because of an account billing issue; every push creates a failed run | Either fix billing or delete `.github/workflows/ci.yml` |
| Answer the remaining audit questions | See `../trackaexpense-audit/03-open-questions.md` | Endpoint authentication (13), Revopush keys (16), App Check (19), store privacy declarations (20) |
| Restrict the Firebase API keys in Google Cloud | The keys have no package or bundle restrictions | Audit question 18 |

## Deferred until iOS work (blocked by the Apple billing issue)

- OneSignal iOS: create an APNs `.p8` key, upload it in the OneSignal dashboard with the Key ID, Team ID and bundle ID `com.dhruvchheda.trackaexpense`.
- OneSignal iOS app setup: add a Notification Service Extension target named `OneSignalNotificationServiceExtension` and an App Group (`group.com.dhruvchheda.trackaexpense.onesignal`) on both the app and the extension. Without them, rich notifications, confirmed delivery and badge counts do not work. The app already has the `remote-notification` background mode and the push entitlement.
- Sentry iOS: change the "Bundle React Native code and images" build phase to the Sentry wrapper script, add the debug-symbols upload build phase, and add `ios/sentry.properties` (org and project only). Verify with a release build and a token.
- Run and test the app on iOS (it builds on the iOS 26.5 simulator; flows were not tested). After the Expo SDK 58 prebuild the iOS project was generated but has never been built or run: run `pod install`, build, and test.
- iOS Firebase initialization: fixed by React Native Firebase v27, whose config plugin now adds `FirebaseApp.configure()` to the Swift `AppDelegate` (seen in the generated `ios/TrackaExpense/AppDelegate.swift`). Confirm on a device build.
- iOS New Architecture: the old Podfile disabled it; RN 0.88 requires it. Every pod must be checked on iOS.
- iOS linkage: React Native Firebase v27 does not support static frameworks (its `pod install` fails with "SPM + static linkage is not supported"), so `app.json` now sets `ios.useFrameworks` to `dynamic`. Other pods that the old Podfile assumed were static (`$RNFirebaseAsStaticFramework`) must be checked in the first iOS build.
- iOS entitlements and capabilities after prebuild: confirm Sign in with Apple, `aps-environment` (currently `development`; store builds need `production`), background modes, the three URL schemes, and the OneSignal extension.

## Phase 2 findings that need a decision or follow-up (production profile, 2026-11-09)

Counts only; details in `../trackaexpense-audit/09-phase-2-data-profile.md`.

- The `firestore-send-email` extension is in the ERRORED state and no `mail` document has ever reached a success state (59 of 73 never processed, 10 ERROR, 4 PROCESSING). Contact messages, summary emails and split emails sent through the `mail` collection are not being delivered. Needs investigation (SMTP settings in the extension configuration); it is outside the Phase 2 money work.
- One account holds 5 transactions with absurd amounts (the largest about 1e28) and 5 users have a balance above 1,000,000. They cannot be converted to integer minor units: the backfill skips and reports them. The owner decides separately what to do with that data.
- 18 transactions have a date that is not `YYYY-MM-DD` (for example `2025-5-14`), so text sorting and range filters treat them wrongly. A normalized date is added during the backfill (additive).
- Split documents embed full copies of member user profiles (phone, FCM token, stale balance, savings goals, transactions). Anyone who can read a split can read those. The new app stops writing them; the existing copies are scrubbed only after old apps are gone (same threshold as strict rules).
- 78 of 127 users have no stored `currency` (the app treats that as INR).
- Groups: 6 of 41 member emails have no account (pending invitees) and no group has `memberIds` yet. The IOU collection is empty (the feature has no production data).

## Deferred until after Expo and the later phases

- Expo conversion (Phase 1b-ii): audit done (`../trackaexpense-audit/07-expo-conversion-audit.md`), SDK 58 chosen, step 2 done on Android. Step 3 done: Firebase v27 (with the 19 `exists()` conversions, Remote Config and Storage API changes, Kotlin 2.4.0 for the Firebase Android SDK), Google sign-in 17, Notifee removed (owner chose OneSignal over `expo-notifications` because `expo-notifications` adds a competing Android messaging service). Remaining: EAS Update, EAS Build profiles, iOS bring-up.
- Notifee removal side effects: an FCM message received while the app is open is no longer shown (nothing sends FCM today); taps on OneSignal notifications now open the matching screen through `services/NotificationNavigation.ts` (not yet tested with a real push); the old `ic_notification` small icon is no longer in the generated project, so OneSignal and FCM notifications will use the app icon until a small icon (`ic_stat_onesignal_default`) is added with a config plugin; `NotificationService.initialize` still asks for FCM notification permission at startup, which conflicts with the deferred OneSignal prompt and should be removed with the push work.
- Behavior changes from step 2 to confirm with the owner: the CSV export now writes to app storage and opens the share sheet (it no longer writes into the public Downloads folder); receipt photos use `expo-image-picker`; the splash screen is the app icon on a navy background (it was the default React Native splash); the Android release build now includes the 32-bit ARM libraries (the old build shipped only arm64-v8a and x86_64); `usesCleartextTraffic` is still true in release (kept for parity, should be removed).
- Sentry was moved from 8.34.0 to 8.28.0 by `expo install --fix` (the version SDK 58 pins). Re-verify event delivery and source map upload on a release build.
- Remove Crashlytics, Firebase Analytics and Firebase Performance once Sentry and Mixpanel are confirmed in production.
- Android: Sentry Gradle plugin (native symbol and R8 mapping upload) is not set up; only JavaScript source maps are.
- Move push sending to Cloud Functions; the Express notification server is not deployed.
- Set `min_supported_version` in Firebase Remote Config when a forced update is needed (live change, needs approval).
- One store release after all phases are complete. Never ship this JavaScript over the air to the live store builds: it needs native modules they do not contain. CodePush and its release scripts were removed in the Expo conversion.
