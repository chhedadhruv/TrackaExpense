import {describe, expect, it} from '@jest/globals';
import {totalMajor} from '../src/utils/amounts';
import {toMajorNumber} from '../src/utils/money';
import {
  bucketLabel,
  bucketTitle,
  categoryBreakdown,
  dailyHeatmap,
  dayOf,
  filterByRange,
  largestTransactions,
  normalizeDay,
  percentChange,
  previousBounds,
  rangeBounds,
  summarize,
  topMerchants,
  trendBuckets,
  wholePercents,
  type StatsTransaction,
} from '../src/utils/statistics';

const TODAY = '2026-11-12';

// A mix of shapes seen in live data: string and number legacy amounts, integer minor units,
// a padded and an unpadded date, an unconvertible amount and an income.
const txns: StatsTransaction[] = [
  {
    id: 'a',
    type: 'expense',
    date: '2026-11-12',
    amount: '10.10',
    title: 'Coffee',
    category: 'Food',
  },
  {
    id: 'b',
    type: 'expense',
    date: '2026-11-11',
    amount: 20.2,
    amountMinor: 2020,
    currency: 'INR',
    title: ' coffee ',
    category: 'Food',
  },
  {
    id: 'c',
    type: 'expense',
    date: '2026-11-5',
    amount: '0.1',
    title: 'Bus',
    category: 'Travel',
  },
  {
    id: 'd',
    type: 'expense',
    date: '2026-10-30',
    amount: '0.2',
    title: 'Bus',
    category: 'Travel',
  },
  {
    id: 'e',
    type: 'income',
    date: '2026-11-01',
    amount: '5000',
    title: 'Salary',
    category: 'Salary',
  },
  {
    id: 'f',
    type: 'expense',
    date: '2026-09-02',
    amount: '300',
    title: 'Rent',
    category: 'Housing',
  },
  {
    id: 'g',
    type: 'expense',
    date: '2026-08-15',
    amount: '12.345',
    title: 'Book',
    category: 'Shopping',
  },
  {
    id: 'h',
    type: 'expense',
    date: '2026-08-14',
    amount: '1e28x',
    title: 'Bad',
    category: 'Food',
  },
  {
    id: 'i',
    type: 'expense',
    date: '2026-07-01',
    amount: '7',
    title: 'Tea',
    category: 'Snacks',
  },
  {
    id: 'j',
    type: 'expense',
    date: '2026-06-20',
    amount: '8',
    title: 'Gum',
    category: 'Snacks',
  },
  {
    id: 'k',
    type: 'expense',
    date: '2026-06-01',
    amount: '9',
    title: 'Pen',
    category: 'Office',
  },
];

const expenses = txns.filter(t => t.type !== 'income');
const incomes = txns.filter(t => t.type === 'income');

describe('days', () => {
  it('pads unpadded dates and prefers dateISO', () => {
    expect(normalizeDay('2025-5-4')).toBe('2025-05-04');
    expect(dayOf({date: '2025-5-4', dateISO: '2025-05-04'})).toBe('2025-05-04');
    expect(normalizeDay('nope')).toBeNull();
    expect(normalizeDay('2025-13-01')).toBeNull();
    expect(normalizeDay(undefined)).toBeNull();
  });

  it('builds ranges that include today', () => {
    expect(rangeBounds('7days', TODAY)).toEqual({
      start: '2026-11-06',
      end: TODAY,
    });
    expect(rangeBounds('30days', TODAY)).toEqual({
      start: '2026-10-14',
      end: TODAY,
    });
    expect(rangeBounds('3months', TODAY)).toEqual({
      start: '2026-08-13',
      end: TODAY,
    });
    expect(rangeBounds('year', TODAY)).toEqual({
      start: '2025-11-13',
      end: TODAY,
    });
    expect(rangeBounds('all', TODAY)).toEqual({start: null, end: null});
  });

  it('clamps month arithmetic at the end of a short month', () => {
    expect(rangeBounds('3months', '2026-05-31').start).toBe('2026-03-01');
  });

  it('includes both ends of a custom range and rejects a reversed one', () => {
    const custom = rangeBounds('custom', TODAY, {
      start: '2026-11-05',
      end: '2026-11-11',
    });
    expect(filterByRange(txns, custom).map(t => t.id)).toEqual(['b', 'c']);
    const reversed = rangeBounds('custom', TODAY, {
      start: '2026-11-11',
      end: '2026-11-05',
    });
    expect(filterByRange(txns, reversed)).toEqual([]);
    expect(rangeBounds('custom', TODAY)).toEqual(
      rangeBounds('custom', TODAY, {start: null, end: null}),
    );
    expect(filterByRange(txns, rangeBounds('custom', TODAY))).toEqual([]);
  });
});

