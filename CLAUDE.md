# TrackaExpense project guidance

Guidance for working in this repository. Detail lives in `../trackaexpense-audit/04-updated-master-prompt-and-plan.md`.

## 1. Project

- Name: TrackaExpense. Personal finance app: expenses, income, statistics, group splits, IOUs, savings goals.
- Platforms: Android and iOS. Live, published app with real users on both stores.
- Android applicationId: `com.trackaexpense`. iOS bundle ID: `com.dhruvchheda.trackaexpense`. URL scheme: `trackaexpense`.
- Firebase project ID: `trackaexpense` (single project, single environment). EAS project ID: none yet, OWNER TO CONFIRM.
- Version today: 1.3.5 (build 26062421).

## 2. Stack today and target

| Area | Today | Target |
|---|---|---|
| Runtime | Expo SDK 58 on React Native 0.88.1, React 19.3.0, Hermes, New Architecture (Android verified, iOS not yet) | Expo (prebuild), TypeScript strict |
| Language | TypeScript (about 65 files) + 12 JS files | TypeScript strict only |
| Routing | React Navigation 7 | Expo Router |
| Styling | StyleSheet, react-native-paper | NativeWind v4 |
| State | Context + hooks, direct Firestore | Zustand, TanStack Query v5, MMKV |
| Firebase | RN Firebase v21: auth, firestore, storage, messaging, analytics, crashlytics, perf, remote-config | Auth, Firestore, Storage, Functions (`asia-south1`), Remote Config |
| Errors | Crashlytics | Sentry |
| Analytics | Firebase Analytics | Mixpanel |
| Push | FCM token registration and OneSignal, Express server (not deployed) | OneSignal, sends from Cloud Functions only |
| OTA | EAS Update configured (`expo-updates`, nothing published yet); CodePush removed | EAS Update |

## 3. Commands (scripts that exist today)

- `yarn install` : install dependencies (runs `patch-package`).
- `yarn start` / `yarn start:reset` : Metro, optionally clearing cache.
- `yarn android` / `yarn ios` : run debug builds. `yarn android:release`, `yarn ios:release` : release configuration.
- `yarn lint` : ESLint.
- `yarn type-check` : `tsc --noEmit` (must stay at 0 errors).
- `yarn format <files>` / `yarn format:check <files>` : Prettier on the given files.
- `yarn check:ratchet` : compares ESLint, TypeScript and Prettier counts with `docs/quality-baseline.json`; `--update` lowers the baseline.
- `yarn test` : Jest unit tests.
- `yarn emulators` : starts the Firestore and Storage emulators (needs the Firebase CLI installed globally and JDK 21 or newer).
- `yarn test:rules` : Firestore and Storage rules tests in the local emulator (needs JDK 21 or newer; no live project is touched).
- `yarn build:android` : release APK. `yarn build:android:bundle` : release AAB. `yarn build:clean` : Gradle clean.
- `yarn version:bump` : `scripts/bump-version.js` (stamps `app.json` `version`, `android.versionCode` and `ios.buildNumber` from `package.json` and the current time).
- EAS (CLI installed globally, logged in as the owner; project ID in `app.json`, owner `chhedadhruv`): `eas build --profile preview|production --platform android|ios` and `eas update --channel <channel>`. Profiles and channels are in `eas.json` (development, preview, production). `runtimeVersion` uses the `fingerprint` policy, so an update only reaches binaries with identical native code. The first preview Android build (2026-11-09, build `9641385f-2089-4ef3-a0a8-abd8329f0e87`) succeeded and was checked on the emulator; nothing has been published with `eas update`. EAS builds need Node 24 (`.nvmrc`, `engines`, the `base` profile in `eas.json`), because `@firebase/ai` requires Node `>=24.12.0`. The Firebase config files must be identical locally and in the EAS file variables `GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICE_INFO_PLIST` (see `docs/deferred-tasks.md`). EAS Doctor runs on every build (it cannot run through the local `yarn expo` CLI): keep `.expo/` ignored and keep one version of each native module. EAS decompression tip: build logs from `eas build:view --json` (`logFiles`) are brotli-compressed. Never run `eas update` or `eas build` without owner approval.
- There are no Revopush release scripts (removed with CodePush).
- Never use `npx`: run Expo through yarn (`yarn expo prebuild --clean`, `yarn expo install <pkg>`, `yarn expo install --check`). `android/` and `ios/` are gitignored and rebuilt by `yarn expo prebuild --clean --no-install` (`yarn android` and `yarn ios` run it when the folders are missing). Signing files and Firebase config are not committed; a fresh checkout needs these local files first: `credentials/android/keystore.properties` and `credentials/android/<keystore file>` (copied into `android/` by `plugins/with-release-signing.js`), `google-services.json` and `GoogleService-Info.plist` at the repo root (copied in by the Firebase plugin), and `.env`.
- iOS after dependency changes: `cd ios && pod install`.
- iOS simulator build when `yarn ios` fails (no `Simulator.app`): `xcodebuild` with `-destination id=<simulator>`, then `xcrun simctl install` and `launch`; the app target needs an iOS 26 simulator.

