import type {Timestamp} from '@react-native-firebase/firestore';
import type {AppIcon} from './icons';

// ─── Firestore Documents ───────────────────────────────────────────────────

/**
 * users/{uid}
 * `balance` is an incremental counter updated via FieldValue.increment — never recalculate from transactions.
 */
export interface UserDocument {
  name: string;
  email: string;
  phone: string;
  /** ISO currency code, e.g. 'INR' */
  currency: string;
  /** Running total — incremental only, never recalculate */
  balance: number;
  userImg: string | null;
  createdAt: Timestamp;
  verified: boolean;
  /** Savings goals are embedded in the profile document, the client rewrites the whole array. */
  savingsGoals?: SavingsGoal[];
  /**
   * The evening reminder switch (Profile > Notifications). Only an explicit false is off; absent
   * on every older profile. Read it through `isFunNudgeOn` (`src/utils/notificationPrefs.ts`).
   */
  funNudgeEnabled?: boolean;
  /**
   * The card bill reminder switch (Profile > Notifications, shown while cards are on). Only an
   * explicit false is off; absent on every older profile. Read it through `isCardRemindersOn`.
   */
  cardRemindersEnabled?: boolean;
  /**
   * The device's IANA time zone (for example "Asia/Kolkata"), kept current by `useSyncTimeZone`.
   * The scheduled jobs in functions/ read it for each person's local time and assume Asia/Kolkata
   * when it is missing. Absent until the person has opened a version that writes it.
   */
  timeZone?: string;
}

/**
 * users/{uid}/transactions/{id}
 * `date` is always a plain "YYYY-MM-DD" string (not a Timestamp).
 */
export interface TransactionDocument {
  /** Firestore document ID (set after creation) */
  documentId?: string;
  userId: string;
  title: string;
  description: string;
  amount: string | number;
  /**
   * Integer minor units (paise, cents), the exact value. Written by this app and filled in by the
   * server for documents written by old apps; missing on documents not yet backfilled, so always
   * read it through `minorOf` in `src/utils/amounts.ts`, which falls back to `amount`.
   */
  amountMinor?: number;
  /** ISO currency code the amount is in; missing on older documents. */
  currency?: string;
  type: 'income' | 'expense';
  category: string;
  /** Plain string "YYYY-MM-DD" — not a Timestamp */
  date: string;
  /** Zero-padded copy of `date`, filled in by the server (older dates can be like "2025-5-4"). */
  dateISO?: string;
  imageUrl?: string | null;
  /** Alias used by some legacy writes */
  image?: string | null;
  /**
   * Free-text tags (at most 5, 24 characters each, distinct ignoring case). Missing on every
   * document written before tags existed; read through `sanitizeTags` in `src/utils/tags.ts`.
   */
  tags?: string[];
  createdAt: Timestamp;
  /** Firestore document ID (also available as `id` after client-side mapping) */
  id?: string;
  /** 'split' when this transaction was created via a split settlement; 'card_payment' for a paid card bill */
  source?: string;
  /**
   * The credit card (`users/{uid}/cards/{id}`) this was paid with; missing for cash, UPI or a bank
   * account and on every older document. Read through `cardIdOf` in `src/utils/cards.ts`.
   */
  cardId?: string | null;
  /** Role of the current user in a split transaction */
  splitRole?: 'payer' | 'participant' | 'settled';
}

// ─── Groups & Splits ──────────────────────────────────────────────────────

/** groups/{id} */
export interface GroupDocument {
  /** Firestore document ID */
  id: string;
  name: string;
  /** Array of member email addresses */
  members: string[];
  /** email → display name */
  memberNames: Record<string, string>;
  createdBy: string;
  createdAt: Timestamp;
  /** Group kind chosen when it was created (travel, home, ...). */
  category?: string;
  /** Emails invited but not yet joined. */
  pendingInvites?: string[];
  /** Member uids, derived by the server from `members`. Not read by the app yet. */
  memberIds?: string[];
}

export interface SplitUser {
  email: string;
  name: string;
  userId: string;
  percentage?: number;
}

/**
 * groups/{id}/splits/{id}
 * `date` is a Firestore Timestamp — always use `split.date?.toDate() ?? split.createdAt.toDate()` fallback
 * for older records that predate the `date` field.
 */
export interface SplitDocument {
  /** Firestore document ID */
  id: string;
  title: string;
  amount: number;
  paidBy: {email: string; name: string; userId: string};
  splitType: 'equal' | 'percentage';
  splitUsers: SplitUser[];
  category: string;
  /** Always a Timestamp; use `|| createdAt` fallback for legacy records */
  date: Timestamp;
  createdAt: Timestamp;
  type?: 'settlement';
  isSettlement?: boolean;
  notes?: string;
  imageUrl?: string;
  recurring?: {
    enabled: boolean;
    frequency: 'monthly' | 'weekly' | 'yearly';
  };
}

// ─── Savings ──────────────────────────────────────────────────────────────

export interface SavingsHistoryEntry {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  createdAt: Timestamp;
  goalName?: string;
}

/**
 * Stored inside users/{uid}.savingsGoals array.
 * Field names match the Firestore document exactly (current/target/monthly, not currentAmount/targetAmount).
 */
export interface SavingsGoal {
  id: string;
  name: string;
  description?: string;
  current: number;
  target: number;
  monthly: number;
  category: string;
  targetDate?: string;
  reminderEnabled: boolean;
  reminderFrequency: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** users/{uid}/savingsHistory/{id}: one entry per deposit, withdrawal or change to a goal. */
export interface SavingsHistoryDocument {
  id: string;
  type: 'deposit' | 'withdrawal' | 'create' | 'delete' | 'update';
  amount?: number;
  goalId?: string;
  goalName?: string;
  createdAt?: Timestamp;
}

// ─── IOU ──────────────────────────────────────────────────────────────────

export interface IOUDocument {
  id: string;
  fromEmail: string;
  toEmail: string;
  fromName: string;
  toName: string;
  amount: number;
  notes?: string;
  status: 'pending' | 'settled';
  createdAt: Timestamp;
}

// ─── Invitations ──────────────────────────────────────────────────────────

export interface InvitationDocument {
  id: string;
  email: string;
  groupId: string;
  groupName: string;
  invitedBy: string;
  inviterName?: string;
  inviterEmail?: string;
  status: 'pending' | 'accepted' | 'declined';
}

// ─── Currency & Category ──────────────────────────────────────────────────

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

export interface Category {
  value: string;
  label: string;
  icon: AppIcon;
}

// ─── Settle Up ────────────────────────────────────────────────────────────

export interface LendingDetail {
  email: string;
  name: string;
  userId: string;
  amount: number;
  owes: boolean;
}

export interface PreselectSettle {
  email: string;
  name: string;
  userId: string;
  amount: number;
}
