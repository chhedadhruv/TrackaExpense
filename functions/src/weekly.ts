import {DEFAULT_TIME_ZONE, todayInZone} from './budgets';
import {normalizeDate, resolveCurrency, type Fields} from './derive';

/** Local hour (24h) at which the summary goes out, on Sunday. */
export const SUMMARY_HOUR = 9;

export interface WeekRange {
  /** Stable id of the week, the Sunday it ends on: "2026-11-22". Used as the marker document id. */
  key: string;
  /** First and last day, inclusive, YYYY-MM-DD. Seven days ending on the Sunday. */
  start: string;
  end: string;
}

interface LocalMoment {
  date: string;
  hour: number;
  /** 0 is Sunday. */
  weekday: number;
}

/** The calendar date, hour and weekday of a moment in a time zone (default zone if invalid). */
export const localMoment = (nowMs: number, timeZone: string): LocalMoment => {
  const date = todayInZone(nowMs, timeZone);
  let hourText: string;
  try {
    hourText = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(nowMs));
  } catch {
    hourText = new Intl.DateTimeFormat('en-GB', {
      timeZone: DEFAULT_TIME_ZONE,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(nowMs));
  }
  const [y, m, d] = date.split('-').map(Number);
  return {
    date,
    hour: Number(hourText),
    weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
  };
};

const addDays = (day: string, days: number): string => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/**
 * The week to summarize when it is Sunday SUMMARY_HOUR in the user's zone, else null. The hourly
 * job calls this for every user; only the one hour of the week returns a range.
 */
export const weekToSummarize = (
  nowMs: number,
  timeZone: string,
): WeekRange | null => {
  const local = localMoment(nowMs, timeZone);
  if (local.weekday !== 0 || local.hour !== SUMMARY_HOUR) {
    return null;
  }
  return {key: local.date, start: addDays(local.date, -6), end: local.date};
};

export interface WeekSummary {
  spentMinor: number;
  earnedMinor: number;
  /** Expense transactions counted. */
  expenseCount: number;
  topCategory: string | null;
  topCategoryMinor: number;
}

/**
 * Totals for the week in integer minor units. Same exclusions as the budget alerts: settlements
 * are not spending or income, another currency or a missing amountMinor is left out.
 */
export const summarizeWeek = (
  currency: string,
  range: WeekRange,
  transactions: readonly Fields[],
): WeekSummary => {
  const summary: WeekSummary = {
    spentMinor: 0,
    earnedMinor: 0,
    expenseCount: 0,
    topCategory: null,
    topCategoryMinor: 0,
  };
  const byCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' && tx.type !== 'income') {
      continue;
    }
    // Settlements and a paid card bill are transfers; the card purchases counted when made.
    if (
      tx.isSettlement === true ||
      tx.category === 'Settlement' ||
      tx.source === 'card_payment' ||
      tx.source === 'balance_adjustment'
    ) {
      continue;
    }
    if (resolveCurrency(tx.currency) !== currency) {
      continue;
    }
    const minor = tx.amountMinor;
    if (typeof minor !== 'number' || !Number.isSafeInteger(minor)) {
      continue;
    }
    const day = normalizeDate(tx.dateISO) ?? normalizeDate(tx.date);
    if (day === null || day < range.start || day > range.end) {
      continue;
    }
    if (tx.type === 'income') {
      summary.earnedMinor += minor;
      continue;
    }
    summary.spentMinor += minor;
    summary.expenseCount += 1;
    const category =
      typeof tx.category === 'string' && tx.category !== ''
        ? tx.category
        : 'Other';
    byCategory.set(category, (byCategory.get(category) ?? 0) + minor);
  }
  // Ties go to the alphabetically first category so the text is stable.
  for (const [category, minor] of [...byCategory.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (minor > summary.topCategoryMinor) {
      summary.topCategory = category;
      summary.topCategoryMinor = minor;
    }
  }
  return summary;
};

/** True when the week had nothing worth a push. */
export const isQuietWeek = (summary: WeekSummary): boolean =>
  summary.spentMinor === 0 && summary.earnedMinor === 0;

export const MONTHLY_SUMMARY_DAY = 1;

/**
 * The calendar month to summarize when it is the 1st at SUMMARY_HOUR in the user's zone: the
 * month that just ended. `key` is "2026-10" (the month summarized).
 */
export const monthToSummarize = (
  nowMs: number,
  timeZone: string,
): WeekRange | null => {
  const local = localMoment(nowMs, timeZone);
  const [y, m, d] = local.date.split('-').map(Number);
  if (d !== MONTHLY_SUMMARY_DAY || local.hour !== SUMMARY_HOUR) {
    return null;
  }
  const last = addDays(local.date, -1);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const key = `${prev.getUTCFullYear()}-${String(
    prev.getUTCMonth() + 1,
  ).padStart(2, '0')}`;
  return {key, start: `${key}-01`, end: last};
};
