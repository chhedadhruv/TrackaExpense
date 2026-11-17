import {describe, expect, it} from '@jest/globals';
import type {TransactionDocument} from '../src/types';
import {
  buildBudgetWrite,
  budgetPeriod,
  daysLeft,
  normalizeIsoDate,
  parseBudgetDoc,
  progressOf,
  spentMinorOf,
  todayInZone,
  type BudgetForm,
} from '../src/utils/budgets';

const allOn = {50: true, 80: true, 100: true, 120: true};

const tx = (over: Record<string, unknown>): TransactionDocument =>
  ({
    type: 'expense',
    category: 'Food',
    amount: '0',
    date: '2026-11-10',
    currency: 'INR',
    ...over,
  } as unknown as TransactionDocument);

describe('budgetPeriod', () => {
  it('is the calendar month for a monthly budget', () => {
    expect(budgetPeriod({period: 'monthly'}, '2026-11-17')).toEqual({
      start: '2026-11-01',
      end: '2026-11-30',
    });
    expect(budgetPeriod({period: 'monthly'}, '2028-02-03')?.end).toBe(
      '2028-02-29',
    );
  });

  it('is the saved range for a custom budget, also after it ended', () => {
    const custom = {
      period: 'custom' as const,
      startDate: '2026-01-05',
      endDate: '2026-01-20',
    };
    expect(budgetPeriod(custom, '2026-11-17')).toEqual({
      start: '2026-01-05',
      end: '2026-01-20',
    });
  });

  it('is null for a reversed or missing custom range', () => {
    expect(
      budgetPeriod(
        {period: 'custom', startDate: '2026-02-01', endDate: '2026-01-01'},
        '2026-01-10',
      ),
    ).toBeNull();
    expect(budgetPeriod({period: 'custom'}, '2026-01-10')).toBeNull();
  });
});

describe('todayInZone', () => {
  it('follows the zone, not the device', () => {
    const now = new Date(Date.UTC(2026, 10, 17, 20, 0, 0));
    expect(todayInZone(now, 'Asia/Kolkata')).toBe('2026-11-18');
    expect(todayInZone(now, 'America/New_York')).toBe('2026-11-17');
    expect(todayInZone(now, 'Not/AZone')).toBe('2026-11-18');
  });
});

describe('daysLeft', () => {
  const period = {start: '2026-11-01', end: '2026-11-30'};
  it('counts today and the end day', () => {
    expect(daysLeft(period, '2026-11-30')).toBe(1);
    expect(daysLeft(period, '2026-11-01')).toBe(30);
  });
  it('is 0 after the end and null before the start', () => {
    expect(daysLeft(period, '2026-12-01')).toBe(0);
    expect(daysLeft(period, '2026-10-31')).toBeNull();
  });
});

describe('spentMinorOf', () => {
  const period = {start: '2026-11-01', end: '2026-11-30'};
  const budget = {category: null, currency: 'INR'};

  it('adds integer minor amounts, preferring amountMinor over the legacy amount', () => {
    expect(
      spentMinorOf(budget, period, [
        tx({amountMinor: 1050, amount: '99'}),
        tx({amount: '20.5'}),
      ]),
    ).toBe(3100);
  });

  it('leaves out income, settlements, other currencies, other months and bad amounts', () => {
    expect(
      spentMinorOf(budget, period, [
        tx({type: 'income', amountMinor: 100}),
        tx({category: 'Settlement', amountMinor: 100}),
        tx({isSettlement: true, amountMinor: 100}),
        tx({currency: 'USD', amountMinor: 100}),
        tx({date: '2026-10-31', amountMinor: 100}),
        tx({amount: 'abc'}),
        tx({amountMinor: 700}),
      ]),
    ).toBe(700);
  });

  it('filters by category and reads an unpadded legacy date', () => {
    expect(
      spentMinorOf({category: 'Travel', currency: 'INR'}, period, [
        tx({category: 'Travel', amountMinor: 200, date: '2026-11-5'}),
        tx({category: 'Food', amountMinor: 900}),
      ]),
    ).toBe(200);
  });
});

