# TrackaExpense — Architecture Overview

## Provider Stack

Defined in `navigation/index.tsx`. Every screen is wrapped in this order:

```
SafeAreaProvider
  └── AuthProvider          (AuthContext — user session)
        └── CurrencyProvider  (CurrencyContext — symbol + formatAmount)
              └── PaperProvider  (Material Design theme)
                    └── Routes   (auth-state gate → AuthStack | AppStack)
```

Never add a provider outside this chain without also placing it here.

---

## Folder Structure

```
/TrackaExpense/
├── src/
│   ├── types/index.ts          ← all Firestore + shared TypeScript types
│   ├── constants/theme.ts      ← single source of truth for colors & fonts
│   ├── hooks/                  ← data-fetching custom hooks
│   │   ├── useUserData.ts
│   │   ├── useTransactions.ts
│   │   ├── useTransactionForm.ts
│   │   ├── useSavings.ts
│   │   └── useSplits.ts
│   ├── utils/formatters.ts     ← formatInputAmount, formatDisplayDate, todayAsYMD
│   └── components/             ← shared UI primitives
│       ├── CategorySelector.tsx
│       ├── AmountInput.tsx
│       ├── DateInput.tsx
│       └── ImagePickerModal.tsx
├── components/
│   ├── FormButton.tsx
│   └── FormInput.tsx
├── navigation/
│   ├── index.tsx               ← provider stack entry point
│   ├── Routes.tsx              ← auth-state switcher
│   ├── AppStack.tsx            ← BottomTabNavigator + 5 nested stacks
│   ├── AuthStack.tsx           ← Onboarding → Login → Signup → ForgotPassword
│   └── AuthProvider.tsx        ← AuthContext (login/register/logout/forgotPassword)
├── screens/
│   ├── HomeScreen.tsx
│   ├── TransactionScreen.tsx
│   ├── TransactionDetailScreen.tsx
│   ├── AddExpense.tsx
│   ├── AddIncome.tsx
│   ├── EditTransactionScreen.tsx
│   ├── StatisticScreen.tsx
│   ├── SavingsScreen.tsx
│   ├── SavingsHistoryScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── EditProfileScreen.tsx
│   ├── LoginScreen.tsx
│   ├── SignupScreen.tsx
│   ├── ForgotPasswordScreen.tsx
│   ├── OnboardingScreen.tsx
│   ├── ImageScreen.tsx
│   ├── ContactUsScreen.tsx
│   ├── PrivacyPolicyScreen.tsx
│   └── SplitScreens/
│       ├── SplitScreen.tsx
│       ├── SplitGroupDetailScreen.tsx
│       ├── CreateSplitScreen.tsx
│       ├── SplitDetailScreen.tsx
│       ├── SplitTransactionScreen.tsx
│       ├── SplitHistoryScreen.tsx
│       ├── SettleUpScreen.tsx
│       ├── FriendsBalanceScreen.tsx
│       ├── IOUScreen.tsx
│       ├── CreateIOUScreen.tsx
│       └── InvitationsScreen.tsx
├── services/
│   ├── NotificationService.ts
│   ├── SplitNotificationService.ts
│   ├── ReminderNotificationService.ts
│   ├── FunNotificationService.ts
│   └── UpdateService.ts
├── utils/
│   ├── CurrencyUtil.ts
│   ├── CategoryData.ts
│   ├── Dimentions.ts           ← typo preserved (imported as 'Dimentions' everywhere)
│   ├── Permissions.ts
│   ├── GoogleSignInConfig.ts
│   └── AppleSignInConfig.ts
└── server/
    └── notification-server.js  ← Express + firebase-admin push relay
```

---

## Theme Constants

**Always** import colors from `src/constants/theme.ts`. Never hard-code hex values in screens.

```ts
import {PRIMARY_COLOR, BACKGROUND_COLOR, INCOME_COLOR, EXPENSE_COLOR} from '../src/constants/theme';
```

| Constant | Value | Usage |
|---|---|---|
| `PRIMARY_COLOR` | `#677CD2` | Buttons, active states, brand accents |
| `BACKGROUND_COLOR` | `#F4F6FA` | Screen backgrounds |
| `INCOME_COLOR` | `#25B07F` | Positive/income values (aliased as `SUCCESS_COLOR` in split screens) |
| `EXPENSE_COLOR` | `#F64E4E` | Negative/expense values |

Split screens alias income green: `import {INCOME_COLOR as SUCCESS_COLOR} from '../../src/constants/theme'`

---

## TypeScript Types (`src/types/index.ts`)

Central registry for all Firestore document shapes. Import from here rather than redeclaring inline.

Key types:
- `UserDocument` — `users/{uid}` — includes `balance: number`
- `TransactionDocument` — `users/{uid}/transactions/{id}` — `date` is `string "YYYY-MM-DD"`
- `GroupDocument` — `groups/{id}`
- `SplitDocument` — `groups/{id}/splits/{id}` — `date` is Firestore `Timestamp`
- `SavingsGoal` — `users/{uid}/savings/{id}`
- `IOUDocument` — `users/{uid}/ious/{id}`
- `RootStackParamList` — navigation param types for all screens