Planned commands: EAS build and update scripts (Phase 1b).

## 4. Folder map

- `screens/` : screens (`SplitScreens/` for groups, splits, IOUs, invitations).
- `navigation/` : providers (`AuthProvider`), `Routes`, `AuthStack`, `AppStack`.
- `services/` : notification, reminder, fun-notification, split-notification, update services.
- `src/` : newer shared code: `components/`, `constants/theme.ts`, `hooks/`, `services/` (analytics, performance, remote config), `types/`, `utils/`.
- `components/`, `utils/` : older shared components and utilities (currency, sign-in config, category data, permissions).
- `firebase/` : Firestore and Storage rules, indexes, rules tests (`firebase/tests`), and `baseline/` (old open rules, rollback only). `firebase.json` at the root.
- `server/` : Express notification server (cron, push, emails; not deployed). Uses yarn (`server/yarn.lock`).
- `android/`, `ios/` : generated native projects, gitignored; never edit them by hand. `plugins/` : local Expo config plugins (release signing, Firebase Gradle versions, Gradle memory). `config/` : files injected into the native build (R8 rules). `credentials/` : local signing files, gitignored. `patches/` : patch-package patches (none today). `scripts/` : version bump.
- `examples/`, `store-screenshots/`, `vendor/` : non-app material.

## 5. Hard rules

- Yarn only; never npm or npx; never create `package-lock.json`.
- No AI attributions of any kind in commit messages, pull request descriptions, code comments, or docs.
- No emojis anywhere (UI, copy, comments, notifications). Icons are SVG only: `lucide-react-native` for UI icons, custom `react-native-svg` components for category icons and illustrations.
- Never hardcode secrets; keys come from environment variables or EAS secrets. Never print or commit credential files.
- Never change the package name, bundle ID, or signing credentials.
- TypeScript strict on new and touched files; no `any`.

## 6. Quality gates

- Pre-commit: ESLint, TypeScript, Prettier, related Jest tests (`.husky/pre-commit`). Commit-message check and pre-push (full tests and ratchet) are in `.husky/`.
- GitHub Actions is NOT running: the workflow in `.github/workflows/ci.yml` exists but runs fail at startup because of an account billing issue, and the owner has chosen to skip CI for now. The local hooks are the only gates; run `yarn type-check`, `yarn test`, `yarn check:ratchet` and `yarn test:rules` yourself before pushing.
- Ratchet baseline: `docs/quality-baseline.json` (started at ESLint 37 errors and 389 warnings, `tsc` 162 errors, Jest not running; `tsc` is now 0).
- Rule: no new violations; touched files must be clean; counts only go down.
- Never commit while a gate is failing. Never use `--no-verify`.

## 7. Git and release workflow

- Branches: `main` (legacy default), `develop`, `staging`, `production` (created in Phase 1a). Work on feature branches off `develop`.
- Conventional Commits: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
- Push to `staging` or `production`: if `version` or `runtimeVersion` changed, run an EAS build; otherwise publish an EAS Update to the matching channel. Production also runs EAS Submit to both stores. (Needs the Expo conversion in Phase 1b.)
- Never push directly to `production`.
- Today: versions are bumped manually (`app.json` `version`, `android.versionCode`, `ios.buildNumber`, and `package.json`); there is no OTA channel until EAS Update is set up.

## 8. Live-app safety

- Money today: JS floats in major units; `amount` is `string | number` and is a string on 97 percent of live transactions (`src/types/index.ts`). Target: integer minor units. Migration status: not started.
- Data migrations are additive: new field, backfill, app reads both, verify, remove old field in a later release. Take a Firestore export backup first.
- Firestore and Storage rules roll out in stages and are never deployed without owner approval. Stage 1 rules and indexes are deployed from `firebase/`; run `yarn test:rules` before any change. The old open rules in `firebase/baseline/` are for rollback only.
- OTA updates must never rely on native code missing from the live binary; bump `runtimeVersion` on native changes.
- Store rollouts are staged.

## 9. Third-party services

