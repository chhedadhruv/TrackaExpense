import type {TransactionDocument} from '../types';
import {minorOf} from './amounts';
import {tryToMinor} from './money';

/**
 * Budgets, `users/{uid}/budgets/{id}`. The same rules run on the server in
 * `functions/src/budgets.ts` (which raises the alerts); the two must agree on which transactions
 * count and where a period starts and ends, or the progress shown here would disagree with the
 * alerts. Money is an integer in minor units (`limitMinor`); spent is summed as integers.
 */

export const THRESHOLDS = [50, 80, 100, 120] as const;
export type Threshold = (typeof THRESHOLDS)[number];

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';
export const BUDGET_NAME_MAX = 40;

export interface BudgetDocument {
  id: string;
  name: string;
  /** One category, or null for all spending. */
  category: string | null;
  period: 'monthly' | 'custom';
  /** YYYY-MM-DD, custom budgets only. */
  startDate?: string;
  endDate?: string;
  limitMinor: number;
  currency: string;
  /** Which alerts are switched on. */
  thresholds: Record<Threshold, boolean>;
  enabled: boolean;
  /** The zone that decides which day it is, shared with the server. */
  timeZone: string;
}

export interface BudgetPeriod {
  /** First and last day, inclusive, YYYY-MM-DD. */
  start: string;
  end: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** "2025-5-4" becomes "2025-05-04"; null when it is not a real calendar date. */
export const normalizeIsoDate = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${pad(month)}-${pad(day)}`;
};

/** The device's time zone, or the default when it cannot be read. */
export const deviceTimeZone = (): string => {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE
    );
  } catch {
    return DEFAULT_TIME_ZONE;
  }
};

/** The calendar date (YYYY-MM-DD) in a time zone; the default zone if the zone is invalid. */
export const todayInZone = (now: Date, timeZone: string): string => {
  const format = (zone: string): string =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  try {
    return format(timeZone);
  } catch {
    return format(DEFAULT_TIME_ZONE);
  }
};

/**
 * The period to show: the calendar month containing `today` for a monthly budget, the saved
 * range for a custom one (even after it has ended, so its result stays visible). Null when a
 * custom budget has no usable range.
 */
export const budgetPeriod = (
  budget: Pick<BudgetDocument, 'period' | 'startDate' | 'endDate'>,
  today: string,
): BudgetPeriod | null => {
  if (budget.period === 'monthly') {
    const day = normalizeIsoDate(today);
    if (day === null) {
      return null;
    }
    const [year, month] = day.split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      start: `${year}-${pad(month)}-01`,
      end: `${year}-${pad(month)}-${pad(last)}`,
    };
  }
  const start = normalizeIsoDate(budget.startDate);
  const end = normalizeIsoDate(budget.endDate);
  return start !== null && end !== null && start <= end ? {start, end} : null;
};

/** Days left in the period including today; 0 once it has ended, null before it starts. */
export const daysLeft = (
  period: BudgetPeriod,
  today: string,
): number | null => {
  if (today < period.start) {
    return null;
  }
  if (today > period.end) {
    return 0;
  }
  const ms =
    Date.parse(`${period.end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86400000) + 1;
};

/**
 * Spent in the period, in integer minor units: expenses only, no settlements, only the budget's
 * currency, only the budget's category when it has one. A transaction whose amount cannot be
 * read is left out.
 */
export const spentMinorOf = (
  budget: Pick<BudgetDocument, 'category' | 'currency'>,
  period: BudgetPeriod,
  transactions: readonly TransactionDocument[],
): number => {
  let total = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense') {
      continue;
    }
    if (
      tx.category === 'Settlement' ||
      (tx as {isSettlement?: boolean}).isSettlement === true ||
      // A paid card bill is a transfer: the purchases counted on the day they were made.
      tx.source === 'card_payment' ||
      tx.source === 'balance_adjustment'
    ) {
      continue;
    }
    if (budget.category !== null && tx.category !== budget.category) {
      continue;
    }
    if (
      typeof tx.currency === 'string' &&
      tx.currency !== '' &&
      tx.currency !== budget.currency
    ) {
      continue;
    }
    const day = normalizeIsoDate(tx.dateISO) ?? normalizeIsoDate(tx.date);
    if (day === null || day < period.start || day > period.end) {
      continue;
    }
    const minor = minorOf(tx, budget.currency);
    if (minor !== null) {
      total += minor;
    }
  }
  return total;
};

