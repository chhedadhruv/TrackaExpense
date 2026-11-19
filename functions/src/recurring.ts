import {DEFAULT_TIME_ZONE} from './budgets';
import {normalizeDate, resolveCurrency, type Fields} from './derive';
import {fromMinor} from './money';

export {DEFAULT_TIME_ZONE, todayInZone} from './budgets';

export const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** An occurrence more than this many days late is skipped, not created (owner's decision). */
export const LATE_DAYS = 3;
/** Hard stop for the date loops, so a bad rule can never spin. */
const MAX_STEPS = 20000;
export const TITLE_MAX = 100;

export interface RecurringRule {
  id: string;
  title: string;
  description: string;
  type: 'expense' | 'income';
  category: string;
  amountMinor: number;
  currency: string;
  frequency: Frequency;
  /** First occurrence, YYYY-MM-DD. The day of month for monthly and yearly rules comes from it. */
  startDate: string;
  /** Last day an occurrence may fall on, or null for no end. */
  endDate: string | null;
  /** The next occurrence not yet handled. */
  nextDueDate: string;
  timeZone: string;
  enabled: boolean;
  tags: string[];
  /** Credit card the expenses are paid with, or null. A card expense does not move the balance. */
  cardId: string | null;
}

const pad = (n: number): string => String(n).padStart(2, '0');

const toDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const fromDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;

export const addDays = (iso: string, days: number): string => {
  const date = toDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromDate(date);
};

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * The n-th occurrence of a rule (n = 0 is the start date). Monthly and yearly rules keep the start
 * date's day and use the last day of a shorter month (the 31st becomes the 28th, 29th or 30th), so
 * a month never drifts: January 31, February 28, March 31.
 */
export const occurrenceAt = (
  rule: Pick<RecurringRule, 'frequency' | 'startDate'>,
  n: number,
): string => {
  const [year, month, day] = rule.startDate.split('-').map(Number);
  if (rule.frequency === 'weekly') {
    return addDays(rule.startDate, 7 * n);
  }
  const monthsToAdd = rule.frequency === 'monthly' ? n : 12 * n;
  const index = month - 1 + monthsToAdd;
  const y = year + Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${pad(m)}-${pad(Math.min(day, daysInMonth(y, m)))}`;
};

/** The first occurrence strictly after `date`. */
export const occurrenceAfter = (
  rule: Pick<RecurringRule, 'frequency' | 'startDate'>,
  date: string,
): string => {
  for (let n = 0; n < MAX_STEPS; n += 1) {
    const candidate = occurrenceAt(rule, n);
    if (candidate > date) {
      return candidate;
    }
  }
  return occurrenceAt(rule, MAX_STEPS);
};

/** The first occurrence on or after `date` (a new rule starting in the past begins here). */
export const occurrenceFrom = (
  rule: Pick<RecurringRule, 'frequency' | 'startDate'>,
  date: string,
): string => occurrenceAfter(rule, addDays(date, -1));

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads a rule document; null when it cannot be used. */
export const parseRule = (id: string, data: unknown): RecurringRule | null => {
  if (!isRecord(data)) {
    return null;
  }
  const amount = data.amountMinor;
  if (
    typeof amount !== 'number' ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    return null;
  }
  if (data.type !== 'expense' && data.type !== 'income') {
    return null;
  }
  const frequency = FREQUENCIES.find(f => f === data.frequency);
  const startDate = normalizeDate(data.startDate);
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (!frequency || startDate === null || title === '') {
    return null;
  }
  const endDate =
    data.endDate === undefined || data.endDate === null || data.endDate === ''
      ? null
      : normalizeDate(data.endDate);
  if (endDate !== null && endDate < startDate) {
    return null;
  }
  if (data.endDate && endDate === null) {
    return null;
  }
  const nextDueDate =
    data.nextDueDate === undefined
      ? startDate
      : normalizeDate(data.nextDueDate);
  if (nextDueDate === null) {
    return null;
  }
  return {
    id,
    title: title.slice(0, TITLE_MAX),
    description:
      typeof data.description === 'string' ? data.description.trim() : '',
    type: data.type,
    category: typeof data.category === 'string' ? data.category : '',
    amountMinor: amount,
    currency: resolveCurrency(data.currency),
    frequency,
    startDate,
    endDate,
    nextDueDate,
    timeZone:
      typeof data.timeZone === 'string' && data.timeZone !== ''
        ? data.timeZone
        : DEFAULT_TIME_ZONE,
    enabled: data.enabled !== false,
    tags: Array.isArray(data.tags)
      ? data.tags.filter((t): t is string => typeof t === 'string').slice(0, 5)
      : [],
    cardId:
      data.type === 'expense' &&
      typeof data.cardId === 'string' &&
      data.cardId !== ''
        ? data.cardId
        : null,
  };
};

export interface RunPlan {
  /** Occurrence dates to create, oldest first (at most LATE_DAYS late). */
  create: string[];
  /** Occurrences passed over because they were too late. */
  skipped: string[];
  /** Where the rule continues; unchanged when nothing is due yet. */
  nextDueDate: string;
  /** True once no occurrence is left before the end date. */
  finished: boolean;
}

/**
 * Works out what a run does for a rule on `today` (the date in the rule's own time zone):
 * occurrences up to and including today that fall within the last LATE_DAYS days are created, older
 * ones are skipped, and the rule moves to the first occurrence after today. A rule whose next
 * occurrence is after its end date is finished.
 */
export const planRun = (rule: RecurringRule, today: string): RunPlan => {
  const plan: RunPlan = {
    create: [],
    skipped: [],
    nextDueDate: rule.nextDueDate,
    finished: false,
  };
  const earliest = addDays(today, -LATE_DAYS);
  let due = rule.nextDueDate;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (rule.endDate !== null && due > rule.endDate) {
      plan.finished = true;
      break;
    }
    if (due > today) {
      break;
    }
    (due >= earliest ? plan.create : plan.skipped).push(due);
    due = occurrenceAfter(rule, due);
  }
  plan.nextDueDate = due;
  return plan;
};

/** Id of the transaction an occurrence creates: the same rule and date can only ever make one. */
export const recurringTransactionId = (ruleId: string, date: string): string =>
  `rec_${ruleId}_${date}`;

/**
 * The transaction document for one occurrence, shaped like one the app writes (legacy `amount` as
 * text, `amountMinor`, `currency`, a "YYYY-MM-DD" `date`) plus `source` and `recurringId`.
 */
export const buildTransaction = (
  rule: RecurringRule,
  uid: string,
  date: string,
  id: string,
): Fields => ({
  userId: uid,
  documentId: id,
  title: rule.title,
  description: rule.description,
  amount: fromMinor(rule.amountMinor, rule.currency),
  amountMinor: rule.amountMinor,
  currency: rule.currency,
  category: rule.category,
  date,
  type: rule.type,
  source: 'recurring',
  recurringId: rule.id,
  ...(rule.tags.length > 0 ? {tags: rule.tags} : {}),
  ...(rule.cardId !== null ? {cardId: rule.cardId} : {}),
});
