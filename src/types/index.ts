import type {Timestamp} from '@react-native-firebase/firestore';
import type {McIconName} from './icons';

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
  createdAt: Timestamp;
  /** Firestore document ID (also available as `id` after client-side mapping) */
  id?: string;
  /** 'split' when this transaction was created via a split settlement */
  source?: string;
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
  icon: McIconName;
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

// ─── Navigation Param Lists ───────────────────────────────────────────────

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  PrivacyPolicy: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
  Transaction: undefined;
  TransactionDetail: {transaction: TransactionDocument};
  EditTransaction: {transaction: TransactionDocument};
  AddExpense: undefined;
  AddIncome: undefined;
  Image: {imageUrl: string};
};

export type SplitStackParamList = {
  Split: undefined;
  SplitGroupDetail:
    | {group: GroupDocument}
    | {groupId: string; groupName?: string};
  CreateSplit: {group: GroupDocument; split?: SplitDocument};
  SplitDetail: {
    split: SplitDocument;
    group: GroupDocument;
    transaction?: TransactionDocument;
  };
  SplitTransaction: {split: SplitDocument; group: GroupDocument};
  SplitHistory: {groupId: string};
  SettleUp: {
    group: GroupDocument;
    lendingDetails: LendingDetail[];
    preselect?: PreselectSettle;
  };
  FriendsBalance: undefined;
  Invitations: undefined;
  IOU: undefined;
  CreateIOU: {iou?: IOUDocument};
};

export type SavingsStackParamList = {
  Savings: undefined;
  SavingsHistory: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  PrivacyPolicy: undefined;
  ContactUs: undefined;
};
