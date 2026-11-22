<div align="center">
  <img src="./assets/icon.png" alt="TrackaExpense Logo" width="120" height="120">

  # TrackaExpense

  ### Personal finance: expenses, splits, budgets and savings

  [![React Native](https://img.shields.io/badge/React%20Native-0.88.1-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://reactnative.dev/)
  [![Expo](https://img.shields.io/badge/Expo%20SDK-58-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
  [![Firebase](https://img.shields.io/badge/RN%20Firebase-27.1.0-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://rnfirebase.io/)
  [![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
  [![Version](https://img.shields.io/badge/Version-1.5.1-blue.svg?style=for-the-badge)](package.json)

  **An ad-free personal finance app built with Expo, React Native, TypeScript and Firebase**

  [Website](https://trackaexpense.dhruvchheda.com) • [Report a bug](https://github.com/chhedadhruv/TrackaExpense/issues) • [Request a feature](https://github.com/chhedadhruv/TrackaExpense/issues)

</div>

---

## About

TrackaExpense tracks expenses and income, splits bills with friends and groups, and helps you stay on budget and save towards goals. It is a live Android app with real users. iOS is configured but has not been built or tested yet.

## Features

- **Transactions**: add, edit and delete expenses and income, with categories, notes, tags and receipt photos; search and filter by period, text, tag and payment method; CSV export.
- **Statistics**: spending by category, trends over time, merchants, a heatmap and a breakdown by payment method, drawn with Victory Native on Skia.
- **Group splits**: groups, equal or percentage splits, settle-up, IOUs, friends and balances, split history, invitations by email and by invite link.
- **Savings goals**: multiple goals with deposits, withdrawals, history and a "goal reached" notification.
- **Budgets**: monthly or custom-period budgets per category, with alerts at 50, 80, 100 and 120 percent.
- **Recurring transactions**: weekly, monthly and yearly rules created by a scheduled Cloud Function.
- **Credit cards**: pay with a card, track what each card owes, pay a bill, due-date reminders, and a "Fix my balance" adjustment.
- **Receipt scanner**: reads the total, date and merchant from a receipt photo with Google Cloud Vision.
- **Bank message import**: paste a bank SMS and the app fills in the transaction (HDFC, ICICI, SBI, Axis, Kotak and a generic parser).
- **Notifications**: weekly and monthly summaries, settle-up reminders, card bill reminders and an optional evening nudge, sent through OneSignal from Cloud Functions.
- **Accounts and settings**: email, Google and Apple sign-in; light, dark and system themes; multi-currency display; over-the-air updates.

## Tech stack

| Area | Choice |
| --- | --- |
| App | Expo SDK 58, React Native 0.88, React 19, TypeScript (strict), Hermes, New Architecture |
| Routing | Expo Router |
| Styling | NativeWind v4 with semantic theme tokens |
| State and data | TanStack Query v5 persisted to MMKV, Zustand, live Firestore listeners |
| Backend | Firebase: Auth, Firestore, Storage, Cloud Functions (`asia-south1`), Remote Config, Messaging, Performance |
| Cloud Functions | TypeScript, `firebase-functions` 7, `firebase-admin` 14 |
| Push | OneSignal, sent from Cloud Functions only |
| Errors and analytics | Sentry, Mixpanel |
| Charts | Victory Native XL, `@shopify/react-native-skia` |
| Releases | Local Android release builds, EAS Update for over-the-air JavaScript updates |
| Quality | ESLint, Prettier, `tsc`, Jest, Firebase rules tests in the emulator, Maestro, Husky, commitlint |

## Architecture notes

- **Money is stored in integer minor units** (`amountMinor`, `balanceMinor`) next to the legacy `amount` and `balance`. Cloud Function triggers derive the new fields, so old app versions keep working. Splits divide in integer minor units so shares always add up to the total.
- **One query cache**: `DataSync` keeps live Firestore listeners that write into a TanStack Query cache, which is saved to MMKV so a cold start shows the last data, also offline. Screens only read the cache.
- **Server-side rules**: settlements, invitations, invite links, push, receipt scanning and user lookup go through callable functions. Budget alerts, recurring transactions, goal alerts and reminders run as triggers or scheduled functions.
- **Security rules** for Firestore and Storage live in `firebase/` with emulator tests.
- Project conventions are in [CLAUDE.md](CLAUDE.md), the quality gates in [docs/quality-baseline.md](docs/quality-baseline.md) and open work in [docs/roadmap.md](docs/roadmap.md).

## Folder structure

```
app/            Expo Router routes (route files wrap screens)
screens/        Screens, including SplitScreens/
src/            Shared code: components, data layer, hooks, services, theme, utils, types
components/     Older shared components
functions/      Cloud Functions (TypeScript) and their tests
firebase/       Firestore and Storage rules, indexes and rules tests
plugins/        Local Expo config plugins
scripts/        Release helpers
.maestro/       End-to-end flows
```

## Getting started

You need your own Firebase project and Google sign-in configuration. The app will not run against the original project.

Prerequisites: Node 24 (see `.nvmrc`), Yarn, Android Studio with JDK 17 or newer, and Xcode for iOS.

```bash
git clone https://github.com/chhedadhruv/TrackaExpense.git
cd TrackaExpense
yarn install
cp env.example .env     # fill in your own values
```

Put your Firebase config files in the repository root (they are gitignored and copied into the native projects on prebuild):

- `google-services.json` (Android)
- `GoogleService-Info.plist` (iOS)

Then run:

```bash
yarn android            # generates android/ with expo prebuild if needed
yarn ios
```

`android/` and `ios/` are generated by `yarn expo prebuild --clean` and are not committed. Release signing needs your own keystore in `credentials/android/`; see `plugins/with-release-signing.js`.

## Scripts

| Command | Description |
| --- | --- |
| `yarn start` | Start Metro (`yarn start:reset` clears the cache) |
| `yarn android`, `yarn ios` | Run debug builds |
| `yarn android:release`, `yarn ios:release` | Run release builds |
| `yarn lint` | ESLint |
| `yarn type-check` | TypeScript, must stay at 0 errors |
| `yarn test` | Jest unit tests |
| `yarn test:rules` | Firestore and Storage rules tests (emulator, JDK 21 or newer) |
| `yarn test:functions` | Cloud Functions unit tests |
| `yarn test:triggers` | Function trigger tests in the emulator |
| `yarn check:ratchet` | Compare lint, type and format counts with the baseline |
| `yarn build:android`, `yarn build:android:bundle` | Release APK or AAB |
| `yarn release:android:local` | Local production Android build with checks |

## Known limitations

- iOS has not been built or tested yet.
- Apple Sign-In is available on iOS only.
- Jest covers pure utilities; there are no component tests yet.
- Reading the SMS inbox is not built; bank messages are pasted in.

See [docs/roadmap.md](docs/roadmap.md) for the full list.

## Privacy

User data is stored in Firebase and protected by security rules. Receipt scanning sends the chosen photo to Google Cloud Vision, and notifications are sent through OneSignal. Nothing is sold. The in-app policy is in [screens/PrivacyPolicyScreen.tsx](screens/PrivacyPolicyScreen.tsx).

## License

MIT. See [LICENSE](LICENSE).

## Contact

**Dhruv Chheda** - [dhruvchheda.com](https://dhruvchheda.com) - me@dhruvchheda.com - [GitHub](https://github.com/chhedadhruv) - [LinkedIn](https://linkedin.com/in/dhruvchheda)
