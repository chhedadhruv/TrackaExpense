import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  alertId,
  crossedThresholds,
  parseBudget,
  periodFor,
  spentMinor,
  todayInZone,
  type Budget,
} from './budgets';
import type {Fields} from './derive';

const allOn = {50: true, 80: true, 100: true, 120: true};

const expense = (
  amountMinor: number,
  dateISO: string,
  extra: Fields = {},
): Fields => ({
  type: 'expense',
  amountMinor,
  dateISO,
  currency: 'INR',
  category: 'Food',
  ...extra,
});

describe('periodFor', () => {
  it('uses the calendar month for a monthly budget', () => {
    assert.deepEqual(periodFor({period: 'monthly'}, '2026-11-17'), {
      key: '2026-11',
      start: '2026-11-01',
      end: '2026-11-30',
    });
  });

  it('handles February in a leap year and the end of December', () => {
    assert.equal(
      periodFor({period: 'monthly'}, '2028-02-10')?.end,
      '2028-02-29',
    );
    assert.equal(
      periodFor({period: 'monthly'}, '2026-12-31')?.end,
      '2026-12-31',
    );
  });

  it('returns the custom range only while today is inside it', () => {
    const b = {
      period: 'custom' as const,
      startDate: '2026-11-05',
      endDate: '2026-11-20',
    };
    assert.equal(periodFor(b, '2026-11-05')?.key, '2026-11-05_2026-11-20');
    assert.equal(periodFor(b, '2026-11-20')?.key, '2026-11-05_2026-11-20');
    assert.equal(periodFor(b, '2026-11-04'), null);
    assert.equal(periodFor(b, '2026-11-21'), null);
  });

  it('rejects a reversed or invalid custom range and an invalid today', () => {
    const reversed = {
      period: 'custom' as const,
      startDate: '2026-11-20',
      endDate: '2026-11-05',
    };
    assert.equal(periodFor(reversed, '2026-11-10'), null);
    assert.equal(
      periodFor({period: 'custom', startDate: 'x', endDate: 'y'}, '2026-11-10'),
      null,
    );
    assert.equal(periodFor({period: 'monthly'}, 'nope'), null);
  });
});

describe('todayInZone', () => {
  it('uses the zone, not the server clock', () => {
    // 2026-11-17 20:00 UTC is already the 18th in India (UTC+5:30) and still the 17th in New York.
    const now = Date.UTC(2026, 10, 17, 20, 0, 0);
    assert.equal(todayInZone(now, 'Asia/Kolkata'), '2026-11-18');
    assert.equal(todayInZone(now, 'America/New_York'), '2026-11-17');
  });

  it('falls back to the default zone for an invalid one', () => {
    const now = Date.UTC(2026, 10, 17, 20, 0, 0);
    assert.equal(todayInZone(now, 'Not/AZone'), '2026-11-18');
  });
});

describe('parseBudget', () => {
  it('reads a complete document', () => {
    const b = parseBudget('b1', {
      name: 'Food',
      category: 'Food',
      period: 'monthly',
      limitMinor: 500000,
      currency: 'inr',
      thresholds: {50: true, 80: false, 100: true, 120: true},
      enabled: true,
    });
    assert.ok(b);
    assert.equal(b.currency, 'INR');
    assert.equal(b.thresholds[80], false);
    assert.equal(b.timeZone, 'Asia/Kolkata');
  });

  it('treats missing flags as on and an empty category as all spending', () => {
    const b = parseBudget('b1', {limitMinor: 100, category: ''});
    assert.ok(b);
    assert.deepEqual(b.thresholds, allOn);
    assert.equal(b.category, null);
    assert.equal(b.enabled, true);
  });

  it('rejects a missing, zero, negative, fractional or text limit', () => {
    for (const limitMinor of [undefined, 0, -5, 10.5, '500']) {
      assert.equal(parseBudget('b', {limitMinor}), null);
    }
    assert.equal(parseBudget('b', null), null);
    assert.equal(parseBudget('b', []), null);
  });

  it('rejects a custom budget with a bad range', () => {
    assert.equal(
      parseBudget('b', {
        limitMinor: 100,
        period: 'custom',
        startDate: '2026-11-09',
      }),
      null,
    );
  });
});