describe('totals equal the integer totals', () => {
  const ranges = [
    'all',
    '7days',
    '30days',
    '3months',
    '6months',
    'year',
  ] as const;

  it('summarize matches totalMajor for income and expense', () => {
    const s = summarize(txns, 'INR');
    expect(toMajorNumber(s.incomeMinor, 'INR')).toBe(
      totalMajor(incomes, 'INR'),
    );
    expect(toMajorNumber(s.expenseMinor, 'INR')).toBe(
      totalMajor(expenses, 'INR'),
    );
    expect(s.netMinor).toBe(s.incomeMinor - s.expenseMinor);
    // 0.1 + 0.2 style float drift must not appear: 10.10 + 20.20 + 0.10 + 0.20 + 300 ...
    expect(s.expenseMinor % 1).toBe(0);
    expect(s.count).toBe(10);
  });

  it.each(ranges)('every view adds up to the summary for %s', range => {
    const bounds = rangeBounds(range, TODAY);
    const inside = filterByRange(txns, bounds);
    const s = summarize(inside, 'INR');
    const expected = {
      income: totalMajor(
        inside.filter(t => t.type === 'income'),
        'INR',
      ),
      expense: totalMajor(
        inside.filter(t => t.type !== 'income'),
        'INR',
      ),
    };
    expect(toMajorNumber(s.incomeMinor, 'INR')).toBe(expected.income);
    expect(toMajorNumber(s.expenseMinor, 'INR')).toBe(expected.expense);

    // Trend buckets (only complete when no bucket was cut off; these ranges are short enough).
    const {buckets} = trendBuckets(inside, 'INR', bounds, TODAY);
    expect(buckets.reduce((sum, b) => sum + b.incomeMinor, 0)).toBe(
      s.incomeMinor,
    );
    expect(buckets.reduce((sum, b) => sum + b.expenseMinor, 0)).toBe(
      s.expenseMinor,
    );

    // Category slices, including Others.
    for (const kind of ['income', 'expense'] as const) {
      const total = kind === 'income' ? s.incomeMinor : s.expenseMinor;
      const breakdown = categoryBreakdown(inside, kind, 'INR', 2);
      expect(breakdown.totalMinor).toBe(total);
      expect(breakdown.slices.reduce((sum, x) => sum + x.minor, 0)).toBe(total);
      if (total > 0) {
        expect(breakdown.slices.reduce((sum, x) => sum + x.percent, 0)).toBe(
          100,
        );
      }
      // Every merchant together is the same total.
      expect(
        topMerchants(inside, kind, 'INR', Infinity).reduce(
          (sum, m) => sum + m.minor,
          0,
        ),
      ).toBe(total);
      // The heatmap shows at most 13 weeks, so only ranges that fit in them add up to the total.
      if (range === '7days' || range === '30days') {
        expect(
          dailyHeatmap(inside, kind, 'INR', bounds, TODAY).totalMinor,
        ).toBe(total);
      }
    }
  });

  it('leaves out an amount that cannot be converted, everywhere', () => {
    const s = summarize(
      [{type: 'expense', date: TODAY, amount: 'abc', title: 'x'}],
      'INR',
    );
    expect(s).toEqual({incomeMinor: 0, expenseMinor: 0, netMinor: 0, count: 0});
  });

  it('prefers amountMinor over the legacy amount', () => {
    const s = summarize(
      [
        {
          type: 'expense',
          date: TODAY,
          amount: '1.005',
          amountMinor: 101,
          currency: 'INR',
        },
      ],
      'INR',
    );
    expect(s.expenseMinor).toBe(101);
  });
});

