import {normalizeIsoDate} from './budgets';
import {tryToMinor} from './money';

/**
 * Recurring rules, `users/{uid}/recurring/{id}`. A scheduled function on the server creates the
 * transactions (`functions/src/recurring.ts` and `recurringJob.ts`); the date rules here must
 * match it, or the "next date" shown would disagree with what the job does.
 */

export const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
};

export const RECURRING_TITLE_MAX = 100;
const MAX_STEPS = 20000;

export interface RecurringDocument {
  id: string;
  title: string;
  description: string;
  type: 'expense' | 'income';
  category: string;
  amountMinor: number;
  currency: string;
  frequency: Frequency;
  startDate: string;
  endDate: string | null;
  /** The next occurrence the server has not handled yet. */
  nextDueDate: string;
  timeZone: string;
  enabled: boolean;
  finished: boolean;
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

/** The n-th occurrence (0 is the start date); monthly and yearly keep the day, clamped. */
export const occurrenceAt = (
  rule: Pick<RecurringDocument, 'frequency' | 'startDate'>,
  n: number,
): string => {
  const [year, month, day] = rule.startDate.split('-').map(Number);
  if (rule.frequency === 'weekly') {
    return addDays(rule.startDate, 7 * n);
  }
  const index = month - 1 + (rule.frequency === 'monthly' ? n : 12 * n);
  const y = year + Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${pad(m)}-${pad(Math.min(day, daysInMonth(y, m)))}`;
};

/** The first occurrence on or after `date`. */
export const occurrenceFrom = (
  rule: Pick<RecurringDocument, 'frequency' | 'startDate'>,
  date: string,
): string => {
  for (let n = 0; n < MAX_STEPS; n += 1) {
    const candidate = occurrenceAt(rule, n);
    if (candidate >= date) {
      return candidate;
    }
  }
  return occurrenceAt(rule, MAX_STEPS);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads a stored rule; null when it cannot be used. */
export const parseRecurringDoc = (
  id: string,
  data: unknown,
): RecurringDocument | null => {
  if (!isRecord(data)) {
    return null;
  }
  const amount = data.amountMinor;
  const frequency = FREQUENCIES.find(f => f === data.frequency);
  const startDate = normalizeIsoDate(data.startDate);
  const nextDueDate = normalizeIsoDate(data.nextDueDate ?? data.startDate);
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (
    typeof amount !== 'number' ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    (data.type !== 'expense' && data.type !== 'income') ||
    !frequency ||
    startDate === null ||
    nextDueDate === null ||
    title === ''
  ) {
    return null;
  }
  const endDate = data.endDate ? normalizeIsoDate(data.endDate) : null;
  if (data.endDate && endDate === null) {
    return null;
  }
  return {
    id,
    title,
    description:
      typeof data.description === 'string' ? data.description.trim() : '',
    type: data.type,
    category: typeof data.category === 'string' ? data.category : '',
    amountMinor: amount,
    currency:
      typeof data.currency === 'string' &&
      /^[A-Za-z]{3}$/.test(data.currency.trim())
        ? data.currency.trim().toUpperCase()
        : 'INR',
    frequency,
    startDate,
    endDate,
    nextDueDate,
    timeZone:
      typeof data.timeZone === 'string' && data.timeZone !== ''
        ? data.timeZone
        : 'Asia/Kolkata',
    enabled: data.enabled !== false,
    finished: data.finished === true,
  };
};

export interface RecurringForm {
  title: string;
  description: string;
  type: 'expense' | 'income';
  category: string;
  frequency: Frequency;
  startDate: string;
  hasEnd: boolean;
  endDate: string;
  /** What the user typed, in major units. */
  amountText: string;
  currency: string;
  enabled: boolean;
}

export type RecurringWrite =
  | {ok: true; data: Omit<RecurringDocument, 'id' | 'finished'>}
  | {ok: false; message: string};

/**
 * Checks the form and builds the document to save. `existing` is the rule being edited: its next
 * date is kept unless the start date or the frequency changed, because moving it back would make
 * the job repeat what it already did. A new or changed rule starts at its first occurrence on or
 * after `today`, so saving a rule never creates old transactions.
 */
export const buildRecurringWrite = (
  form: RecurringForm,
  timeZone: string,
  today: string,
  existing?: RecurringDocument,
): RecurringWrite => {
  const title = form.title.trim();
  if (title === '') {
    return {ok: false, message: 'Enter a title.'};
  }
  if (title.length > RECURRING_TITLE_MAX) {
    return {
      ok: false,
      message: `The title can be at most ${RECURRING_TITLE_MAX} characters.`,
    };
  }
  if (form.category === '') {
    return {ok: false, message: 'Choose a category.'};
  }
  const amount =
    form.amountText.trim() === ''
      ? null
      : tryToMinor(form.amountText.trim(), form.currency);
  if (amount === null || amount <= 0) {
    return {ok: false, message: 'Enter an amount greater than zero.'};
  }
  const startDate = normalizeIsoDate(form.startDate);
  if (startDate === null) {
    return {ok: false, message: 'Choose a start date.'};
  }
  let endDate: string | null = null;
  if (form.hasEnd) {
    endDate = normalizeIsoDate(form.endDate);
    if (endDate === null) {
      return {ok: false, message: 'Choose an end date.'};
    }
    if (endDate < startDate) {
      return {
        ok: false,
        message: 'The end date must not be before the start date.',
      };
    }
  }
  const unchangedSchedule =
    existing !== undefined &&
    existing.startDate === startDate &&
    existing.frequency === form.frequency;
  const nextDueDate = unchangedSchedule
    ? existing.nextDueDate
    : occurrenceFrom({frequency: form.frequency, startDate}, today);
  return {
    ok: true,
    data: {
      title,
      description: form.description.trim(),
      type: form.type,
      category: form.category,
      amountMinor: amount,
      currency: form.currency,
      frequency: form.frequency,
      startDate,
      endDate,
      nextDueDate,
      timeZone: existing?.timeZone ?? timeZone,
      enabled: form.enabled,
    },
  };
};