- Sentry (live in code, `src/services/ErrorReporter.ts`): user context is uid only, no email or name. Handled errors go through `reportError()` (never call `crashlytics().recordError` directly). Source map upload is NOT set up yet (needs a Sentry auth token from the owner).
- Mixpanel (live in code, `src/services/MixpanelService.ts` and `src/services/AnalyticsService.ts`): only the approved event names, uid as distinct ID, `reset()` on logout. Add events only through `AnalyticsService`.
- OneSignal (live in code, `src/services/PushService.ts`): identity is the Firebase uid (login/logout in `navigation/Routes.tsx`); the permission prompt is deferred until after the first saved expense. Push credentials (Firebase service account for Android, APNs key for iOS) must be added in the OneSignal dashboard before any push is delivered. All sends must come from Cloud Functions, never the client.
- Still running side by side until the next release: Firebase Analytics, Crashlytics, Perf and FCM. Remove Crashlytics and Firebase Analytics once Sentry and Mixpanel are confirmed in production.
- Keys (`SENTRY_DSN`, `MIXPANEL_TOKEN`, `ONESIGNAL_APP_ID`) live in the gitignored `.env`; names are in `.env.example`. Empty values disable the service.

## 10. How to work

- One phase at a time; stop at the end of each phase and wait for sign-off.
- Ask before architectural or data decisions.
- Announce intent before installing a package or introducing a new pattern.
- Write tests alongside features.

## 11. Current phase

Phase 1a is complete (tooling, local quality gates, minimum-version gate, server on yarn; CI skipped because of a billing issue). Phase 1b-i is complete on Android: Sentry (with source map upload), Mixpanel (dedicated project) and OneSignal (Android push credentials added) are verified; the iOS parts are deferred (see `docs/deferred-tasks.md`). Phase 1b-ii (Expo conversion) is complete on Android: Expo SDK 58 on React Native 0.88 and React 19, RN Firebase v27, Notifee and CodePush removed, EAS Build and EAS Update configured, `android/` and `ios/` generated on every prebuild, and a first EAS preview build checked on an emulator (2026-11-09). Not done and deferred: the iOS build and test (Apple billing issue), the first EAS production build and any `eas update`, a real OneSignal push tap test, and the split and settle-up write paths and Google sign-in on a device (see `docs/deferred-tasks.md`). The next phase is Phase 2 (data and security) and waits for owner sign-off.

- [x] Phase 0: audit, plus stage 1 Firestore and Storage rules and indexes deployed
- [x] Phase 1a: tooling and safety net
- [x] Phase 1b-i: Sentry, Mixpanel, OneSignal (Android verified, iOS deferred)
- [x] Phase 1b-ii: Expo conversion (Android verified, iOS deferred)
- [ ] Phase 2: data and security (money to integers, uid-based membership, tighter rules)
- [ ] Phase 3: core features
- [ ] Phase 4: growth features
- [ ] Phase 5: smart features
- [ ] Phase 6: polish

## 12. Known gotchas

