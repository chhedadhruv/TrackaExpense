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
| Runtime | Bare React Native 0.77.0, React 18.3.1, Hermes | Expo (prebuild), TypeScript strict |
| Language | TypeScript (about 65 files) + 12 JS files | TypeScript strict only |
| Routing | React Navigation 7 | Expo Router |
| Styling | StyleSheet, react-native-paper | NativeWind v4 |
| State | Context + hooks, direct Firestore | Zustand, TanStack Query v5, MMKV |
| Firebase | RN Firebase v21: auth, firestore, storage, messaging, analytics, crashlytics, perf, remote-config | Auth, Firestore, Storage, Functions (`asia-south1`), Remote Config |
| Errors | Crashlytics | Sentry |
| Analytics | Firebase Analytics | Mixpanel |
| Push | FCM + Notifee, Express server (not deployed) | OneSignal, sends from Cloud Functions only |
| OTA | Revopush CodePush | EAS Update |

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
- `yarn version:bump` : `scripts/bump-version.js`.
- `yarn release:ios`, `yarn release:android`, `yarn release:all` : Revopush CodePush releases (live OTA; owner approval needed).
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
- `android/`, `ios/` : native projects. `patches/` : patch-package patches. `scripts/` : version bump.
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
- Today: versions are bumped manually and OTA goes through Revopush.

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
- Still running side by side until the next release: Firebase Analytics, Crashlytics, Perf, FCM and Notifee. Remove Crashlytics and Firebase Analytics once Sentry and Mixpanel are confirmed in production.
- Keys (`SENTRY_DSN`, `MIXPANEL_TOKEN`, `ONESIGNAL_APP_ID`) live in the gitignored `.env`; names are in `.env.example`. Empty values disable the service.

## 10. How to work

- One phase at a time; stop at the end of each phase and wait for sign-off.
- Ask before architectural or data decisions.
- Announce intent before installing a package or introducing a new pattern.
- Write tests alongside features.

## 11. Current phase

Phase 1a is complete (tooling, local quality gates, minimum-version gate, server on yarn; CI skipped because of a billing issue). Phase 1b (Expo conversion, Sentry, Mixpanel, OneSignal) starts only after owner sign-off.

- [x] Phase 0: audit, plus stage 1 Firestore and Storage rules and indexes deployed
- [x] Phase 1a: tooling and safety net
- [ ] Phase 1b: Expo conversion and observability SDKs
- [ ] Phase 2: data and security (money to integers, uid-based membership, tighter rules)
- [ ] Phase 3: core features
- [ ] Phase 4: growth features
- [ ] Phase 5: smart features
- [ ] Phase 6: polish

## 12. Known gotchas

- Stage 1 rules keep interim access: any signed-in user can read user profiles and invitations and can change another user's `balance` only: `firebase/firestore.rules`. Tighten in Phase 2.
- Live data: 126 users; transaction `amount` is a string on 97 percent of documents (up to 4 decimals); savings goals are in the embedded `users.savingsGoals` array.
- No Expo packages exist; the earlier Expo migration was abandoned (tag `pre-expo-migration` is not in `main`'s history).
- `app.json` version (1.3.3) lags `package.json` (1.3.5): `app.json`.
- `metro.config.js` blocks only this project's `server/` folder (anchored path). A looser pattern broke Sentry's `mcp-server` folder; do not loosen it.
- After adding or changing native dependencies, restart Metro with `yarn start --reset-cache` and reinstall the app (`yarn android` / rebuild iOS); an emulator can revert to an older installed build after a restart.
- OneSignal 5.4.3 is the newest release that supports React Native 0.77 (5.4.4 and later need 0.79).
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
- The iOS app target has deployment target 26.0: `ios/TrackaExpense.xcodeproj/project.pbxproj`. Verify against App Store Connect.
- Xcode 27 needs the Pod deployment-target floor in `ios/Podfile`; `yarn ios` fails where `Simulator.app` is missing from the Xcode path.
- The Gradle wrapper download can time out; fetch the distribution zip with curl into `~/.gradle/wrapper/dists/` if it does.
- `ios/GoogleService-Info.plist` is untracked now but exists in git history.
- Two overlapping shared-code locations: `components/` and `utils/` versus `src/`.
- The Android release keystore has a single copy on the owner's machine: `android/keystore.properties` (gitignored).
- Native modules that force a new binary when changed include Firebase, Notifee, Google and Apple sign-in, CodePush, `react-native-fs`, `react-native-svg` (patched in `patches/`).
