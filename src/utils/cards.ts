import {minorOf, type StoredMoney} from './amounts';
import {
  dueDateFor,
  inPeriod,
  isValidCardDay,
  paymentIdFor,
  periodFor,
  type CardPeriod,
} from './cardPeriods';
import {normalizeIsoDate} from './budgets';

/**
 * Credit cards, `users/{uid}/cards/{cardId}` (owner-only, like budgets and tags). A transaction
 * paid with a card carries `cardId`; it does not change the running balance when it is made, the
 * balance drops when the bill is paid (a `cardPayments` document and a transfer transaction with
 * `source: 'card_payment'`, which Statistics, budgets and summaries leave out).
 */

export const CARD_NAME_MAX = 30;
export const CARD_LAST4_LENGTH = 4;
export const CARD_PAYMENT_SOURCE = 'card_payment';

export interface CardDocument {
  id: string;
  name: string;
  /** Last four digits, to match a bank message to the card; optional. */
  last4: string | null;
  statementDay: number;
  /** Day the bill is due; null when the person did not set one (no reminder then). */
  dueDay: number | null;
  currency: string;
  archived: boolean;
}

export type CardInput = Omit<CardDocument, 'id'>;

/** A transaction as far as cards are concerned. */
export interface CardTransaction extends StoredMoney {
  type?: string;
  source?: unknown;
  cardId?: unknown;
  date?: string;
  dateISO?: string;
}

/** The card a transaction was paid with, or null for cash, UPI or a bank account. */
export const cardIdOf = (tx: {cardId?: unknown}): string | null =>
  typeof tx.cardId === 'string' && tx.cardId !== '' ? tx.cardId : null;

/** True for the transfer a paid card bill creates; it is not spending. */
export const isCardPayment = (tx: {source?: unknown}): boolean =>
  tx.source === CARD_PAYMENT_SOURCE;

/** Reads a card document; null when a field the app relies on is unusable. */
export const parseCardDoc = (
  id: string,
  data: unknown,
): CardDocument | null => {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const d = data as Record<string, unknown>;
  if (
    typeof d.name !== 'string' ||
    d.name.trim() === '' ||
    !isValidCardDay(d.statementDay) ||
    typeof d.currency !== 'string' ||
    d.currency === ''
  ) {
    return null;
  }
  return {
    id,
    name: d.name,
    last4: typeof d.last4 === 'string' && d.last4 !== '' ? d.last4 : null,
    statementDay: d.statementDay,
    dueDay: isValidCardDay(d.dueDay) ? d.dueDay : null,
    currency: d.currency,
    archived: d.archived === true,
  };
};

export type CardError = 'name' | 'last4' | 'statementDay' | 'dueDay';

/** Checks what a person typed for a card; the first problem, or null when it can be saved. */
export const validateCardInput = (input: {
  name: string;
  last4: string;
  statementDay: number | null;
  dueDay: number | null;
}): CardError | null => {
  const name = input.name.trim();
  if (name === '' || name.length > CARD_NAME_MAX) {
    return 'name';
  }
  if (input.last4 !== '' && !/^\d{4}$/.test(input.last4)) {
    return 'last4';
  }
  if (!isValidCardDay(input.statementDay)) {
    return 'statementDay';
  }
  if (input.dueDay !== null && !isValidCardDay(input.dueDay)) {
    return 'dueDay';
  }
  return null;
};

export const cardErrorMessage = (error: CardError): string => {
  switch (error) {
    case 'name':
      return `Enter a card name of up to ${CARD_NAME_MAX} characters.`;
    case 'last4':
      return 'Last digits must be exactly four numbers, or left empty.';
    case 'statementDay':
      return 'Choose the statement day, from 1 to 28.';
    default:
      return 'The due day must be from 1 to 28, or left empty.';
  }
};

const dayOfTx = (tx: CardTransaction): string | null =>
  normalizeIsoDate(tx.dateISO) ?? normalizeIsoDate(tx.date);

/**
 * What a card owes for a period, in integer minor units: purchases on the card minus refunds
 * (income paid back to the card), only in the card's currency, never the bill payments
 * themselves. A transaction whose amount cannot be read is left out.
 */