describe('trendBuckets', () => {
  it('gives one bucket per day for a week, with empty days', () => {
    const bounds = rangeBounds('7days', TODAY);
    const {interval, buckets} = trendBuckets(
      filterByRange(txns, bounds),
      'INR',
      bounds,
      TODAY,
    );
    expect(interval).toBe('daily');
    expect(buckets).toHaveLength(7);
    expect(buckets[0].startDay).toBe('2026-11-06');
    expect(buckets[6]).toMatchObject({startDay: TODAY, expenseMinor: 1010});
    expect(buckets[1].expenseMinor).toBe(0);
  });

  it('uses Monday-based weeks for three months', () => {
    const bounds = rangeBounds('3months', TODAY);
    const {interval, buckets} = trendBuckets(
      filterByRange(txns, bounds),
      'INR',
      bounds,
      TODAY,
    );
    expect(interval).toBe('weekly');
    for (const b of buckets) {
      expect(new Date(`${b.startDay}T00:00:00Z`).getUTCDay()).toBe(1);
      expect(b.endDay > b.startDay).toBe(true);
    }
  });

  it('uses months for a year and starts all time at the oldest transaction', () => {
    const year = rangeBounds('year', TODAY);
    const yearTrend = trendBuckets(
      filterByRange(txns, year),
      'INR',
      year,
      TODAY,
    );
    expect(yearTrend.interval).toBe('monthly');
    expect(yearTrend.buckets).toHaveLength(13);
    const all = rangeBounds('all', TODAY);
    const allTrend = trendBuckets(txns, 'INR', all, TODAY);
    expect(allTrend.buckets[0].startDay).toBe('2026-06-01');
    expect(allTrend.buckets[allTrend.buckets.length - 1].startDay).toBe(
      '2026-11-01',
    );
  });

  it('is empty when there is nothing to show', () => {
    expect(
      trendBuckets([], 'INR', rangeBounds('all', TODAY), TODAY).buckets,
    ).toEqual([]);
  });
});

describe('categoryBreakdown', () => {
  it('folds the tail into Others and adds up to 100 percent', () => {
    const {slices} = categoryBreakdown(expenses, 'expense', 'INR', 2);
    expect(slices.map(s => s.category)).toEqual(['Housing', 'Food', 'Others']);
    expect(slices[2].isOthers).toBe(true);
    expect(slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });

  it('is empty for a kind with no money', () => {
    expect(categoryBreakdown([], 'income', 'INR')).toEqual({
      totalMinor: 0,
      slices: [],
    });
  });
});

describe('wholePercents', () => {
  it('adds up to 100 for awkward splits', () => {
    expect(wholePercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(wholePercents([1, 2]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(wholePercents([0, 0])).toEqual([0, 0]);
  });
});

describe('topMerchants and largestTransactions', () => {
  it('merges titles that differ only by case and spacing', () => {
    const rows = topMerchants(expenses, 'expense', 'INR', 3);
    expect(rows[0]).toEqual({name: 'Rent', minor: 30000, count: 1});
    const coffee = rows.find(r => r.name.toLowerCase().trim() === 'coffee');
    expect(coffee).toMatchObject({minor: 3030, count: 2});
  });

  it('ranks the largest transactions', () => {
    expect(
      largestTransactions(txns, 'expense', 'INR', 2).map(t => t.id),
    ).toEqual(['f', 'b']);
  });
});

describe('dailyHeatmap', () => {
  it('lays days out Monday first and scales levels to the busiest day', () => {
    const bounds = rangeBounds('30days', TODAY);
    const inside = filterByRange(txns, bounds);
    const map = dailyHeatmap(inside, 'expense', 'INR', bounds, TODAY);
    for (const week of map.weeks) {
      expect(week).toHaveLength(7);
      expect(new Date(`${week[0].day}T00:00:00Z`).getUTCDay()).toBe(1);
    }
    const cells = map.weeks.flat().filter(c => c.inRange);
    expect(cells.find(c => c.day === '2026-11-11')?.level).toBe(4);
    expect(cells.find(c => c.day === '2026-11-12')?.level).toBe(2);
    expect(cells.find(c => c.day === '2026-11-10')?.level).toBe(0);
    expect(map.maxMinor).toBe(2020);
  });

  it('keeps at most 13 weeks', () => {
    const bounds = rangeBounds('all', TODAY);
    const map = dailyHeatmap(txns, 'expense', 'INR', bounds, TODAY);
    expect(map.weeks.length).toBeLessThanOrEqual(13);
  });
});

describe('previous period', () => {
  it('is the same length right before the range', () => {
    expect(previousBounds(rangeBounds('7days', TODAY))).toEqual({
      start: '2026-10-30',
      end: '2026-11-05',
    });
    expect(previousBounds(rangeBounds('all', TODAY))).toBeNull();
  });

  it('computes a whole percent change and avoids dividing by zero', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe('bucket labels', () => {
  const bucket = {
    startDay: '2026-11-02',
    endDay: '2026-11-08',
    incomeMinor: 0,
    expenseMinor: 0,
  };
  it('labels by interval', () => {
    expect(bucketLabel(bucket, 'daily')).toBe('2 Nov');
    expect(bucketLabel(bucket, 'weekly')).toBe('2 Nov');
    expect(bucketLabel({...bucket, startDay: '2026-11-01'}, 'monthly')).toBe(
      'Nov',
    );
    expect(bucketTitle(bucket, 'weekly')).toBe('2 Nov to 8 Nov');
    expect(bucketTitle({...bucket, startDay: '2026-11-01'}, 'monthly')).toBe(
      'Nov 2026',
    );
  });
});