describe('spentMinor', () => {
  const budget = {category: null, currency: 'INR'};
  const period = {key: '2026-11', start: '2026-11-01', end: '2026-11-30'};

  it('adds integer minor amounts inside the period, ends included', () => {
    const txs = [
      expense(10000, '2026-11-01'),
      expense(5050, '2026-11-30'),
      expense(999, '2026-10-31'),
      expense(999, '2026-12-01'),
    ];
    assert.equal(spentMinor(budget, period, txs), 15050);
  });

  it('ignores income, settlements, other currencies and missing amountMinor', () => {
    const txs = [
      expense(10000, '2026-11-05', {type: 'income'}),
      expense(10000, '2026-11-05', {category: 'Settlement'}),
      expense(10000, '2026-11-05', {isSettlement: true}),
      expense(10000, '2026-11-05', {currency: 'USD'}),
      {type: 'expense', amount: '50', dateISO: '2026-11-05', currency: 'INR'},
      expense(700, '2026-11-05'),
    ];
    assert.equal(spentMinor(budget, period, txs), 700);
  });

  it('filters by category when the budget has one', () => {
    const txs = [
      expense(100, '2026-11-05', {category: 'Food'}),
      expense(200, '2026-11-05', {category: 'Travel'}),
    ];
    assert.equal(
      spentMinor({category: 'Travel', currency: 'INR'}, period, txs),
      200,
    );
  });

  it('reads the date from the legacy date field when dateISO is missing', () => {
    const tx = expense(300, '', {date: '2026-11-5'});
    delete tx.dateISO;
    assert.equal(spentMinor(budget, period, [tx]), 300);
  });

  it('treats a transaction with no currency as INR', () => {
    const tx = expense(400, '2026-11-05');
    delete tx.currency;
    assert.equal(spentMinor(budget, period, [tx]), 400);
  });
});

describe('crossedThresholds', () => {
  const b = {limitMinor: 10000, thresholds: allOn};

  it('reports nothing below 50 percent', () => {
    assert.deepEqual(crossedThresholds(b, 4999), []);
  });

  it('crosses exactly at the boundary, with integers only', () => {
    assert.deepEqual(crossedThresholds(b, 5000), [50]);
    assert.deepEqual(crossedThresholds(b, 7999), [50]);
    assert.deepEqual(crossedThresholds(b, 8000), [50, 80]);
    assert.deepEqual(crossedThresholds(b, 9999), [50, 80]);
    assert.deepEqual(crossedThresholds(b, 10000), [50, 80, 100]);
    assert.deepEqual(crossedThresholds(b, 11999), [50, 80, 100]);
    assert.deepEqual(crossedThresholds(b, 12000), [50, 80, 100, 120]);
  });

  it('skips thresholds the budget switched off', () => {
    const only100: Budget['thresholds'] = {
      50: false,
      80: false,
      100: true,
      120: false,
    };
    assert.deepEqual(
      crossedThresholds({limitMinor: 10000, thresholds: only100}, 20000),
      [100],
    );
  });

  it('does not lose precision on a limit that does not divide by 100', () => {
    // 3333 * 50 / 100 = 1666.5: 1666 is below, 1667 is at or above.
    const odd = {limitMinor: 3333, thresholds: allOn};
    assert.deepEqual(crossedThresholds(odd, 1666), []);
    assert.deepEqual(crossedThresholds(odd, 1667), [50]);
  });
});

describe('alertId', () => {
  it('is stable per budget, period and threshold', () => {
    const period = {key: '2026-11', start: '2026-11-01', end: '2026-11-30'};
    assert.equal(alertId('b1', period, 80), 'b1_2026-11_80');
    assert.notEqual(alertId('b1', period, 80), alertId('b1', period, 100));
    assert.notEqual(
      alertId('b1', period, 80),
      alertId('b1', {...period, key: '2026-12'}, 80),
    );
  });
});
