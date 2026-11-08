# CLAUDE.md

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
- `yarn test` : Jest (currently fails to load, see gotchas).
- `yarn test:rules` : Firestore and Storage rules tests in the local emulator (needs JDK 21 or newer; no live project is touched).
- `yarn build:android` : release APK. `yarn build:android:bundle` : release AAB. `yarn build:clean` : Gradle clean.
- `yarn version:bump` : `scripts/bump-version.js`.
- `yarn release:ios`, `yarn release:android`, `yarn release:all` : Revopush CodePush releases (live OTA; owner approval needed).
- iOS after dependency changes: `cd ios && pod install`.
- iOS simulator build when `yarn ios` fails (no `Simulator.app`): `xcodebuild` with `-destination id=<simulator>`, then `xcrun simctl install` and `launch`; the app target needs an iOS 26 simulator.

Planned commands (added in Phase 1a): `yarn type-check`, `yarn format`, `yarn format:check`. Later: EAS build and update scripts.

## 4. Folder map

- `screens/` : screens (`SplitScreens/` for groups, splits, IOUs, invitations).
- `navigation/` : providers (`AuthProvider`), `Routes`, `AuthStack`, `AppStack`.
- `services/` : notification, reminder, fun-notification, split-notification, update services.
- `src/` : newer shared code: `components/`, `constants/theme.ts`, `hooks/`, `services/` (analytics, performance, remote config), `types/`, `utils/`.
- `components/`, `utils/` : older shared components and utilities (currency, sign-in config, category data, permissions).
- `firebase/` : Firestore and Storage rules, indexes, rules tests (`firebase/tests`), and `baseline/` (old open rules, rollback only). `firebase.json` at the root.
- `server/` : Express notification server (cron, push, emails; not deployed). Uses npm today.
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

- Pre-commit: ESLint, TypeScript, Prettier, related Jest tests. Pre-push: full tests. GitHub Actions runs the same on `ubuntu-latest`. (Being added in Phase 1a; check `package.json` and `.husky/` for what exists.)
- Ratchet baseline from the audit: ESLint 37 errors and 389 warnings; `tsc --noEmit` 162 errors; Jest 1 suite failing to load, 0 tests.
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

- Sentry (target): user context is uid only, no email or name; source maps uploaded on every build.
- Mixpanel (target): approved events only; `reset()` on logout.
- OneSignal (target): sends only from Cloud Functions; permission prompt deferred until after the first expense.
- Today: Firebase Analytics, Crashlytics, Perf, FCM, Notifee.

## 10. How to work

- One phase at a time; stop at the end of each phase and wait for sign-off.
- Ask before architectural or data decisions.
- Announce intent before installing a package or introducing a new pattern.
- Write tests alongside features.

## 11. Current phase

Phase 1a in progress (tooling, quality gates, CI; no native changes). Phase 1b (Expo conversion, Sentry, Mixpanel, OneSignal) follows after sign-off.

- [x] Phase 0: audit, plus stage 1 Firestore and Storage rules and indexes deployed
- [ ] Phase 1a: tooling and safety net
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
- `__tests__/App.test.tsx` fails to load `App.tsx`, so Jest runs 0 tests.
- `tsc` reports 162 errors (JSX component type errors, for example `screens/TransactionDetailScreen.tsx`).
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
- `server/package-lock.json` is tracked (npm); the root uses yarn.
- Two overlapping shared-code locations: `components/` and `utils/` versus `src/`.
- The Android release keystore has a single copy on the owner's machine: `android/keystore.properties` (gitignored).
- Native modules that force a new binary when changed include Firebase, Notifee, Google and Apple sign-in, CodePush, `react-native-fs`, `react-native-svg` (patched in `patches/`).