describe('progressOf', () => {
  it('uses whole percents rounded down and flags the states', () => {
    expect(progressOf(7999, 10000)).toMatchObject({
      percent: 79,
      state: 'ok',
      remainingMinor: 2001,
    });
    expect(progressOf(8000, 10000)).toMatchObject({
      percent: 80,
      state: 'warning',
    });
    expect(progressOf(10000, 10000)).toMatchObject({
      percent: 100,
      state: 'over',
      remainingMinor: 0,
    });
    expect(progressOf(15000, 10000)).toMatchObject({
      percent: 150,
      remainingMinor: -5000,
    });
  });
});

describe('parseBudgetDoc', () => {
  it('reads a stored budget and treats missing flags as on', () => {
    const b = parseBudgetDoc('b1', {
      limitMinor: 5000,
      category: '',
      currency: 'usd',
    });
    expect(b).toMatchObject({
      id: 'b1',
      category: null,
      currency: 'USD',
      period: 'monthly',
      enabled: true,
      thresholds: allOn,
      timeZone: 'Asia/Kolkata',
    });
  });

  it('rejects an unusable limit or custom range', () => {
    for (const limitMinor of [undefined, 0, -1, 1.5, '10']) {
      expect(parseBudgetDoc('b', {limitMinor})).toBeNull();
    }
    expect(parseBudgetDoc('b', {limitMinor: 100, period: 'custom'})).toBeNull();
    expect(parseBudgetDoc('b', null)).toBeNull();
  });
});

describe('buildBudgetWrite', () => {
  const form: BudgetForm = {
    name: ' Groceries ',
    category: 'Food',
    period: 'monthly',
    startDate: '',
    endDate: '',
    limitText: '4999.99',
    currency: 'INR',
    thresholds: {50: true, 80: false, 100: true, 120: true},
    enabled: true,
  };

  it('converts the limit exactly and trims the name', () => {
    const out = buildBudgetWrite(form, 'Asia/Kolkata');
    expect(out).toEqual({
      ok: true,
      data: {
        name: 'Groceries',
        category: 'Food',
        period: 'monthly',
        limitMinor: 499999,
        currency: 'INR',
        thresholds: {50: true, 80: false, 100: true, 120: true},
        enabled: true,
        timeZone: 'Asia/Kolkata',
      },
    });
  });

  it('rejects an empty, zero or unreadable limit', () => {
    for (const limitText of ['', '0', '0.00', 'abc']) {
      expect(buildBudgetWrite({...form, limitText}, 'Asia/Kolkata').ok).toBe(
        false,
      );
    }
  });

  it('needs a valid ordered range for a custom budget and saves it', () => {
    const custom = {...form, period: 'custom' as const};
    expect(buildBudgetWrite(custom, 'Asia/Kolkata').ok).toBe(false);
    expect(
      buildBudgetWrite(
        {...custom, startDate: '2026-12-01', endDate: '2026-11-01'},
        'Asia/Kolkata',
      ).ok,
    ).toBe(false);
    const ok = buildBudgetWrite(
      {...custom, startDate: '2026-11-1', endDate: '2026-11-30'},
      'Asia/Kolkata',
    );
    expect(ok.ok && ok.data).toMatchObject({
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });
  });

  it('rejects a name over 40 characters', () => {
    expect(
      buildBudgetWrite({...form, name: 'x'.repeat(41)}, 'Asia/Kolkata').ok,
    ).toBe(false);
  });
});

describe('normalizeIsoDate', () => {
  it('pads and rejects impossible dates', () => {
    expect(normalizeIsoDate('2026-1-5')).toBe('2026-01-05');
    expect(normalizeIsoDate('2026-02-30')).toBeNull();
    expect(normalizeIsoDate(5)).toBeNull();
  });
});
