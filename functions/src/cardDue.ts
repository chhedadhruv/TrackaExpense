import {normalizeDate, resolveCurrency, type Fields} from './derive';

/**
 * Credit card bill reminders: the date rules, kept in step with the app's `src/utils/cardPeriods.ts`
 * and `src/utils/cards.ts` (change both together). A card has a statement day (1 to 28); a period
 * runs from the day after one statement day to the next, both included; the bill is due on the due
 * day of the statement month when it is later than the statement day, else of the next month.
 */

export const CARD_REMINDER_HOUR = 9;
/** Days before the due date of the first reminder; the second is on the due day itself. */
export const REMINDER_LEAD_DAYS = 3;

export interface Card {
  id: string;
  name: string;
  last4: string | null;
  statementDay: number;
  dueDay: number | null;
  currency: string;
  archived: boolean;
}

export interface Period {
  start: string;
  end: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number): string =>
  `${y}-${pad(m)}-${pad(d)}`;

const parts = (date: string): {y: number; m: number; d: number} => {
  const [y, m, d] = date.split('-').map(Number);
  return {y, m, d};
};

const shiftMonth = (y: number, m: number, delta: number) => {
  const index = y * 12 + (m - 1) + delta;
  return {y: Math.floor(index / 12), m: (index % 12) + 1};
};

export const addDays = (date: string, days: number): string => {
  const {y, m, d} = parts(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export const daysBetween = (from: string, to: string): number => {
  const a = parts(from);
  const b = parts(to);
  return Math.round(
    (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000,
  );
};

const validDay = (day: unknown): day is number =>
  typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 28;

export const parseCard = (id: string, data: unknown): Card | null => {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const d = data as Fields;
  if (
    typeof d.name !== 'string' ||
    d.name.trim() === '' ||
    !validDay(d.statementDay)
  ) {
    return null;
  }
  return {
    id,
    name: d.name,
    last4: typeof d.last4 === 'string' && d.last4 !== '' ? d.last4 : null,
    statementDay: d.statementDay,
    dueDay: validDay(d.dueDay) ? d.dueDay : null,
    currency: resolveCurrency(d.currency),
    archived: d.archived === true,
  };
};

/** The billing period containing `date`. */
export const periodFor = (statementDay: number, date: string): Period => {
  const {y, m, d} = parts(date);
  const end = shiftMonth(y, m, d <= statementDay ? 0 : 1);
  const before = shiftMonth(end.y, end.m, -1);
  return {
    start: addDays(iso(before.y, before.m, statementDay), 1),
    end: iso(end.y, end.m, statementDay),
  };
};

export const dueDateFor = (
  statementDay: number,
  dueDay: number,
  period: Period,
): string => {
  const {y, m} = parts(period.end);
  const due = shiftMonth(y, m, dueDay > statementDay ? 0 : 1);
  return iso(due.y, due.m, dueDay);
};

export type Stage = 'soon' | 'today';

export interface Reminder {
  period: Period;
  dueDate: string;
  stage: Stage;
}

/**
 * The reminder a card needs on `today` (the person's local date), or null. The bill is that of the
 * latest period that has ended (its statement day is today or earlier). One reminder
 * `REMINDER_LEAD_DAYS` days before the due date and one on the due day; a card with no due day
 * never gets one.
 */
export const reminderFor = (card: Card, today: string): Reminder | null => {
  if (card.dueDay === null) {
    return null;
  }
  let period = periodFor(card.statementDay, today);
  if (period.end > today) {
    period = periodFor(card.statementDay, addDays(period.start, -1));
  }
  const dueDate = dueDateFor(card.statementDay, card.dueDay, period);
  const left = daysBetween(today, dueDate);
  if (left === REMINDER_LEAD_DAYS) {
    return {period, dueDate, stage: 'soon'};
  }
  if (left === 0) {
    return {period, dueDate, stage: 'today'};
  }
  return null;
};

export const alertId = (cardId: string, period: Period, stage: Stage): string =>
  `${cardId}_${period.end}_${stage}`;

export const paymentId = (cardId: string, period: Period): string =>
  `${cardId}_${period.end}`;

/**
 * What the card owes for a period in integer minor units: purchases minus refunds in the card's
 * currency, never the bill payments themselves. Mirrors `periodOwedMinor` in the app.
 */
export const owedMinor = (
  card: Card,
  period: Period,
  transactions: readonly Fields[],
): number => {
  let total = 0;
  for (const tx of transactions) {
    if (tx.cardId !== card.id || tx.source === 'card_payment') {
      continue;
    }
    if (
      typeof tx.currency === 'string' &&
      tx.currency !== '' &&
      tx.currency !== card.currency
    ) {
      continue;
    }
    const day = normalizeDate(tx.dateISO) ?? normalizeDate(tx.date);
    if (day === null || day < period.start || day > period.end) {
      continue;
    }
    const minor = tx.amountMinor;
    if (typeof minor !== 'number' || !Number.isSafeInteger(minor)) {
      continue;
    }
    total += tx.type === 'income' ? -minor : minor;
  }
  return total;
};

export const reminderMessage = (
  card: Card,
  stage: Stage,
  amount: string,
  currency: string,
): {title: string; body: string} => {
  const name = card.last4 ? `${card.name} ${card.last4}` : card.name;
  return stage === 'soon'
    ? {
        title: 'Card bill due soon',
        body: `${name}: ${amount} ${currency} is due in ${REMINDER_LEAD_DAYS} days.`,
      }
    : {
        title: 'Card bill due today',
        body: `${name}: ${amount} ${currency} is due today.`,
      };
};