---

## Firestore Data Model

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

groups/{id}/splits/{id}/history/{id}    ← audit trail per split
groups/{id}/splitHistory/{id}           ← group-level history for all members

users/{uid}/savings/{id}
  name, targetAmount, currentAmount, history []
```

---

## Critical Invariants

### 1. Balance — increment only, never recalculate

`users/{uid}.balance` is a running counter. **Only ever touch it with `FieldValue.increment`.**

```ts
firestore().collection('users').doc(uid).update({
  balance: firestore.FieldValue.increment(delta),
});
```

Screens that update balance: `AddExpense`, `AddIncome`, `EditTransactionScreen`, `TransactionDetailScreen` (delete), `SettleUpScreen`.

Never sum `transactions` collection to derive balance — it will diverge on concurrent writes.

### 2. Split date fallback

Older split records predate the `date` field. Always use:

```ts
const displayDate = split.date?.toDate() ?? split.createdAt.toDate();
```

This pattern must appear in every screen that renders a split date.

### 3. Date type duality

| Context | Type | Example |
|---|---|---|
| `TransactionDocument.date` | `string` | `"2024-03-15"` |
| `SplitDocument.date` | Firestore `Timestamp` | `.toDate()` to get `Date` |

Never store a Timestamp in a transaction's `date` field. Never store a string in a split's `date` field.

### 4. Currency formatting

Use `useCurrency()` → `formatAmount(value)` for all display amounts. This respects the user's locale and currency symbol.

`formatInputAmount` (from `src/utils/formatters`) is only for TextInput display — it formats the raw numeric string with comma separators while the user types.

### 5. Screen names are stable

Screen name strings in `AppStack.tsx` are referenced by deep-link config in `Routes.tsx` and by push notification payloads in `services/NotificationService.ts`. **Never rename a screen** without updating both.

---

## Custom Hooks (`src/hooks/`)

| Hook | Returns | Source |
|---|---|---|
| `useUserData()` | `{userData, loading, error, refresh}` | `onSnapshot` on `users/{uid}` |
| `useTransactions()` | `{transactions, loading, refetch}` | One-time fetch, `createdAt desc` |
| `useTransactionForm(initial?)` | form fields + `validateForm` + `resetForm` | In-memory form state |
| `useSavings()` | `{goals, loading, refetch}` | `users/{uid}/savings` |
| `useSplits(opts?)` | `{splits, loading, refetch}` | `groups/{id}/splits` if `groupId` passed |

Do **not** create a `useBalance` hook — balance comes from `useUserData().userData.balance`.

---

## Shared UI Components (`src/components/`)

| Component | Replaces | Props |
|---|---|---|
| `CategorySelector` | 40-line category modal in 5 screens | `categories, selectedCategory, onSelect, disabled?, placeholder?` |
| `AmountInput` | `inputWrapper` + currency symbol + TextInput in 6 screens | `value, onChangeText, currencySymbol, disabled?` |
| `DateInput` | date TouchableOpacity + DatePickerModal in 4 screens | `date, onConfirm, disabled?` |
| `ImagePickerModal` | camera/gallery Paper Modal in 2 screens | `visible, onDismiss, onImageSelected` |

---

## Formatters (`src/utils/formatters.ts`)

```ts
formatInputAmount(value: string | number): string
// Adds comma separators to TextInput value. Raw string stored in state; commas stripped on onChangeText.

formatDisplayDate(dateString: string | undefined): string
// "YYYY-MM-DD" → locale display string

todayAsYMD(): string
// Returns today as "YYYY-MM-DD"
```

---

## How to Add a New Screen

1. Create `screens/MyScreen.tsx`
2. Add it to `AppStack.tsx` (or `AuthStack.tsx`) with a `NativeStackScreenProps` type
3. Add the screen name to `RootStackParamList` in `src/types/index.ts`
4. If it shows transactions or user data, use `useUserData()` / `useTransactions()`
5. If it has an amount TextInput, use `<AmountInput>` from `src/components`
6. Import colors from `src/constants/theme` — never hard-code hex values

---

## Common Pitfalls

**Recalculating balance** — summing the transactions collection to set `balance`. Don't. Use `FieldValue.increment`.

**Missing split date fallback** — rendering `split.date.toDate()` without the `?.` + `?? split.createdAt.toDate()` fallback. Old records have no `date` field and this will crash.

**Hard-coded colors** — writing `'#677CD2'` in a screen instead of importing `PRIMARY_COLOR`. The grep check `grep -r "PRIMARY_COLOR\s*=" screens/` should return zero results.

**Local `formatInputAmount`** — copying the 7-line helper into a new screen instead of importing from `src/utils/formatters`. The grep check `grep -r "formatInputAmount" screens/` should return zero results.

**Currency via anything other than `useCurrency()`** — calling `toLocaleString` directly or using a hardcoded symbol. Always `const {formatAmount} = useCurrency()`.

**`Dimentions` typo** — the utility file is `utils/Dimentions.ts` (intentional — it's imported as `Dimentions` everywhere). Don't rename it.
