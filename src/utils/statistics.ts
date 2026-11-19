import {minorOf, type StoredMoney} from './amounts';

/**
 * Pure calculations behind the Statistics screen. Everything is summed in integer minor units
 * through `minorOf`, so every figure on the screen (cards, trend bars, category slices, merchants,
 * heatmap) adds up to the same total. A transaction whose amount cannot be converted is left out
 * of all of them, the same rule `totalMajor` uses. Days are plain "YYYY-MM-DD" strings and are
 * compared as text or as UTC day numbers, never through the device time zone.
 */

export type StatsRangeKey =
  | 'all'
  | '7days'
  | '30days'
  | '3months'
  | '6months'
  | 'year'
  | 'custom';

export type StatsKind = 'income' | 'expense';

export interface StatsTransaction extends StoredMoney {
  id?: string;
  type?: string;
  date?: string;
  dateISO?: string;
  category?: string;
  title?: string;
  /** 'card_payment' marks a paid card bill, a transfer that is not spending. */
  source?: unknown;
}

export interface DayRange {
  /** First day included, or null for no lower limit. */
  start: string | null;
  /** Last day included, or null for no upper limit. */
  end: string | null;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** "2025-5-4" and "2025-05-04T10:00" both become "2025-05-04"; anything else is null. */
export const normalizeDay = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
};

/** The transaction's day, preferring the server-normalised `dateISO`. */
export const dayOf = (t: StatsTransaction): string | null =>
  normalizeDay(t.dateISO) ?? normalizeDay(t.date);

const dayNumber = (key: string): number => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

