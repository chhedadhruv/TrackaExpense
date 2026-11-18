import {minorOf, type StoredMoney} from './amounts';
import {normalizeIsoDate} from './budgets';
import {daysBetween} from './cardPeriods';
import {tryToMinor} from './money';

/**
 * Catching up after a gap. When someone stops adding entries by hand but money keeps arriving from
 * splits and settle-ups, the running balance drifts from what they really have. Instead of
 * editing the balance (which would invent income or expense), they say what the balance is now and
 * the app records one "Balance adjustment" transaction for the difference. It moves the balance
 * only: Statistics, Home totals, budgets and the summaries leave it out, like a paid card bill.
 */

export const BALANCE_ADJUSTMENT_SOURCE = 'balance_adjustment';
export const BALANCE_ADJUSTMENT_CATEGORY = 'Balance adjustment';
/** How many days without a hand-made entry (while splits kept adding some) before we ask. */
export const CATCH_UP_GAP_DAYS = 14;
/** After "Not now", the prompt stays away this many days (a new split entry does not bring it back sooner). */
export const CATCH_UP_SNOOZE_DAYS = 7;

export interface AdjustTransaction extends StoredMoney {
  type?: string;
  source?: unknown;
  splitRole?: unknown;
  category?: string;
  isSettlement?: unknown;
  date?: string;
  dateISO?: string;
  title?: string;
  id?: string;
}

export const isBalanceAdjustment = (tx: {source?: unknown}): boolean =>
  tx.source === BALANCE_ADJUSTMENT_SOURCE;

/** True for entries that are not spending or income by themselves: they only move money around. */
export const isTransferEntry = (tx: {source?: unknown}): boolean =>
  tx.source === BALANCE_ADJUSTMENT_SOURCE || tx.source === 'card_payment';

/** An entry that came from a split or a settle-up rather than being added by hand. */
export const isSplitCreated = (tx: AdjustTransaction): boolean =>
  tx.source === 'split' ||
  tx.splitRole !== undefined ||
  tx.category === 'Settlement' ||
  tx.isSettlement === true;

/** An entry the person added or edited themselves. */
export const isHandMade = (tx: AdjustTransaction): boolean =>
  !isSplitCreated(tx) && tx.source !== 'recurring' && !isTransferEntry(tx);

const dayOfTx = (tx: AdjustTransaction): string | null =>
  normalizeIsoDate(tx.dateISO) ?? normalizeIsoDate(tx.date);

export interface CatchUp {
  /** Day of the last hand-made entry or earlier adjustment, or null when there never was one. */
  lastResetDay: string | null;
  /** Split-created entries after that day, newest first. */
  splitEntries: AdjustTransaction[];
  /** Whole days from the last reset (or the first split entry) to today. */
  gapDays: number;
}

/**
 * What arrived from splits since the person last did anything by hand. Returns null when there is
 * nothing to catch up on (no split-created entries after the last reset).
 */
export const catchUpOf = (
  transactions: readonly AdjustTransaction[],
  today: string,
): CatchUp | null => {
  let lastReset: string | null = null;
  for (const tx of transactions) {
    if (!isHandMade(tx) && !isBalanceAdjustment(tx)) {
      continue;
    }
    const day = dayOfTx(tx);
    if (day !== null && (lastReset === null || day > lastReset)) {
      lastReset = day;
    }
  }
  const entries: {tx: AdjustTransaction; day: string}[] = [];
  for (const tx of transactions) {
    if (!isSplitCreated(tx)) {
      continue;
    }
    const day = dayOfTx(tx);
    if (day !== null && (lastReset === null || day > lastReset)) {
      entries.push({tx, day});
    }
  }
  if (entries.length === 0) {
    return null;
  }
  entries.sort((a, b) => b.day.localeCompare(a.day));
  const reference = lastReset ?? entries[entries.length - 1].day;
  return {
    lastResetDay: lastReset,
    splitEntries: entries.map(e => e.tx),
    gapDays: Math.max(0, daysBetween(reference, today)),
  };
};

/**
 * Whether Home should ask "Is your balance still right?": a long enough gap with split entries in
 * it, and the person has not said "Not now" recently.
 */
export const shouldPromptCatchUp = (
  catchUp: CatchUp | null,
  today: string,
  snoozedOn: string | null,
): boolean => {
  if (catchUp === null || catchUp.gapDays < CATCH_UP_GAP_DAYS) {
    return false;
  }
  if (
    snoozedOn !== null &&
    daysBetween(snoozedOn, today) < CATCH_UP_SNOOZE_DAYS
  ) {
    return false;
  }
  return true;
};

export interface Adjustment {
  /** Positive when the real balance is higher than the app's. */
  deltaMinor: number;
  type: 'income' | 'expense';
  /** The size of the difference, always positive. */
  amountMinor: number;
}

/**
 * The difference between what the person says the balance is and what the app has, in integer
 * minor units; null when either cannot be read or there is nothing to change.
 */
export const adjustmentFor = (
  currentBalance: unknown,
  actualBalanceText: string,
  currencyCode: string,
): Adjustment | null => {
  if (
    typeof currentBalance !== 'number' &&
    typeof currentBalance !== 'string'
  ) {
    return null;
  }
  const current = tryToMinor(currentBalance, currencyCode);
  const actual = tryToMinor(actualBalanceText, currencyCode);
  if (current === null || actual === null) {
    return null;
  }
  const deltaMinor = actual - current;
  if (deltaMinor === 0) {
    return null;
  }
  return {
    deltaMinor,
    type: deltaMinor > 0 ? 'income' : 'expense',
    amountMinor: Math.abs(deltaMinor),
  };
};

/** Money of an entry in the person's currency, for listing it. */
export const entryMinor = (
  tx: AdjustTransaction,
  currencyCode: string,
): number => minorOf(tx, currencyCode) ?? 0;
