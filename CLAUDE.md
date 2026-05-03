# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run on device/simulator
npm run android          # Android debug
npm run ios              # iOS debug
npm run android:release  # Android release
npm run ios:release      # iOS release

# Metro bundler
npm start                # Start Metro
npm run start:reset      # Start Metro with cache reset

# Code quality
npm run lint             # ESLint
npm test                 # Jest (no tests currently written)

# Android builds
npm run build:android         # APK
npm run build:android:bundle  # AAB for Play Store
npm run build:clean           # Clean Gradle build

# iOS setup (after npm install)
cd ios && pod install
```

After modifying native code or changing dependencies that affect native modules, run `pod install` (iOS) or rebuild the native project entirely.

## Architecture

### Provider Stack (`navigation/index.js`)
App wraps everything in this order: `SafeAreaProvider → AuthProvider → CurrencyProvider → PaperProvider → Routes`

### Navigation (`navigation/`)
- `Routes.js` — watches `auth().onAuthStateChanged` and switches between `AuthStack` / `AppStack`
- `AuthStack.js` — Onboarding (first launch via AsyncStorage) → Login → Signup → ForgotPassword
- `AppStack.js` — BottomTabNavigator with 5 tabs, each with its own nested StackNavigator: **Home**, **Statistic**, **Split**, **Savings**, **Profile**

### Auth (`navigation/AuthProvider.js`)
Provides `AuthContext` with `login`, `register`, `logout`, `forgotPassword`. Email/password sign-in requires email verification before login is allowed. Google and Apple sign-in are handled separately in `utils/GoogleSignInConfig.js` and `utils/AppleSignInConfig.js`.

### Firestore Data Model
```
users/{uid}
  name, email, phone, currency (code string), balance (number), userImg, createdAt, verified

users/{uid}/transactions/{id}
  title, description, amount (number), type ('income'|'expense'), category,
  date (string "YYYY-MM-DD"), imageUrl?, createdAt (Timestamp)

groups/{id}
  name, members (string[] of emails), memberNames {email: name}, createdBy, createdAt

groups/{id}/splits/{id}
  title, amount, paidBy {email, name, userId}, splitType ('equal'|'percentage'),
  splitUsers [{email, name, userId, percentage?}], category, date (Timestamp), createdAt (Timestamp)

groups/{id}/splits/{id}/history/{id}    — audit trail per split
groups/{id}/splitHistory/{id}           — group-level history for all members

users/{uid}/savings/{id}
  name, targetAmount, currentAmount, history []
```

**Balance field**: `users/{uid}.balance` is a running all-time total maintained via `FieldValue.increment`. Updated on: add transaction (`AddExpense`/`AddIncome`), delete transaction (`TransactionDetailScreen`), edit transaction (`EditTransactionScreen`), settle up (`SettleUpScreen`). **Not** updated via batch recalculation — it's incremental only.

**Date handling**: Regular transactions store `date` as a plain string (`"YYYY-MM-DD"`). Splits store `date` as a Firestore `Timestamp`. Always use the `|| split.createdAt` fallback for older split records that predate the `date` field.

### Currency (`utils/CurrencyUtil.js`)
`CurrencyProvider` fetches the user's currency from Firestore once on mount and exposes `{ currency, setCurrency, formatAmount }` via `useCurrency()` hook. `formatAmount(amount)` uses `toLocaleString` with the user's locale for proper thousands separators and symbol. The standalone `formatCurrency(amount, code)` function exists for backwards compatibility without context.

`formatInputAmount(value)` — a local helper defined per-screen (duplicated in `AddExpense`, `AddIncome`, `EditTransactionScreen`, `CreateSplitScreen`) that adds comma separators to the TextInput display value. Raw numeric string is always stored in state; commas are stripped on `onChangeText`.

### Screens
All screens are plain JavaScript (`.js`), not TypeScript, despite `tsconfig.json` existing. `App.tsx` is the only TypeScript file.

**Colors are duplicated per screen** — each screen declares its own `PRIMARY_COLOR = '#677CD2'`, `BACKGROUND_COLOR = '#F4F6FA'`, `INCOME_COLOR = '#25B07F'`, `EXPENSE_COLOR = '#F64E4E'`. No shared theme file exists yet.

Key screen relationships:
- `HomeScreen` → navigates to `Transaction`, `AddIncome`, `AddExpense`; uses real-time `onSnapshot` for userData and one-time fetch for transactions
- `TransactionDetailScreen` → handles delete (updates balance) and navigates to `EditTransaction`
- `EditTransactionScreen` → updates transaction + adjusts balance delta atomically via `runTransaction`
- `SplitGroupDetailScreen` → fetches splits ordered by `date desc`; calculates who owes whom
- `CreateSplitScreen` → handles both create and edit mode (checks `route.params.split`)
- `AddOrRemoveExpense.js` — **appears unused**, not registered in any navigator

### Notifications (`services/`)
- `NotificationService.js` — initializes FCM, handles foreground/background/quit-state taps, navigates via `RootNavigation` (the `navigationRef` from `Routes.js`)
- `SplitNotificationService.js` — sends split-related push notifications via the Express notification server
- `ReminderNotificationService.js` / `FunNotificationService.js` — local Notifee-based reminders

Notification server lives in `server/notification-server.js` (Express + firebase-admin). URL configured via `NOTIFICATION_SERVER_URL` in `.env`.

### Environment Variables (`.env`)
Loaded via `react-native-dotenv`, imported as `import { VAR } from '@env'`. Required vars: `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `NOTIFICATION_SERVER_URL`. See `env.example` for the full list.

### Code Style
Prettier: single quotes, no bracket spacing, trailing commas, arrow parens avoided. ESLint extends `@react-native`. No pre-commit hooks.
