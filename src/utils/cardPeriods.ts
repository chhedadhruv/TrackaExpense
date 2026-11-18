import {addDays} from './recurring';

/**
 * Credit card billing periods. A card has a statement day (1 to 28): the statement closes on that
 * day of every month, and a period runs from the day after one statement day to the next one,
 * both included. A bill is identified by its period end date. The optional due day (1 to 28) is
 * the day the bill must be paid: in the month of the statement when it is later than the
 * statement day, otherwise in the next month.
 *
 * All dates are "YYYY-MM-DD" text, the same form transactions use. The server reminder
 * (`functions/src/cardDue.ts`) must use the same rules; change both together.
 */

export const MIN_CARD_DAY = 1;
export const MAX_CARD_DAY = 28;

export interface CardPeriod {
  /** First day of the period, "YYYY-MM-DD". */
  start: string;
  /** Statement day, last day of the period; also the bill's identity. */
  end: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

const iso = (year: number, month: number, day: number): string =>
  `${year}-${pad(month)}-${pad(day)}`;

const parts = (date: string): {y: number; m: number; d: number} | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }
  return {y: Number(match[1]), m: Number(match[2]), d: Number(match[3])};
};

/** The year and month `delta` months from the given one (delta may be negative). */
const shiftMonth = (
  y: number,
  m: number,
  delta: number,
): {y: number; m: number} => {
  const index = y * 12 + (m - 1) + delta;
  return {y: Math.floor(index / 12), m: (index % 12) + 1};
};

export const isValidCardDay = (day: unknown): day is number =>
  typeof day === 'number' &&
  Number.isInteger(day) &&
  day >= MIN_CARD_DAY &&
  day <= MAX_CARD_DAY;

/**
 * The billing period that contains `date`, or null for a malformed date or statement day.
 * A date on the statement day belongs to the period that ends that day.
 */
export const periodFor = (
  statementDay: number,
  date: string,
): CardPeriod | null => {
  const p = parts(date);
  if (!p || !isValidCardDay(statementDay)) {
    return null;
  }
  // The period ends on this month's statement day when the date is not past it, else next month's.
  const end = shiftMonth(p.y, p.m, p.d <= statementDay ? 0 : 1);
  const before = shiftMonth(end.y, end.m, -1);
  return {
    start: addDays(iso(before.y, before.m, statementDay), 1),
    end: iso(end.y, end.m, statementDay),
  };
};

/** The period before the given one. */
export const previousPeriod = (
  statementDay: number,
  period: CardPeriod,
): CardPeriod | null => periodFor(statementDay, addDays(period.start, -1));

/** The period after the given one. */
export const nextPeriod = (
  statementDay: number,
  period: CardPeriod,
): CardPeriod | null => periodFor(statementDay, addDays(period.end, 1));

/** The due date of the bill for a period, or null when the card has no due day. */
export const dueDateFor = (
  statementDay: number,
  dueDay: number | null | undefined,
  period: CardPeriod,
): string | null => {
  if (!isValidCardDay(dueDay) || !isValidCardDay(statementDay)) {
    return null;
  }
  const p = parts(period.end);
  if (!p) {
    return null;
  }
  const due = shiftMonth(p.y, p.m, dueDay > statementDay ? 0 : 1);
  return iso(due.y, due.m, dueDay);
};

/** Whole days from one date to another (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string): number => {
  const a = parts(from);
  const b = parts(to);
  if (!a || !b) {
    return 0;
  }
  const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
  return Math.round(ms / 86400000);
};

/** True when `date` lies inside the period, both ends included. */
export const inPeriod = (period: CardPeriod, date: string): boolean =>
  date >= period.start && date <= period.end;

/** Identity of one card's bill for one period, used as the payment document id. */
export const paymentIdFor = (cardId: string, period: CardPeriod): string =>
  `${cardId}_${period.end}`;