export type BudgetState = 'ok' | 'warning' | 'over';

export interface BudgetProgress {
  spentMinor: number;
  limitMinor: number;
  /** Whole percent of the limit used, rounded down, can exceed 100. */
  percent: number;
  /** Limit minus spent; negative once over. */
  remainingMinor: number;
  state: BudgetState;
}

/** Percent is integer maths (spent * 100 / limit, rounded down), never a float ratio. */
export const progressOf = (
  spentMinor: number,
  limitMinor: number,
): BudgetProgress => {
  const percent =
    limitMinor > 0 ? Math.floor((spentMinor * 100) / limitMinor) : 0;
  return {
    spentMinor,
    limitMinor,
    percent,
    remainingMinor: limitMinor - spentMinor,
    state: percent >= 100 ? 'over' : percent >= 80 ? 'warning' : 'ok',
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads a stored budget; null when it cannot be used. Missing alert flags mean on. */
export const parseBudgetDoc = (
  id: string,
  data: unknown,
): BudgetDocument | null => {
  if (!isRecord(data)) {
    return null;
  }
  const limit = data.limitMinor;
  if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit <= 0) {
    return null;
  }
  const flags = isRecord(data.thresholds) ? data.thresholds : {};
  const thresholds = {} as Record<Threshold, boolean>;
  for (const t of THRESHOLDS) {
    thresholds[t] = flags[String(t)] !== false;
  }
  const budget: BudgetDocument = {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    category:
      typeof data.category === 'string' && data.category !== ''
        ? data.category
        : null,
    period: data.period === 'custom' ? 'custom' : 'monthly',
    startDate: typeof data.startDate === 'string' ? data.startDate : undefined,
    endDate: typeof data.endDate === 'string' ? data.endDate : undefined,
    limitMinor: limit,
    currency:
      typeof data.currency === 'string' &&
      /^[A-Za-z]{3}$/.test(data.currency.trim())
        ? data.currency.trim().toUpperCase()
        : 'INR',
    thresholds,
    enabled: data.enabled !== false,
    timeZone:
      typeof data.timeZone === 'string' && data.timeZone !== ''
        ? data.timeZone
        : DEFAULT_TIME_ZONE,
  };
  return budget.period === 'custom' && budgetPeriod(budget, '') === null
    ? null
    : budget;
};

export interface BudgetForm {
  name: string;
  category: string | null;
  period: 'monthly' | 'custom';
  startDate: string;
  endDate: string;
  /** What the user typed, in major units ("5000", "49.50"). */
  limitText: string;
  currency: string;
  thresholds: Record<Threshold, boolean>;
  enabled: boolean;
}

export type BudgetWrite =
  | {ok: true; data: Omit<BudgetDocument, 'id'>}
  | {ok: false; message: string};

/** Checks the form and turns it into the document to save. The limit is converted exactly. */
export const buildBudgetWrite = (
  form: BudgetForm,
  timeZone: string,
): BudgetWrite => {
  const name = form.name.trim();
  if (name.length > BUDGET_NAME_MAX) {
    return {
      ok: false,
      message: `The name can be at most ${BUDGET_NAME_MAX} characters.`,
    };
  }
  const limit =
    form.limitText.trim() === ''
      ? null
      : tryToMinor(form.limitText.trim(), form.currency);
  if (limit === null || limit <= 0) {
    return {ok: false, message: 'Enter a limit greater than zero.'};
  }
  let startDate: string | undefined;
  let endDate: string | undefined;
  if (form.period === 'custom') {
    const start = normalizeIsoDate(form.startDate);
    const end = normalizeIsoDate(form.endDate);
    if (start === null || end === null) {
      return {ok: false, message: 'Choose a start and an end date.'};
    }
    if (start > end) {
      return {
        ok: false,
        message: 'The end date must not be before the start date.',
      };
    }
    startDate = start;
    endDate = end;
  }
  const data: Omit<BudgetDocument, 'id'> = {
    name,
    category: form.category,
    period: form.period,
    limitMinor: limit,
    currency: form.currency,
    thresholds: {...form.thresholds},
    enabled: form.enabled,
    timeZone,
    ...(startDate !== undefined && endDate !== undefined
      ? {startDate, endDate}
      : {}),
  };
  return {ok: true, data};
};
