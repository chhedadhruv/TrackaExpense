import {tryToMinor} from './money';

/**
 * Pure derivations of the additive minor-unit fields from the legacy fields.
 *
 * Old installed apps keep writing only `amount`, `balance` and so on, so these functions are the
 * single place that turns those into `amountMinor` and friends. They never remove or change a
 * legacy field and they never throw on bad data: a value that cannot be converted is skipped and
 * reported, and the field is left unset.
 */

export type Fields = Record<string, unknown>;

export interface Derived {
  /** Fields to set (always the complete derived set, not only the changed ones). */
  fields: Fields;
  /** Names of legacy values that could not be converted (reported, never fatal). */
  skipped: string[];
}

export const DEFAULT_CURRENCY = 'INR';

/** First candidate that is a three-letter code (upper-cased), else the app default. */
export const resolveCurrency = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    if (
      typeof candidate === 'string' &&
      /^[A-Za-z]{3}$/.test(candidate.trim())
    ) {
      return candidate.trim().toUpperCase();
    }
  }
  return DEFAULT_CURRENCY;
};

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Adds `target` when `value` converts; absent values are ignored, bad ones are reported. */
const addMinor = (
  out: Derived,
  value: unknown,
  currency: string,
  name: string,
  target: string,
): void => {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    out.skipped.push(name);
    return;
  }
  const minor = tryToMinor(value, currency);
  if (minor === null) {
    out.skipped.push(name);
    return;
  }
  out.fields[target] = minor;
};

/** "2025-5-4" -> "2025-05-04"; null when it is not a real calendar date. */
export const normalizeDate = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${match[1]}-${pad(month)}-${pad(day)}`;
};

/** users/{uid}/transactions/{id}: currency, amountMinor, dateISO. */
export const deriveTransaction = (
  data: Fields,
  ownerCurrency: unknown,
): Derived => {
  const out: Derived = {fields: {}, skipped: []};
  const currency = resolveCurrency(data.currency, ownerCurrency);
  out.fields.currency = currency;
  addMinor(out, data.amount, currency, 'amount', 'amountMinor');
  if (data.date !== undefined && data.date !== null) {
    const iso = normalizeDate(data.date);
    if (iso === null) {
      out.skipped.push('date');
    } else {
      out.fields.dateISO = iso;
    }
  }
  return out;
};

/** A document with a single `amount`: groups/*\/splits, groups/*\/settlements, ious. */
export const deriveAmountDocument = (
  data: Fields,
  ownerCurrency: unknown,
): Derived => {
  const out: Derived = {fields: {}, skipped: []};
  const currency = resolveCurrency(data.currency, ownerCurrency);
  out.fields.currency = currency;
  addMinor(out, data.amount, currency, 'amount', 'amountMinor');
  return out;
};

/** users/{uid}/savingsHistory/{id}: amount, previousAmount and newAmount (goal events have none). */
export const deriveSavingsHistory = (
  data: Fields,
  ownerCurrency: unknown,
): Derived => {
  const out: Derived = {fields: {}, skipped: []};
  const currency = resolveCurrency(data.currency, ownerCurrency);
  addMinor(out, data.amount, currency, 'amount', 'amountMinor');
  addMinor(
    out,
    data.previousAmount,
    currency,
    'previousAmount',
    'previousAmountMinor',
  );
  addMinor(out, data.newAmount, currency, 'newAmount', 'newAmountMinor');
  if (Object.keys(out.fields).length > 0) {
    out.fields.currency = currency;
  }
  return out;
};

/**
 * users/{uid}: balanceMinor, and savingsGoalsMinor keyed by goal id.
 * The goals array itself is never rewritten (an old client could be writing it at the same
 * time); the minor-unit amounts live in a separate map instead.
 */
/**
 * `memberIds` of a group: the uid of every member email that belongs to an account, in the order
 * of `members`, without repeats. `uidsByMember` holds one entry per `members` item (undefined for
 * an email with no account). An email that cannot be resolved is reported as skipped under
 * "members"; the other members still get their uid. Groups without a `members` array get nothing.
 */
export const deriveGroup = (
  data: Fields,
  uidsByMember: ReadonlyArray<string | undefined>,
): Derived => {
  const out: Derived = {fields: {}, skipped: []};
  if (!Array.isArray(data.members)) {
    return out;
  }
  const ids: string[] = [];
  for (const uid of uidsByMember) {
    if (uid === undefined) {
      if (!out.skipped.includes('members')) {
        out.skipped.push('members');
      }
    } else if (!ids.includes(uid)) {
      ids.push(uid);
    }
  }
  out.fields.memberIds = ids;
  return out;
};

export const deriveUser = (data: Fields): Derived => {
  const out: Derived = {fields: {}, skipped: []};
  const currency = resolveCurrency(data.currency);
  addMinor(out, data.balance, currency, 'balance', 'balanceMinor');

  if (Array.isArray(data.savingsGoals)) {
    const map: Fields = {};
    for (const goal of data.savingsGoals) {
      if (!isRecord(goal) || typeof goal.id !== 'string' || goal.id === '') {
        out.skipped.push('savingsGoals.(no id)');
        continue;
      }
      const entry: Derived = {fields: {}, skipped: []};
      addMinor(
        entry,
        goal.current,
        currency,
        `savingsGoals.${goal.id}.current`,
        'currentMinor',
      );
      addMinor(
        entry,
        goal.target,
        currency,
        `savingsGoals.${goal.id}.target`,
        'targetMinor',
      );
      addMinor(
        entry,
        goal.monthly,
        currency,
        `savingsGoals.${goal.id}.monthly`,
        'monthlyMinor',
      );
      out.skipped.push(...entry.skipped);
      map[goal.id] = entry.fields;
    }
    out.fields.savingsGoalsMinor = map;
  }
  return out;
};

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every(key => deepEqual(a[key], b[key]));
  }
  return false;
};

/**
 * The subset of `derived` that differs from what the document already holds, or null when the
 * document is already up to date. Returning null is what stops a trigger from re-triggering
 * itself.
 */
export const changedFields = (
  existing: Fields,
  derived: Fields,
): Fields | null => {
  const changed: Fields = {};
  for (const [key, value] of Object.entries(derived)) {
    if (!deepEqual(existing[key], value)) {
      changed[key] = value;
    }
  }
  return Object.keys(changed).length > 0 ? changed : null;
};