- Stage 1 rules keep interim access: any signed-in user can read user profiles and invitations and can change another user's `balance` only: `firebase/firestore.rules`. Tighten in Phase 2.
- Live data: 126 users; transaction `amount` is a string on 97 percent of documents (up to 4 decimals); savings goals are in the embedded `users.savingsGoals` array.
- The project is on Expo SDK 58. `android/` and `ios/` are generated by `yarn expo prebuild --clean` from `app.json`, `app.config.js` and the local plugins in `plugins/`; the owner decided they are not committed and are regenerated on every build. Put native customizations in config plugins (or `app.json`), never in hand edits: a re-prebuild overwrites them. The earlier Expo migration was abandoned (tag `pre-expo-migration` is not in `main`'s history).
- Config plugin mods run in reverse order of the `plugins` list in `app.json`: `plugins/with-firebase-gradle-versions` must stay first so it runs after the React Native Firebase plugin has added its lines. It forces Firebase Gradle plugins that work with AGP 9.
- `app.config.js` injects `config/android-proguard-rules.pro` (the R8 rules) through `expo-build-properties`. `plugins/with-release-signing.js` signs local release builds from `credentials/android/keystore.properties` (copied to `android/`); without those files the release build uses the debug key, which Play rejects.
- `react-native-gifted-charts` needs a gradient package at startup (`expo-linear-gradient` is installed for it). Removing it crashes the app on launch even though no app file imports it. Check what a package needs at runtime before calling it unused.
- RN Firebase is on v27: `snapshot.exists()` is a method (a property access is always truthy and fails silently, so grep for `.exists` without a call when adding Firestore code), Remote Config uses `remoteConfig.defaultConfig` and `remoteConfig.settings` assignments, and Storage uses `ref(storage, url)` for URLs. The Firebase Android SDK needs Kotlin 2.4.0 (`kotlinVersion` in the `expo-build-properties` plugin in `app.json`).
- Notifee is removed and `expo-notifications` must not be added: it registers a second Android Firebase messaging service that competes with RN Firebase and OneSignal. Notification taps are handled by the OneSignal click listener (`src/services/PushService.ts`) and `services/NotificationNavigation.ts`.
- `app.json` version (1.3.3) lags `package.json` (1.3.5): `app.json`.
- `metro.config.js` blocks only this project's `server/` folder (anchored path). A looser pattern broke Sentry's `mcp-server` folder; do not loosen it.
- After adding or changing native dependencies, restart Metro with `yarn start --reset-cache` and reinstall the app (`yarn android` / rebuild iOS); an emulator can revert to an older installed build after a restart.
- Android release builds upload JavaScript source maps to Sentry through the Sentry Expo plugin (it writes `android/sentry.properties` and applies the Gradle plugin on prebuild); they need `SENTRY_AUTH_TOKEN` in the environment (never in a file). Set `SENTRY_DISABLE_AUTO_UPLOAD=true` for a local release build without a token. Always run `./gradlew :app:assembleRelease` after adding a native dependency: R8 shrinking can fail on missing classes that debug builds never show (rules live in `config/android-proguard-rules.pro`, injected by `app.config.js`).
- Postponed and owner-dependent work is listed in `docs/deferred-tasks.md`; keep it current.
- Release plan: the next store build happens after all phases are complete (owner decision). Never publish this JavaScript over the air to the live store binaries: it imports native modules they do not contain (Sentry, Mixpanel, OneSignal, keyboard-controller, Reanimated, Expo modules) and it would crash installed apps on startup. With EAS Update configured this rule is enforced by the fingerprint runtime version (the live binaries have no `expo-updates`, so they never check for updates), but still never publish to a channel that a live binary uses.
- OneSignal is on 5.5.17: 5.4.3 failed to build with AGP 9 and RN 0.88.
- Do not add `firebase-tools` (or anything that pulls in `node-fetch` 3) to this package's dependencies: it changes which `node-fetch` is hoisted and breaks the React Native bundle. Install the Firebase CLI globally instead.
- Remote Config `min_supported_version` (default `0.0.0`, check disabled) blocks older app versions with an update screen: `App.tsx`, `components/ForceUpdateScreen.tsx`. Setting it in the console is a live change that needs owner approval.
- Jest runs only pure utility tests (`__tests__/`); rendering `App` in Jest needs Firebase and native module mocks that do not exist yet.
- ESLint warnings and errors and unformatted files still exist in legacy code; the current counts are in `docs/quality-baseline.json` and may only go down.
- `users/{uid}.balance` is incremental only; never recalculate it in a batch (`src/types/index.ts`).
- Transaction `date` is a "YYYY-MM-DD" string; split `date` is a Timestamp with a `createdAt` fallback (`src/types/index.ts`).
- Group membership and invitations are keyed by email, and clients query `users` by email and phone: `screens/SplitScreens/SplitScreen.tsx`.
- Single FCM token per user in `users/{uid}.fcmToken`, and the client reads other users' tokens: `services/NotificationService.ts`.
- The notification server is not deployed, so server-created split transactions for other members do not happen today: `server/notification-server.js`.
- Emojis remain in: `services/FunNotificationService.ts`, `services/ReminderNotificationService.ts`, `services/SplitNotificationService.ts`, `server/notification-server.js`, and one line each in several screens.
- No list virtualisation anywhere; screens map arrays inside ScrollView.
- The old hand-made iOS project had deployment target 26.0 on the app target; the generated project takes its target from Expo SDK 58 (iOS 16.4 or newer). Check the live minimum in App Store Connect before the first iOS build.
- The old Podfile workarounds (Xcode 26 `fmt` consteval patch, deployment-target floor) were dropped with the regeneration; if `pod install` or the build fails on a new Xcode, add them back as a config plugin. `yarn ios` fails where `Simulator.app` is missing from the Xcode path.
- The Gradle wrapper download can time out; fetch the distribution zip with curl into `~/.gradle/wrapper/dists/` if it does.
- `GoogleService-Info.plist` exists in git history (old `ios/` paths); the current copy lives untracked at the repo root.
- Two overlapping shared-code locations: `components/` and `utils/` versus `src/`.
- The Android release keystore has a single copy on the owner's machine (`credentials/android/`, gitignored) plus a safety copy outside the repo; back it up properly.
- Native modules that force a new binary when changed include Firebase, Google and Apple sign-in, every Expo module, `react-native-reanimated` (4.7.1 with `react-native-worklets`; `babel-preset-expo` adds the worklets plugin), `react-native-keyboard-controller`, `react-native-svg`.