const dayKeyFromNumber = (n: number): string => {
  const date = new Date(n * 86400000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
};

/** Day key of a local Date (the user's today). */
export const dayKeyOfDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Day key `days` before or after `key`. */
export const addDays = (key: string, days: number): string =>
  dayKeyFromNumber(dayNumber(key) + days);

/** The same calendar day `months` earlier, clamped to the end of a shorter month. */
const monthsBefore = (key: string, months: number): string => {
  const [y, m, d] = key.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(
    Math.min(d, lastDay),
  )}`;
};

/**
 * Days covered by a range, today included. "Last 7 days" is today and the six days before it.
 * Months-based ranges start the day after the same date N months ago, so "3 months" never covers
 * three months and one day.
 */
export const rangeBounds = (
  range: StatsRangeKey,
  today: string,
  custom?: {start: string | null; end: string | null},
): DayRange => {
  switch (range) {
    case 'all':
      return {start: null, end: null};
    case '7days':
      return {start: addDays(today, -6), end: today};
    case '30days':
      return {start: addDays(today, -29), end: today};
    case '3months':
      return {start: addDays(monthsBefore(today, 3), 1), end: today};
    case '6months':
      return {start: addDays(monthsBefore(today, 6), 1), end: today};
    case 'year':
      return {start: addDays(monthsBefore(today, 12), 1), end: today};
    case 'custom': {
      const start = normalizeDay(custom?.start);
      const end = normalizeDay(custom?.end);
      return start && end && start <= end
        ? {start, end}
        : {start: '9999-12-31', end: '0000-01-01'};
    }
  }
};

const inRange = (day: string, bounds: DayRange): boolean =>
  (bounds.start === null || day >= bounds.start) &&
  (bounds.end === null || day <= bounds.end);

/** Transactions whose day falls inside the range. Transactions with no usable day are dropped. */
export const filterByRange = <T extends StatsTransaction>(
  txns: readonly T[],
  bounds: DayRange,
): T[] =>
  txns.filter(t => {
    // A paid card bill and a balance adjustment only move money around: they are not spending or
    // income (see isTransferEntry in balanceAdjust.ts, which this mirrors).
    if (t.source === 'card_payment' || t.source === 'balance_adjustment') {
      return false;
    }
    const day = dayOf(t);
    return day !== null && inRange(day, bounds);
  });

/** Everything that is not income counts as an expense, as the screen always did. */
export const kindOf = (t: StatsTransaction): StatsKind =>
  t.type === 'income' ? 'income' : 'expense';

export interface Summary {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  count: number;
}

export const summarize = (
  txns: readonly StatsTransaction[],
  currency: string,
): Summary => {
  let incomeMinor = 0;
  let expenseMinor = 0;
  let count = 0;
  for (const t of txns) {
    const minor = minorOf(t, currency);
    if (minor === null) {
      continue;
    }
    count += 1;
    if (kindOf(t) === 'income') {
      incomeMinor += minor;
    } else {
      expenseMinor += minor;
    }
  }
  return {
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    count,
  };
};

/**
 * The period of equal length right before the range, for the "versus previous period" figure.
 * Null for all time and for an invalid custom range.
 */
export const previousBounds = (bounds: DayRange): DayRange | null => {
  if (bounds.start === null || bounds.end === null) {
    return null;
  }
  if (bounds.start > bounds.end) {
    return null;
  }
  const length = dayNumber(bounds.end) - dayNumber(bounds.start) + 1;
  return {
    start: addDays(bounds.start, -length),
    end: addDays(bounds.start, -1),
  };
};

/**
 * Percent change from `previous` to `current`, rounded to a whole number. Null when there is
 * nothing to compare with (previous is zero).
 */
export const percentChange = (
  current: number,
  previous: number,
): number | null =>
  previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

// ---------------------------------------------------------------------------------------------
// Trend

export type TrendInterval = 'daily' | 'weekly' | 'monthly';

export interface TrendBucket {
  /** First day of the bucket. */
  startDay: string;
  /** Last day of the bucket. */
  endDay: string;
  incomeMinor: number;
  expenseMinor: number;
}

/** Day buckets for up to a month, weekly up to four months, then monthly. */
export const trendIntervalFor = (spanDays: number): TrendInterval =>
  spanDays <= 31 ? 'daily' : spanDays <= 124 ? 'weekly' : 'monthly';

const MAX_BUCKETS: Record<TrendInterval, number> = {
  daily: 31,
  weekly: 18,
  monthly: 24,
};

const weekStart = (n: number): number => n - ((n + 3) % 7);

const monthStartKey = (key: string): string => `${key.slice(0, 7)}-01`;

const nextMonthKey = (key: string): string => {
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
};

const bucketStartOf = (day: string, interval: TrendInterval): string => {
  if (interval === 'daily') {
    return day;
  }
  if (interval === 'weekly') {
    return dayKeyFromNumber(weekStart(dayNumber(day)));
  }
  return monthStartKey(day);
};

const bucketEndOf = (start: string, interval: TrendInterval): string => {
  if (interval === 'daily') {
    return start;
  }
  if (interval === 'weekly') {
    return addDays(start, 6);
  }
  return addDays(nextMonthKey(start), -1);
};

const nextBucketStart = (start: string, interval: TrendInterval): string =>
  interval === 'daily'
    ? addDays(start, 1)
    : interval === 'weekly'
    ? addDays(start, 7)
    : nextMonthKey(start);

/**
 * Income and expense per bucket across the whole range, empty buckets included so the chart has
 * no gaps. Only the newest buckets are kept when the range is long. `txns` must already be
 * filtered to the range. For all time the series starts at the oldest transaction.
 */
export const trendBuckets = (
  txns: readonly StatsTransaction[],
  currency: string,
  bounds: DayRange,
  today: string,
): {interval: TrendInterval; buckets: TrendBucket[]} => {
  const days: {day: string; minor: number; kind: StatsKind}[] = [];
  for (const t of txns) {
    const day = dayOf(t);
    const minor = minorOf(t, currency);
    if (day !== null && minor !== null) {
      days.push({day, minor, kind: kindOf(t)});
    }
  }
  const first = days.reduce<string | null>(
    (min, d) => (min === null || d.day < min ? d.day : min),
    null,
  );
  const start = bounds.start ?? first;
  const end = bounds.end ?? today;
  if (start === null || start > end) {
    return {interval: 'daily', buckets: []};
  }
  const interval = trendIntervalFor(dayNumber(end) - dayNumber(start) + 1);

  const byStart = new Map<string, TrendBucket>();
  const order: string[] = [];
  let cursor = bucketStartOf(start, interval);
  const last = bucketStartOf(end, interval);
  while (cursor <= last) {
    byStart.set(cursor, {
      startDay: cursor,
      endDay: bucketEndOf(cursor, interval),
      incomeMinor: 0,
      expenseMinor: 0,
    });
    order.push(cursor);
    cursor = nextBucketStart(cursor, interval);
  }
  for (const d of days) {
    const bucket = byStart.get(bucketStartOf(d.day, interval));
    if (!bucket) {
      continue;
    }
    if (d.kind === 'income') {
      bucket.incomeMinor += d.minor;
    } else {
      bucket.expenseMinor += d.minor;
    }
  }
  const kept = order.slice(-MAX_BUCKETS[interval]);
  return {interval, buckets: kept.map(key => byStart.get(key)!)};
};

// ---------------------------------------------------------------------------------------------
// Category breakdown

export interface CategorySlice {
  category: string;
  minor: number;
  /** Whole percent; the slices of one breakdown add up to exactly 100. */
  percent: number;
  isOthers: boolean;
}

/** Whole percentages that add up to 100 (largest remainder), in the order of `parts`. */
export const wholePercents = (parts: readonly number[]): number[] => {
  const total = parts.reduce((sum, p) => sum + p, 0);
  if (total <= 0) {
    return parts.map(() => 0);
  }
  const exact = parts.map(p => (p / total) * 100);
  const floors = exact.map(Math.floor);
  let remaining = 100 - floors.reduce((sum, f) => sum + f, 0);
  const byRemainder = exact
    .map((value, index) => ({index, rest: value - Math.floor(value)}))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const {index} of byRemainder) {
    if (remaining <= 0) {
      break;
    }
    floors[index] += 1;
    remaining -= 1;
  }
  return floors;
};

/**
 * The biggest `topN` categories of one kind, with the rest folded into "Others" so the slices
 * add up to the whole.
 */
export const categoryBreakdown = (
  txns: readonly StatsTransaction[],
  kind: StatsKind,
  currency: string,
  topN = 5,
): {totalMinor: number; slices: CategorySlice[]} => {
  const byCategory = new Map<string, number>();
  let totalMinor = 0;
  for (const t of txns) {
    if (kindOf(t) !== kind) {
      continue;
    }
    const minor = minorOf(t, currency);
    if (minor === null) {
      continue;
    }
    const name = t.category?.trim() || 'Others';
    byCategory.set(name, (byCategory.get(name) ?? 0) + minor);
    totalMinor += minor;
  }
  if (totalMinor <= 0) {
    return {totalMinor: 0, slices: []};
  }
  const sorted = Array.from(byCategory.entries())
    .filter(([, minor]) => minor > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const head = sorted.slice(0, topN);
  const tail = sorted.slice(topN);
  const rows = head.map(([category, minor]) => ({category, minor}));
  const tailMinor = tail.reduce((sum, [, minor]) => sum + minor, 0);
  if (tailMinor > 0) {
    rows.push({category: 'Others', minor: tailMinor});
  }
  const sliceTotal = rows.reduce((sum, r) => sum + r.minor, 0);
  const percents = wholePercents(rows.map(r => r.minor));
  return {
    totalMinor: sliceTotal,
    slices: rows.map((row, index) => ({
      ...row,
      percent: percents[index],
      isOthers: tailMinor > 0 && index === rows.length - 1,
    })),
  };
};

// ---------------------------------------------------------------------------------------------
// Top merchants

export interface MerchantRow {
  /** Title as last written by the user. */
  name: string;
  minor: number;
  count: number;
}

const merchantKey = (title: string): string =>
  title.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Titles ranked by total amount. Transactions whose title differs only by case or spacing are
 * one merchant. `limit` of Infinity returns every merchant (used to check the total).
 */
export const topMerchants = (
  txns: readonly StatsTransaction[],
  kind: StatsKind,
  currency: string,
  limit = 5,
): MerchantRow[] => {
  const rows = new Map<string, MerchantRow & {latest: string}>();
  for (const t of txns) {
    if (kindOf(t) !== kind) {
      continue;
    }
    const minor = minorOf(t, currency);
    const title = t.title?.trim();
    if (minor === null || !title) {
      continue;
    }
    const key = merchantKey(title);
    const day = dayOf(t) ?? '';
    const row = rows.get(key);
    if (!row) {
      rows.set(key, {name: title, minor, count: 1, latest: day});
    } else {
      row.minor += minor;
      row.count += 1;
      if (day >= row.latest) {
        row.latest = day;
        row.name = title;
      }
    }
  }
  return Array.from(rows.values())
    .sort((a, b) => b.minor - a.minor || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({name, minor, count}) => ({name, minor, count}));
};

// ---------------------------------------------------------------------------------------------
// Payment method

export interface PaymentRow {
  /** The card id, or 'cash' for cash, UPI and bank payments. */
  key: string;
  name: string;
  minor: number;
  count: number;
}

/**
 * Spending (or income) split by how it was paid: one row per card plus Cash / UPI, largest first.
 * Summed in integer minor units over the same transactions as every other figure, so the rows add
 * up to the same total. `cardNames` maps card ids to the name shown; an unknown card is "Card".
 */
export const byPaymentMethod = (
  txns: readonly (StatsTransaction & {cardId?: unknown})[],
  kind: StatsKind,
  currency: string,
  cardNames: Readonly<Record<string, string>>,
): PaymentRow[] => {
  const rows = new Map<string, PaymentRow>();
  for (const t of txns) {
    if (kindOf(t) !== kind) {
      continue;
    }
    const minor = minorOf(t, currency);
    if (minor === null) {
      continue;
    }
    const card =
      typeof t.cardId === 'string' && t.cardId !== '' ? t.cardId : null;
    const key = card ?? 'cash';
    const row = rows.get(key);
    if (row) {
      row.minor += minor;
      row.count += 1;
    } else {
      rows.set(key, {
        key,
        name: card === null ? 'Cash / UPI' : cardNames[card] ?? 'Card',
        minor,
        count: 1,
      });
    }
  }
  return Array.from(rows.values()).sort(
    (a, b) => b.minor - a.minor || a.name.localeCompare(b.name),
  );
};

// ---------------------------------------------------------------------------------------------
// Heatmap

export interface HeatCell {
  day: string;
  minor: number;
  /** 0 for no activity, 1 to 4 for increasing amounts. */
  level: 0 | 1 | 2 | 3 | 4;
  /** False for days outside the range (shown blank). */
  inRange: boolean;
}

export interface Heatmap {
  /** Columns are weeks (oldest first); each has 7 cells, Monday first. */
  weeks: HeatCell[][];
  maxMinor: number;
  totalMinor: number;
}

const HEAT_MAX_WEEKS = 13;

const levelFor = (minor: number, max: number): HeatCell['level'] => {
  if (minor <= 0 || max <= 0) {
    return 0;
  }
  return Math.min(4, Math.max(1, Math.ceil((minor / max) * 4))) as
    | 1
    | 2
    | 3
    | 4;
};

/**
 * Daily totals of one kind laid out as weeks (Monday to Sunday), ending with the week that holds
 * the end of the range and at most 13 weeks long. `txns` must already be filtered to the range.
 */
export const dailyHeatmap = (
  txns: readonly StatsTransaction[],
  kind: StatsKind,
  currency: string,
  bounds: DayRange,
  today: string,
): Heatmap => {
  const perDay = new Map<string, number>();
  for (const t of txns) {
    if (kindOf(t) !== kind) {
      continue;
    }
    const day = dayOf(t);
    const minor = minorOf(t, currency);
    if (day !== null && minor !== null) {
      perDay.set(day, (perDay.get(day) ?? 0) + minor);
    }
  }
  const earliest = Array.from(perDay.keys()).reduce<string | null>(
    (min, d) => (min === null || d < min ? d : min),
    null,
  );
  const end = bounds.end ?? today;
  const start = bounds.start ?? earliest;
  if (start === null || start > end) {
    return {weeks: [], maxMinor: 0, totalMinor: 0};
  }
  const lastWeek = weekStart(dayNumber(end));
  const firstWeek = Math.max(
    weekStart(dayNumber(start)),
    lastWeek - (HEAT_MAX_WEEKS - 1) * 7,
  );
  let maxMinor = 0;
  let totalMinor = 0;
  const weeks: HeatCell[][] = [];
  for (let w = firstWeek; w <= lastWeek; w += 7) {
    const cells: HeatCell[] = [];
    for (let i = 0; i < 7; i += 1) {
      const day = dayKeyFromNumber(w + i);
      const visible = day >= start && day <= end;
      const minor = visible ? perDay.get(day) ?? 0 : 0;
      if (visible) {
        totalMinor += minor;
        maxMinor = Math.max(maxMinor, minor);
      }
      cells.push({day, minor, level: 0, inRange: visible});
    }
    weeks.push(cells);
  }
  for (const week of weeks) {
    for (const cell of week) {
      cell.level = levelFor(cell.minor, maxMinor);
    }
  }
  return {weeks, maxMinor, totalMinor};
};

/** The largest transactions of one kind, newest first on ties. */
export const largestTransactions = <T extends StatsTransaction>(
  txns: readonly T[],
  kind: StatsKind,
  currency: string,
  limit = 5,
): T[] =>
  txns
    .map(t => ({t, minor: minorOf(t, currency)}))
    .filter(
      (row): row is {t: T; minor: number} =>
        row.minor !== null && kindOf(row.t) === kind,
    )
    .sort(
      (a, b) =>
        b.minor - a.minor || (dayOf(b.t) ?? '').localeCompare(dayOf(a.t) ?? ''),
    )
    .slice(0, limit)
    .map(row => row.t);

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "12 Nov" for a day key. */
export const shortDayLabel = (key: string): string => {
  const [, m, d] = key.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1]}`;
};

/** "Nov 2026" for a day key. */
export const monthYearLabel = (key: string): string => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

/** Short x-axis label of a bucket: the day, the week's first day, or the month. */
export const bucketLabel = (
  bucket: TrendBucket,
  interval: TrendInterval,
): string => {
  if (interval === 'daily') {
    return shortDayLabel(bucket.startDay);
  }
  if (interval === 'weekly') {
    return shortDayLabel(bucket.startDay);
  }
  return MONTH_NAMES[Number(bucket.startDay.slice(5, 7)) - 1];
};

/** Longer label for the readout above the chart: "12 Nov", "6 Nov to 12 Nov", "Nov 2026". */
export const bucketTitle = (
  bucket: TrendBucket,
  interval: TrendInterval,
): string => {
  if (interval === 'daily') {
    return shortDayLabel(bucket.startDay);
  }
  if (interval === 'weekly') {
    return `${shortDayLabel(bucket.startDay)} to ${shortDayLabel(
      bucket.endDay,
    )}`;
  }
  return monthYearLabel(bucket.startDay);
};