export const periodOwedMinor = (
  card: Pick<CardDocument, 'id' | 'currency'>,
  period: CardPeriod,
  transactions: readonly CardTransaction[],
): number => {
  let total = 0;
  for (const tx of transactions) {
    if (cardIdOf(tx) !== card.id || isCardPayment(tx)) {
      continue;
    }
    if (
      typeof tx.currency === 'string' &&
      tx.currency !== '' &&
      tx.currency !== card.currency
    ) {
      continue;
    }
    const day = dayOfTx(tx);
    if (day === null || !inPeriod(period, day)) {
      continue;
    }
    const minor = minorOf(tx, card.currency);
    if (minor === null) {
      continue;
    }
    total += tx.type === 'income' ? -minor : minor;
  }
  return total;
};

/**
 * The transactions of a card in a period, newest day first, bill payments left out. Follows the
 * same rules as `periodOwedMinor` (including the card's currency), so the list adds up to the total.
 */
export const periodTransactions = <T extends CardTransaction>(
  card: Pick<CardDocument, 'id' | 'currency'>,
  period: CardPeriod,
  transactions: readonly T[],
): T[] =>
  transactions
    .filter(tx => {
      if (cardIdOf(tx) !== card.id || isCardPayment(tx)) {
        return false;
      }
      if (
        typeof tx.currency === 'string' &&
        tx.currency !== '' &&
        tx.currency !== card.currency
      ) {
        return false;
      }
      const day = dayOfTx(tx);
      return day !== null && inPeriod(period, day);
    })
    .sort((a, b) => (dayOfTx(b) ?? '').localeCompare(dayOfTx(a) ?? ''));

/** The current period of a card and its due date, for a given "today". */
export const currentBill = (
  card: Pick<CardDocument, 'statementDay' | 'dueDay'>,
  today: string,
): {period: CardPeriod; dueDate: string | null} | null => {
  const period = periodFor(card.statementDay, today);
  if (!period) {
    return null;
  }
  return {
    period,
    dueDate: dueDateFor(card.statementDay, card.dueDay, period),
  };
};

/**
 * The periods that can still have a bill to pay: from the last paid-or-current one back to the
 * given count of earlier periods. Returned newest first, starting with the current period.
 */
export const recentPeriods = (
  statementDay: number,
  today: string,
  count: number,
): CardPeriod[] => {
  const periods: CardPeriod[] = [];
  let cursor = periodFor(statementDay, today);
  while (cursor && periods.length < count) {
    periods.push(cursor);
    cursor = periodFor(statementDay, addDaysBack(cursor.start));
  }
  return periods;
};

const addDaysBack = (date: string): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export interface UnpaidBill {
  card: CardDocument;
  period: CardPeriod;
  owedMinor: number;
  /** Null when the card has no due day. */
  dueDate: string | null;
}

/**
 * The bills still to pay: for each active card, its latest finished period when something is owed
 * and no payment is recorded for it. Sorted by due date (soonest first; cards without one last).
 */
export const unpaidBills = (
  cards: readonly CardDocument[],
  paidPaymentIds: ReadonlySet<string>,
  transactions: readonly CardTransaction[],
  today: string,
): UnpaidBill[] => {
  const bills: UnpaidBill[] = [];
  for (const card of cards) {
    if (card.archived) {
      continue;
    }
    const current = periodFor(card.statementDay, today);
    if (!current) {
      continue;
    }
    // The current period ends today or later; the bill is the one before it, unless the
    // statement day is today, when the period that ends today is already a bill.
    const finished =
      current.end === today
        ? current
        : periodFor(card.statementDay, addDaysBack(current.start));
    if (!finished || paidPaymentIds.has(paymentIdFor(card.id, finished))) {
      continue;
    }
    const owed = periodOwedMinor(card, finished, transactions);
    if (owed <= 0) {
      continue;
    }
    bills.push({
      card,
      period: finished,
      owedMinor: owed,
      dueDate: dueDateFor(card.statementDay, card.dueDay, finished),
    });
  }
  return bills.sort((a, b) =>
    a.dueDate === null && b.dueDate === null
      ? 0
      : a.dueDate === null
      ? 1
      : b.dueDate === null
      ? -1
      : a.dueDate.localeCompare(b.dueDate),
  );
};
