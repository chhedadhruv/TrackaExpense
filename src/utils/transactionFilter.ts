import moment from 'moment';
import {hasTag, sanitizeTags, tagKey} from './tags';

export type PeriodFilter = 'all' | '7days' | '30days' | 'custom';

/** The part of a transaction the filters read. */
export interface FilterableTransaction {
  title: string;
  category?: string;
  amount: string | number;
  createdAt: {toDate: () => Date};
  tags?: unknown;
  /** The credit card it was paid with; missing for cash, UPI or a bank account. */
  cardId?: unknown;
}

/** The "paid with" filter value that matches only transactions with no card. */
export const CASH_FILTER = '__cash__';

export interface FilterCriteria {
  period: PeriodFilter;
  /** Both ends are needed for a custom range; with only one the period filter is not applied. */
  customStart: Date | null;
  customEnd: Date | null;
  /** Free text; matches the title, category, amount, date and tags. Empty means no search. */
  query: string;
  /** A tag the transaction must carry (ignoring case), or null for any. */
  tag: string | null;
  /**
   * Paid with: a card id, `CASH_FILTER` for no card, or null/undefined for any. Applies together
   * with the other filters.
   */
  card?: string | null;
  /** The moment "last 7 days" counts back from; defaults to now. */
  now?: Date;
}

const inPeriod = (
  transaction: FilterableTransaction,
  {period, customStart, customEnd, now}: FilterCriteria,
): boolean => {
  if (period === 'all') {
    return true;
  }
  const created = moment(transaction.createdAt.toDate());
  if (period === 'custom') {
    if (!customStart || !customEnd) {
      return true;
    }
    return created.isBetween(customStart, customEnd, undefined, '[]');
  }
  const days = period === '7days' ? 7 : 30;
  return created.isAfter(moment(now).subtract(days, 'days'));
};

const matchesQuery = (
  transaction: FilterableTransaction,
  rawQuery: string,
): boolean => {
  const query = rawQuery.trim();
  if (!query) {
    return true;
  }
  const lower = query.toLowerCase();
  const titleMatch = (transaction.title ?? '').toLowerCase().includes(lower);
  const dateMatch = moment(transaction.createdAt.toDate())
    .format('MMM D, YYYY')
    .toLowerCase()
    .includes(lower);
  const categoryMatch = (transaction.category ?? '')
    .toLowerCase()
    .includes(lower);
  const amountMatch = String(transaction.amount ?? '').includes(query);
  // A leading "#" in the search box still finds the tag.
  const wanted = tagKey(query) || lower;
  const tagMatch = sanitizeTags(transaction.tags).some(t =>
    tagKey(t).includes(wanted),
  );
  return titleMatch || dateMatch || categoryMatch || amountMatch || tagMatch;
};

const matchesCard = (
  transaction: FilterableTransaction,
  card: string | null,
): boolean => {
  if (card === null) {
    return true;
  }
  const own =
    typeof transaction.cardId === 'string' && transaction.cardId !== ''
      ? transaction.cardId
      : null;
  return card === CASH_FILTER ? own === null : own === card;
};

/**
 * The transactions that pass every active filter: the period, the search text and the tag. The
 * filters combine (a search inside "Last 30 days" with a tag only shows rows passing all three),
 * and the order of the input is kept.
 */
export function filterTransactions<T extends FilterableTransaction>(
  transactions: readonly T[],
  criteria: FilterCriteria,
): T[] {
  return transactions.filter(
    t =>
      inPeriod(t, criteria) &&
      matchesQuery(t, criteria.query) &&
      (criteria.tag === null || hasTag(t, criteria.tag)) &&
      matchesCard(t, criteria.card ?? null),
  );
}
