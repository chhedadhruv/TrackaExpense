# Deferred and pending tasks

Things that are postponed or waiting on the owner. No keys, tokens or credentials belong in this file.
Update it as items are done.

## Waiting on the owner

| Item | Why it matters | Notes |
|---|---|---|
| Set `SENTRY_AUTH_TOKEN` in the build environment | Release builds upload JavaScript source maps to Sentry; without it, production stack traces are unreadable | Organization token named `trackaexpense-sourcemaps`. Keep it in the shell or CI secrets, never in a file |
| OneSignal Android push credentials | The OneSignal subscription has no push token until the Firebase service account is added in the OneSignal dashboard | Settings > Push & In-App > Google Android (FCM). Check afterwards that the device subscription shows a token |
| Verify the new Mixpanel project | The app now sends to the dedicated `TrackaExpense` Mixpanel project | Confirm events arrive; the data region chosen for the project is not recorded here |
| Check the minimum iOS version in App Store Connect | The iOS app target says iOS 26.0 (`ios/TrackaExpense.xcodeproj/project.pbxproj`); if the live build shipped that way, older iOS versions cannot install it | Expo SDK 58 needs iOS 16.4 or newer |
| Set branch protection on `staging` and `production` | Stops direct pushes | GitHub repository settings |
| Back up the Android release keystore | A single copy exists on the owner's machine | Needed to ever update the Play Store listing |
| Decide on the CI workflow file | GitHub Actions fails at startup because of an account billing issue; every push creates a failed run | Either fix billing or delete `.github/workflows/ci.yml` |
| Answer the remaining audit questions | See `../trackaexpense-audit/03-open-questions.md` | Endpoint authentication (13), Revopush keys (16), App Check (19), store privacy declarations (20) |
| Restrict the Firebase API keys in Google Cloud | The keys have no package or bundle restrictions | Audit question 18 |

## Deferred until iOS work (blocked by the Apple billing issue)

- OneSignal iOS: create an APNs `.p8` key, upload it in the OneSignal dashboard with the Key ID, Team ID and bundle ID `com.dhruvchheda.trackaexpense`.
- OneSignal iOS app setup: add a Notification Service Extension target named `OneSignalNotificationServiceExtension` and an App Group (`group.com.dhruvchheda.trackaexpense.onesignal`) on both the app and the extension. Without them, rich notifications, confirmed delivery and badge counts do not work. The app already has the `remote-notification` background mode and the push entitlement.
- Sentry iOS: change the "Bundle React Native code and images" build phase to the Sentry wrapper script, add the debug-symbols upload build phase, and add `ios/sentry.properties` (org and project only). Verify with a release build and a token.
- Run and test the app on iOS (it builds on the iOS 26.5 simulator; flows were not tested).

## Deferred until after Expo and the later phases

- Expo conversion (Phase 1b-ii): compatibility audit first, then choose the Expo SDK. SDK 58 needs React Native 0.88, React 19.3 and iOS 16.4 or newer.
- Remove Crashlytics, Firebase Analytics and Firebase Performance once Sentry and Mixpanel are confirmed in production.
- Android: Sentry Gradle plugin (native symbol and R8 mapping upload) is not set up; only JavaScript source maps are.
- Move push sending to Cloud Functions; the Express notification server is not deployed.
- Set `min_supported_version` in Firebase Remote Config when a forced update is needed (live change, needs approval).
- One store release after all phases are complete. Do not run the Revopush release scripts from `develop` before then: that JavaScript needs native modules that the live store builds do not contain.
