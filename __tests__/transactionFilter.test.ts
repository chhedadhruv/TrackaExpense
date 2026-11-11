import {describe, expect, it} from '@jest/globals';
import {
  filterTransactions,
  type FilterCriteria,
  type FilterableTransaction,
} from '../src/utils/transactionFilter';

// Local-time dates, so the formatted date text matches in any time zone.
const NOW = new Date(2026, 10, 11, 12, 0, 0);
const daysAgo = (days: number): Date =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const tx = (
  title: string,
  created: Date,
  extra: Partial<FilterableTransaction> = {},
): FilterableTransaction => ({
  title,
  category: 'Food',
  amount: '100',
  createdAt: {toDate: () => created},
  ...extra,
});

const NONE: FilterCriteria = {
  period: 'all',
  customStart: null,
  customEnd: null,
  query: '',
  tag: null,
  now: NOW,
};

const titles = (list: FilterableTransaction[]): string[] =>
  list.map(t => t.title);

describe('filterTransactions with no filters', () => {
  it('returns every transaction in the original order', () => {
    const list = [
      tx('b', daysAgo(1)),
      tx('a', daysAgo(40)),
      tx('c', daysAgo(2)),
    ];
    expect(titles(filterTransactions(list, NONE))).toEqual(['b', 'a', 'c']);
  });

  it('does not change the list it was given', () => {
    const list = [tx('a', daysAgo(1)), tx('b', daysAgo(50))];
    filterTransactions(list, {...NONE, period: '7days'});
    expect(list).toHaveLength(2);
  });
});

describe('period filter', () => {
  const list = [
    tx('today', daysAgo(0)),
    tx('three', daysAgo(3)),
    tx('ten', daysAgo(10)),
    tx('forty', daysAgo(40)),
  ];

  it('keeps the last 7 days', () => {
    expect(
      titles(filterTransactions(list, {...NONE, period: '7days'})),
    ).toEqual(['today', 'three']);
  });

  it('keeps the last 30 days', () => {
    expect(
      titles(filterTransactions(list, {...NONE, period: '30days'})),
    ).toEqual(['today', 'three', 'ten']);
  });

  it('excludes a transaction exactly 7 days old', () => {
    expect(
      titles(
        filterTransactions([tx('edge', daysAgo(7))], {
          ...NONE,
          period: '7days',
        }),
      ),
    ).toEqual([]);
  });

  it('keeps a custom range, ends included', () => {
    const start = daysAgo(10);
    const end = daysAgo(3);
    expect(
      titles(
        filterTransactions(list, {
          ...NONE,
          period: 'custom',
          customStart: start,
          customEnd: end,
        }),
      ),
    ).toEqual(['three', 'ten']);
  });

  it('does not apply a custom range until both dates are set', () => {
    expect(
      titles(
        filterTransactions(list, {
          ...NONE,
          period: 'custom',
          customStart: daysAgo(10),
          customEnd: null,
        }),
      ),
    ).toHaveLength(4);
  });
});

describe('search', () => {
  const list = [
    tx('Lunch with Sam', daysAgo(1), {category: 'Food', amount: '250'}),
    tx('Taxi', daysAgo(2), {category: 'Travel', amount: 480}),
    tx('Flights', new Date(2026, 5, 3), {
      category: 'Travel',
      amount: '12000',
      tags: ['Goa Trip', 'work'],
    }),
  ];

  it('matches the title ignoring case', () => {
    expect(titles(filterTransactions(list, {...NONE, query: 'LUNCH'}))).toEqual(
      ['Lunch with Sam'],
    );
  });

  it('matches the category', () => {
    expect(
      titles(filterTransactions(list, {...NONE, query: 'travel'})),
    ).toEqual(['Taxi', 'Flights']);
  });

  it('matches the amount, number or string', () => {
    expect(titles(filterTransactions(list, {...NONE, query: '480'}))).toEqual([
      'Taxi',
    ]);
    expect(titles(filterTransactions(list, {...NONE, query: '250'}))).toEqual([
      'Lunch with Sam',
    ]);
  });

  it('matches the formatted date', () => {
    expect(titles(filterTransactions(list, {...NONE, query: 'jun 3'}))).toEqual(
      ['Flights'],
    );
  });

  it('matches a tag, with or without a hash, ignoring case', () => {
    expect(titles(filterTransactions(list, {...NONE, query: 'goa'}))).toEqual([
      'Flights',
    ]);
    expect(titles(filterTransactions(list, {...NONE, query: '#WORK'}))).toEqual(
      ['Flights'],
    );
  });

  it('treats a blank query as no search', () => {
    expect(filterTransactions(list, {...NONE, query: '   '})).toHaveLength(3);
  });

  it('survives a transaction with missing fields', () => {
    const odd = {
      createdAt: {toDate: () => daysAgo(1)},
    } as unknown as FilterableTransaction;
    expect(filterTransactions([odd], {...NONE, query: 'x'})).toEqual([]);
  });
});

describe('tag filter', () => {
  const list = [
    tx('a', daysAgo(1), {tags: ['Goa Trip']}),
    tx('b', daysAgo(2), {tags: ['work', 'Goa Trip']}),
    tx('c', daysAgo(3)),
    tx('d', daysAgo(4), {tags: 'goa trip'}),
  ];

  it('keeps only transactions carrying the tag, ignoring case', () => {
    expect(
      titles(filterTransactions(list, {...NONE, tag: 'goa trip'})),
    ).toEqual(['a', 'b']);
  });

  it('excludes transactions without tags and with unusable tags', () => {
    expect(filterTransactions(list, {...NONE, tag: 'work'})).toHaveLength(1);
  });
});

describe('filters combine', () => {
  it('applies the period, the search and the tag together', () => {
    const list = [
      tx('Hotel', daysAgo(2), {tags: ['Goa Trip']}),
      tx('Hotel', daysAgo(20), {tags: ['Goa Trip']}),
      tx('Taxi', daysAgo(2), {tags: ['Goa Trip']}),
      tx('Hotel', daysAgo(2), {tags: ['work']}),
    ];
    const result = filterTransactions(list, {
      ...NONE,
      period: '7days',
      query: 'hotel',
      tag: 'Goa Trip',
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Hotel');
  });

  it('keeps a search inside the chosen period, which the old screen did not', () => {
    const list = [tx('Hotel', daysAgo(2)), tx('Hotel', daysAgo(60))];
    expect(
      filterTransactions(list, {...NONE, period: '30days', query: 'hotel'}),
    ).toHaveLength(1);
  });
});
