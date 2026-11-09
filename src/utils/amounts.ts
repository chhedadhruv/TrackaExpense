import {
  getCurrencyExponent,
  sumMinor,
  toMajorNumber,
  tryToMinor,
} from './money';

/**
 * App-side helpers for money stored on documents. Documents written by old apps only have the
 * legacy `amount` (a string or a float in major units); documents written by this app, and
 * documents filled in by the server (triggers and backfill), also have `amountMinor` (an integer
 * in minor units) and `currency`. These helpers read either shape, preferring the integer.
 */

export interface StoredMoney {
  amount?: unknown;
  amountMinor?: unknown;
  currency?: unknown;
}

const isSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

const isAmountValue = (value: unknown): value is string | number =>
  typeof value === 'string' || typeof value === 'number';

/** The old lenient reading (parseFloat), used only when a value cannot be converted exactly. */
const legacyNumber = (value: unknown): number => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
      ? parseFloat(value)
      : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Minor units of a stored document, in the given (current) currency: `amountMinor` when it is a
 * safe integer of the same exponent, else converted from the legacy `amount`. Returns null when
 * neither is usable (missing, not a number, or beyond the safe integer range).
 */
export const minorOf = (
  doc: StoredMoney,
  currencyCode: string,
): number | null => {
  const docCurrency =
    typeof doc.currency === 'string' && doc.currency !== ''
      ? doc.currency
      : currencyCode;
  if (
    isSafeInteger(doc.amountMinor) &&
    getCurrencyExponent(docCurrency) === getCurrencyExponent(currencyCode)
  ) {
    return doc.amountMinor;
  }
  return isAmountValue(doc.amount)
    ? tryToMinor(doc.amount, currencyCode)
    : null;
};

/** The amount in major units for display. Falls back to the old float reading if unconvertible. */
export const majorOf = (doc: StoredMoney, currencyCode: string): number => {
  const minor = minorOf(doc, currencyCode);
  return minor === null
    ? legacyNumber(doc.amount)
    : toMajorNumber(minor, currencyCode);
};

/**
 * Exact total of many documents in major units, summed as integers so that 0.1 + 0.2 is 0.3.
 * Documents whose amount cannot be converted are left out of the total.
 */
export const totalMajor = (
  docs: readonly StoredMoney[],
  currencyCode: string,
): number => {
  const minors: number[] = [];
  for (const doc of docs) {
    const minor = minorOf(doc, currencyCode);
    if (minor !== null) {
      minors.push(minor);
    }
  }
  try {
    return toMajorNumber(sumMinor(minors), currencyCode);
  } catch {
    // Only reachable for a total beyond 9e15 minor units; keep the screen usable.
    return (
      minors.reduce((sum, m) => sum + m, 0) /
      10 ** getCurrencyExponent(currencyCode)
    );
  }
};

/**
 * The new fields to store next to the legacy `amount` when the user saves a typed amount.
 * `amountMinor` is left out if the typed value cannot be converted (the server derives it, or
 * skips and reports it).
 */
export const transactionMoneyFields = (
  amountText: string,
  currencyCode: string,
): {amountMinor?: number; currency: string} => {
  const minor = tryToMinor(amountText, currencyCode);
  return minor === null
    ? {currency: currencyCode}
    : {amountMinor: minor, currency: currencyCode};
};

/**
 * How a transaction of this amount changes the user's running `balance` (major units): minus for
 * an expense, plus for an income. Always taken from the rounded minor amount, the same value the
 * screens show, so adding, editing and deleting the same transaction cancel out exactly even for
 * amounts typed with three or more decimals.
 */
export const balanceEffect = (
  type: 'income' | 'expense',
  source: StoredMoney,
  currencyCode: string,
): number => {
  const amount = majorOf(source, currencyCode);
  return type === 'expense' ? -amount : amount;
};

/**
 * The change to a user's running `balance` (in major units) when a transaction's amount is
 * edited, computed from integer minor units so there is no float subtraction noise. Returns null
 * when either amount cannot be converted; the caller then uses the old float calculation.
 */
export const editBalanceDelta = (
  existing: StoredMoney,
  type: 'income' | 'expense',
  newAmountText: string,
  currencyCode: string,
): number | null => {
  const oldMinor = minorOf(existing, currencyCode);
  const newMinor = tryToMinor(newAmountText, currencyCode);
  if (oldMinor === null || newMinor === null) {
    return null;
  }
  const deltaMinor =
    type === 'expense' ? oldMinor - newMinor : newMinor - oldMinor;
  return toMajorNumber(deltaMinor, currencyCode);
};

/**
 * Exact a + b or a - b of two amounts in major units (0.1 + 0.2 is 0.3). Falls back to the plain
 * float result only when a value cannot be converted or the result would leave the safe integer
 * range, so a screen never breaks on odd stored data.
 */
const combineMajor = (
  a: number,
  b: number,
  sign: 1 | -1,
  currencyCode: string,
): number => {
  const x = tryToMinor(a, currencyCode);
  const y = tryToMinor(b, currencyCode);
  if (x !== null && y !== null && Number.isSafeInteger(x + sign * y)) {
    return toMajorNumber(x + sign * y, currencyCode);
  }
  return a + sign * b;
};

export const addMajor = (a: number, b: number, currencyCode: string): number =>
  combineMajor(a, b, 1, currencyCode);

export const subtractMajor = (
  a: number,
  b: number,
  currencyCode: string,
): number => combineMajor(a, b, -1, currencyCode);

/**
 * Exact total of plain amount values (for example the current or target of every savings goal)
 * in major units. Values that are not numbers or cannot be converted are left out.
 */
export const sumValuesMajor = (
  values: readonly unknown[],
  currencyCode: string,
): number => {
  const minors: number[] = [];
  for (const value of values) {
    if (typeof value === 'number' || typeof value === 'string') {
      const minor = tryToMinor(value, currencyCode);
      if (minor !== null) {
        minors.push(minor);
      }
    }
  }
  try {
    return toMajorNumber(sumMinor(minors), currencyCode);
  } catch {
    return (
      minors.reduce((sum, m) => sum + m, 0) /
      10 ** getCurrencyExponent(currencyCode)
    );
  }
};

/**
 * The new fields to store next to the legacy amounts in a savings history entry for a deposit or
 * withdrawal. A minor value is left out when its amount cannot be converted.
 */
export const savingsHistoryMoneyFields = (
  entry: {amount: number; previousAmount: number; newAmount: number},
  currencyCode: string,
): Record<string, number | string> => {
  const fields: Record<string, number | string> = {currency: currencyCode};
  const pairs: Array<[string, number]> = [
    ['amountMinor', entry.amount],
    ['previousAmountMinor', entry.previousAmount],
    ['newAmountMinor', entry.newAmount],
  ];
  for (const [key, value] of pairs) {
    const minor = tryToMinor(value, currencyCode);
    if (minor !== null) {
      fields[key] = minor;
    }
  }
  return fields;
};
