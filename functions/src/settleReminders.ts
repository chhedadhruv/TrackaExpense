import {resolveCurrency, type Fields} from './derive';
import {allocateMinor, getCurrencyExponent} from './money';

/** A user does not hear about less than one whole unit owed (the old server's sub-unit rule). */
export const SETTLE_COOLDOWN_DAYS = 13;
/** Sunday, local hour at which reminders go out. */
export const SETTLE_HOUR = 10;

export interface Debt {
  borrower: string;
  lender: string;
  minor: number;
  currency: string;
}

const emailOf = (person: unknown): string => {
  const email =
    typeof person === 'object' && person !== null
      ? (person as Fields).email
      : undefined;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

const isSafe = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

const shares = (split: Fields, users: readonly Fields[]): number[] | null => {
  if (!isSafe(split.amountMinor) || users.length === 0) {
    return null;
  }
  const weights =
    split.splitType === 'percentage'
      ? users.map(u => Math.max(0, Number(u.percentage ?? 0) || 0))
      : users.map(() => 1);
  if (weights.every(w => w === 0)) {
    return users.map(() => 0);
  }
  return allocateMinor(split.amountMinor, weights);
};

/**
 * Who owes whom in one group, per currency, in integer minor units. Mirrors the app's
 * `calculateNetLendingBalances` (src/utils/lending.ts): one signed total per pair of people,
 * settlement entries reduce what the payer owes, shares come from the largest remainder method.
 * A split without a derived `amountMinor` is left out.
 */
export const netDebts = (splits: readonly Fields[]): Debt[] => {
  // key: currency|first|second, signed: positive means the second owes the first.
  const pairs = new Map<string, number>();
  const add = (
    currency: string,
    lender: string,
    borrower: string,
    minor: number,
  ): void => {
    const lenderFirst = lender < borrower;
    const key = lenderFirst
      ? `${currency}|${lender}|${borrower}`
      : `${currency}|${borrower}|${lender}`;
    pairs.set(key, (pairs.get(key) ?? 0) + (lenderFirst ? minor : -minor));
  };

  for (const split of splits) {
    const currency = resolveCurrency(split.currency);
    const paidBy = emailOf(split.paidBy);
    const users = Array.isArray(split.splitUsers)
      ? (split.splitUsers as Fields[])
      : [];
    if (split.type === 'settlement' || split.isSettlement === true) {
      const to = emailOf(users[0]);
      if (!paidBy || !to || paidBy === to || !isSafe(split.amountMinor)) {
        continue;
      }
      add(currency, to, paidBy, -split.amountMinor);
      continue;
    }
    const parts = shares(split, users);
    if (!paidBy || parts === null) {
      continue;
    }
    users.forEach((u, i) => {
      const email = emailOf(u);
      if (email && email !== paidBy) {
        add(currency, paidBy, email, parts[i]);
      }
    });
  }

  const result: Debt[] = [];
  for (const [key, net] of pairs) {
    if (net === 0) {
      continue;
    }
    const [currency, first, second] = key.split('|');
    result.push({
      currency,
      lender: net > 0 ? first : second,
      borrower: net > 0 ? second : first,
      minor: Math.abs(net),
    });
  }
  return result;
};

export interface Owed {
  total: number;
  count: number;
}

/**
 * What each person owes in each currency, from group debts and pending IOUs (`fromEmail` owes
 * `amountMinor`). Key: email, then currency.
 */
export const owedByPerson = (
  debts: readonly Debt[],
  ious: readonly Fields[],
): Map<string, Map<string, Owed>> => {
  const out = new Map<string, Map<string, Owed>>();
  const add = (email: string, currency: string, minor: number): void => {
    if (!email || minor <= 0) {
      return;
    }
    const perCurrency = out.get(email) ?? new Map<string, Owed>();
    const owed = perCurrency.get(currency) ?? {total: 0, count: 0};
    owed.total += minor;
    owed.count += 1;
    perCurrency.set(currency, owed);
    out.set(email, perCurrency);
  };
  for (const d of debts) {
    add(d.borrower, d.currency, d.minor);
  }
  for (const iou of ious) {
    if (isSafe(iou.amountMinor)) {
      const from =
        typeof iou.fromEmail === 'string'
          ? iou.fromEmail.trim().toLowerCase()
          : '';
      add(from, resolveCurrency(iou.currency), iou.amountMinor);
    }
  }
  return out;
};

/** True when `total` is at least one whole unit of the currency. */
export const worthReminding = (total: number, currency: string): boolean =>
  total >= 10 ** getCurrencyExponent(currency);
