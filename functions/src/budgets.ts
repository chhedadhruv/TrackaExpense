import {normalizeDate, resolveCurrency, type Fields} from './derive';

/** Alert thresholds, in percent of the budget limit. Each budget switches them on or off. */
export const THRESHOLDS = [50, 80, 100, 120] as const;
export type Threshold = (typeof THRESHOLDS)[number];

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

export interface Budget {
  id: string;
  name: string;
  /** One category, or null for all spending. */
  category: string | null;
  /** 'monthly' follows the calendar month; 'custom' uses startDate..endDate. */
  period: 'monthly' | 'custom';
  startDate?: string;
  endDate?: string;
  limitMinor: number;
  currency: string;
  thresholds: Record<Threshold, boolean>;
  enabled: boolean;
  timeZone: string;
}

export interface BudgetPeriod {
  /** Stable text for the period, used in the alert document id: "2026-11" or "2026-11-01_2026-11-30". */
  key: string;
  /** First and last day, inclusive, as YYYY-MM-DD. */
  start: string;
  end: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Today's calendar date (YYYY-MM-DD) in a time zone; falls back to the default zone if invalid. */
export const todayInZone = (nowMs: number, timeZone: string): string => {
  const format = (zone: string): string =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(nowMs));
  try {
    return format(timeZone);
  } catch {
    return format(DEFAULT_TIME_ZONE);
  }
};

/** The period of the budget that contains `today`, or null when a custom period does not include it. */
export const periodFor = (
  budget: Pick<Budget, 'period' | 'startDate' | 'endDate'>,
  today: string,
): BudgetPeriod | null => {
  const day = normalizeDate(today);
  if (day === null) {
    return null;
  }
  if (budget.period === 'monthly') {
    const [year, month] = day.split('-').map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      key: `${year}-${pad(month)}`,
      start: `${year}-${pad(month)}-01`,
      end: `${year}-${pad(month)}-${pad(last)}`,
    };
  }
  const start = normalizeDate(budget.startDate);
  const end = normalizeDate(budget.endDate);
  if (start === null || end === null || start > end) {
    return null;
  }
  if (day < start || day > end) {
    return null;
  }
  return {key: `${start}_${end}`, start, end};
};

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads a budget document; null when it cannot be used (no positive integer limit, bad period). */
export const parseBudget = (id: string, data: unknown): Budget | null => {
  if (!isRecord(data)) {
    return null;
  }
  const limit = data.limitMinor;
  if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit <= 0) {
    return null;
  }
  const period = data.period === 'custom' ? 'custom' : 'monthly';
  const raw = isRecord(data.thresholds) ? data.thresholds : {};
  const thresholds = {} as Record<Threshold, boolean>;
  for (const t of THRESHOLDS) {
    // A missing flag means on: a budget saved without the flags still alerts.
    thresholds[t] = raw[String(t)] !== false;
  }
  const budget: Budget = {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    category:
      typeof data.category === 'string' && data.category !== ''
        ? data.category
        : null,
    period,
    startDate: typeof data.startDate === 'string' ? data.startDate : undefined,
    endDate: typeof data.endDate === 'string' ? data.endDate : undefined,
    limitMinor: limit,
    currency: resolveCurrency(data.currency),
    thresholds,
    enabled: data.enabled !== false,
    timeZone:
      typeof data.timeZone === 'string' && data.timeZone !== ''
        ? data.timeZone
        : DEFAULT_TIME_ZONE,
  };
  if (
    period === 'custom' &&
    periodFor(budget, budget.startDate ?? '') === null
  ) {
    return null;
  }
  return budget;
};

/** The calendar date of a transaction, preferring the derived dateISO. */
const dateOf = (tx: Fields): string | null =>
  normalizeDate(tx.dateISO) ?? normalizeDate(tx.date);

/**
 * Total spent in the period, in integer minor units. Only expenses count; settlements are not
 * spending; a transaction in another currency or without a derived amountMinor is left out.
 */
export const spentMinor = (
  budget: Pick<Budget, 'category' | 'currency'>,
  period: BudgetPeriod,
  transactions: readonly Fields[],
): number => {
  let total = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense') {
      continue;
    }
    if (tx.isSettlement === true || tx.category === 'Settlement') {
      continue;
    }
    if (budget.category !== null && tx.category !== budget.category) {
      continue;
    }
    if (resolveCurrency(tx.currency) !== budget.currency) {
      continue;
    }
    const minor = tx.amountMinor;
    if (typeof minor !== 'number' || !Number.isSafeInteger(minor)) {
      continue;
    }
    const day = dateOf(tx);
    if (day === null || day < period.start || day > period.end) {
      continue;
    }
    total += minor;
  }
  return total;
};

/** Switched-on thresholds reached by `spent`, lowest first. 100 percent means spent >= limit. */
export const crossedThresholds = (
  budget: Pick<Budget, 'limitMinor' | 'thresholds'>,
  spent: number,
): Threshold[] =>
  THRESHOLDS.filter(
    // Integer comparison: spent * 100 >= limit * t, no float percentages.
    t => budget.thresholds[t] && spent * 100 >= budget.limitMinor * t,
  );

/** Id of the alert document: one per budget, period and threshold. */
export const alertId = (
  budgetId: string,
  period: BudgetPeriod,
  threshold: Threshold,
): string => `${budgetId}_${period.key}_${threshold}`;
