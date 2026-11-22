# Analytics events

All product analytics go to Mixpanel through `src/services/AnalyticsService.ts` only. Errors go to Sentry through `reportError()`. Nothing is sent from a development build.

## Rules

- Event names are Title Case, and existing names never change (older app versions keep sending them).
- Properties are strings, numbers and booleans. Never send a name, email, title, description, exact amount, or any Firestore id. Amounts go through `getAmountRange()`.
- The user is identified by the Firebase uid only. IP geolocation is off.
- The Profile switch "Usage analytics" (Privacy) opts the person out; the choice is stored in its own MMKV file (`src/services/AnalyticsPrefs.ts`) and survives sign-out.
- Super properties on every event: `app`, `platform`, `app_version`, `build_number`.
- People-profile properties (`useAnalyticsProfile`): `currency`, `auth_method`, `has_savings_goals`, `savings_goal_count`, `app_lock_enabled`, `theme`, and `has_splits` (set when the person creates or joins a group).

## Events

| Area | Events |
| --- | --- |
| Auth | User Signed Up (email, google, apple), User Logged In (after email is verified), Password Reset Requested |
| Screens | Screen Viewed (`screen_name` from route segments, ids stay as `[id]`) |
| Transactions | Expense Added, Income Added, Transaction Edited, Transaction Deleted, Transactions Searched (`query_length`), Transaction Filter Changed, Data Exported |
| Capture | Receipt Scanned (`success`, `fields_filled`), Bank Message Parsed (`recognized`, `target`) |
| Statistics | Statistics Viewed, Statistics Range Changed |
| Budgets | Budget Created, Budget Edited, Budget Deleted |
| Recurring | Recurring Created, Recurring Edited, Recurring Deleted |
| Cards | Card Added, Card Deleted, Card Bill Paid |
| Savings | Savings Goal Created, Savings Goal Funded, Savings Goal Withdrawn, Savings Goal Deleted, Savings Goal Completed |
| Splits | Group Created, Group Member Invited, Split Created, Split Settled, Invitation Accepted, Invitation Declined, Invite Link Joined |
| IOUs | IOU Created, IOU Settled |
| Onboarding | Onboarding Started, Onboarding Completed, Onboarding Skipped (`step`) |
| Settings | Theme Changed, App Lock Toggled, Notification Pref Changed, Custom Category Created, Tag Added |

## Adding an event

1. Add a `log...` function to `AnalyticsService.ts` with typed properties.
2. Call it where the action succeeds (after the write, not before).
3. Add it to this table and to `__tests__/AnalyticsService.test.ts`.
4. Add a description in Mixpanel Lexicon.
