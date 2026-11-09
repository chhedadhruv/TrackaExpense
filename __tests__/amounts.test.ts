import {describe, expect, it} from '@jest/globals';
import {
  addMajor,
  balanceEffect,
  editBalanceDelta,
  savingsHistoryMoneyFields,
  subtractMajor,
  sumValuesMajor,
  majorOf,
  minorOf,
  totalMajor,
  transactionMoneyFields,
} from '../src/utils/amounts';

describe('minorOf', () => {
  it('prefers amountMinor when it is a safe integer', () => {
    expect(minorOf({amount: '999', amountMinor: 12345}, 'INR')).toBe(12345);
  });

  it('falls back to the legacy amount (string or number)', () => {
    expect(minorOf({amount: '12.5'}, 'INR')).toBe(1250);
    expect(minorOf({amount: 12.5}, 'INR')).toBe(1250);
    expect(minorOf({amount: '123.4567'}, 'INR')).toBe(12346);
  });

  it('ignores an amountMinor that is not a safe integer', () => {
    expect(minorOf({amount: '5', amountMinor: 1.5}, 'INR')).toBe(500);
    expect(minorOf({amount: '5', amountMinor: '500'}, 'INR')).toBe(500);
    expect(minorOf({amount: '5', amountMinor: NaN}, 'INR')).toBe(500);
  });

  it('re-derives when the stored currency has a different minor unit', () => {
    // A JPY document read while the user's currency is INR must not reuse the JPY integer.
    expect(
      minorOf({amount: '1235', amountMinor: 1235, currency: 'JPY'}, 'INR'),
    ).toBe(123500);
    expect(
      minorOf({amount: '1235', amountMinor: 1235, currency: 'JPY'}, 'JPY'),
    ).toBe(1235);
    expect(
      minorOf({amount: '5', amountMinor: 500, currency: 'USD'}, 'INR'),
    ).toBe(500);
  });

  it('returns null when nothing is usable', () => {
    expect(minorOf({}, 'INR')).toBeNull();
    expect(minorOf({amount: 'abc'}, 'INR')).toBeNull();
    expect(minorOf({amount: ''}, 'INR')).toBeNull();
    expect(minorOf({amount: null}, 'INR')).toBeNull();
    expect(
      minorOf({amount: '10000000000000000000000000000'}, 'INR'),
    ).toBeNull();
  });
});

describe('majorOf', () => {
  it('returns the exact major value', () => {
    expect(majorOf({amount: '123.45'}, 'INR')).toBe(123.45);
    expect(majorOf({amount: '1', amountMinor: 12345}, 'INR')).toBe(123.45);
    expect(majorOf({amount: '1234.5'}, 'JPY')).toBe(1235);
  });

  it('keeps the old float reading for an unconvertible value and 0 for garbage', () => {
    expect(majorOf({amount: '10000000000000000000000000000'}, 'INR')).toBe(
      1e28,
    );
    expect(majorOf({amount: 'abc'}, 'INR')).toBe(0);
    expect(majorOf({}, 'INR')).toBe(0);
  });
});

describe('totalMajor', () => {
  it('adds exactly where float addition drifts', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(totalMajor([{amount: '0.1'}, {amount: '0.2'}], 'INR')).toBe(0.3);
    expect(
      totalMajor([{amount: 0.1}, {amount: 0.2}, {amount: 0.3}], 'INR'),
    ).toBe(0.6);
  });

  it('mixes legacy and new documents', () => {
    expect(
      totalMajor([{amount: '10.5'}, {amount: 1, amountMinor: 250}], 'INR'),
    ).toBe(13);
  });

  it('leaves unconvertible documents out and handles empty input', () => {
    expect(
      totalMajor(
        [
          {amount: '5'},
          {amount: '10000000000000000000000000000'},
          {amount: 'x'},
        ],
        'INR',
      ),
    ).toBe(5);
    expect(totalMajor([], 'INR')).toBe(0);
  });

  it('sums a long list of small amounts exactly', () => {
    const docs = Array.from({length: 1000}, () => ({amount: '0.01'}));
    expect(totalMajor(docs, 'INR')).toBe(10);
  });
});

describe('transactionMoneyFields', () => {
  it('returns the minor amount and the currency', () => {
    expect(transactionMoneyFields('123.45', 'INR')).toEqual({
      amountMinor: 12345,
      currency: 'INR',
    });
    expect(transactionMoneyFields('1235', 'JPY')).toEqual({
      amountMinor: 1235,
      currency: 'JPY',
    });
  });

  it('leaves amountMinor out for an unconvertible amount', () => {
    expect(transactionMoneyFields('1e5', 'INR')).toEqual({currency: 'INR'});
    expect(transactionMoneyFields('', 'INR')).toEqual({currency: 'INR'});
  });
});

describe('balanceEffect', () => {
  it('is minus for an expense and plus for an income, from the rounded amount', () => {
    expect(balanceEffect('expense', {amount: '12.345'}, 'INR')).toBe(-12.35);
    expect(balanceEffect('income', {amount: '12.345'}, 'INR')).toBe(12.35);
    expect(balanceEffect('expense', {amount: 20}, 'INR')).toBe(-20);
    expect(
      balanceEffect('expense', {amount: '1', amountMinor: 250}, 'INR'),
    ).toBe(-2.5);
  });

  it('falls back to the old float reading when the amount cannot be converted', () => {
    expect(
      balanceEffect('income', {amount: '10000000000000000000000000000'}, 'INR'),
    ).toBe(1e28);
    expect(balanceEffect('expense', {amount: 'abc'}, 'INR')).toBe(-0);
  });

  it('adding then deleting a transaction cancels exactly, for any number of decimals', () => {
    for (const text of [
      '12.345',
      '0.005',
      '99.999',
      '1234.5678',
      '7',
      '0.1',
      '33.3333',
    ]) {
      for (const type of ['expense', 'income'] as const) {
        const added = balanceEffect(type, {amount: text}, 'INR');
        const deleted = -balanceEffect(
          type,
          {amount: text, amountMinor: minorOf({amount: text}, 'INR')},
          'INR',
        );
        expect(added + deleted).toBe(0);
      }
    }
  });

  it('add then edit equals adding the new amount directly', () => {
    const amounts = [
      '12.345',
      '20',
      '0.005',
      '99.999',
      '1234.5678',
      '7.1',
      '33.3333',
    ];
    for (const type of ['expense', 'income'] as const) {
      for (const from of amounts) {
        for (const to of amounts) {
          const viaEdit =
            balanceEffect(type, {amount: from}, 'INR') +
            (editBalanceDelta({amount: from}, type, to, 'INR') as number);
          expect(viaEdit).toBeCloseTo(
            balanceEffect(type, {amount: to}, 'INR'),
            9,
          );
        }
      }
    }
  });
});

describe('addMajor and subtractMajor', () => {
  it('are exact where float arithmetic drifts', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(addMajor(0.1, 0.2, 'INR')).toBe(0.3);
    expect(subtractMajor(0.3, 0.1, 'INR')).toBe(0.2);
    expect(0.3 - 0.1).not.toBe(0.2);
    expect(addMajor(1234.56, 0.01, 'INR')).toBe(1234.57);
    expect(subtractMajor(10, 0.01, 'INR')).toBe(9.99);
  });

  it('works for currencies without a minor unit and for whole numbers', () => {
    expect(addMajor(100, 50, 'INR')).toBe(150);
    expect(addMajor(1000, 235, 'JPY')).toBe(1235);
    expect(subtractMajor(0, 0, 'INR')).toBe(0);
  });

  it('adding then subtracting the same amount returns the starting value exactly', () => {
    for (const start of [0, 0.1, 12.34, 999.99, 123456.78]) {
      for (const delta of [0.01, 0.07, 0.1, 33.33, 1000.5]) {
        expect(subtractMajor(addMajor(start, delta, 'INR'), delta, 'INR')).toBe(
          start,
        );
      }
    }
  });

  it('falls back to the plain float result for values it cannot convert', () => {
    expect(addMajor(1e28, 1, 'INR')).toBe(1e28 + 1);
    expect(addMajor(NaN, 1, 'INR')).toBeNaN();
  });
});

describe('sumValuesMajor', () => {
  it('sums plain numbers and numeric strings exactly', () => {
    expect(sumValuesMajor([0.1, 0.2], 'INR')).toBe(0.3);
    expect(sumValuesMajor([100, '250.5', 0.25], 'INR')).toBe(350.75);
    expect(sumValuesMajor([], 'INR')).toBe(0);
  });

  it('leaves out values that are not usable amounts', () => {
    expect(
      sumValuesMajor([5, undefined, null, 'abc', {}, 1e28, 5], 'INR'),
    ).toBe(10);
  });
});

describe('savingsHistoryMoneyFields', () => {
  it('returns the minor amounts and the currency', () => {
    expect(
      savingsHistoryMoneyFields(
        {amount: 0.2, previousAmount: 0.1, newAmount: 0.3},
        'INR',
      ),
    ).toEqual({
      currency: 'INR',
      amountMinor: 20,
      previousAmountMinor: 10,
      newAmountMinor: 30,
    });
  });

  it('leaves out an amount that cannot be converted', () => {
    expect(
      savingsHistoryMoneyFields(
        {amount: 5, previousAmount: 1e28, newAmount: 6},
        'INR',
      ),
    ).toEqual({currency: 'INR', amountMinor: 500, newAmountMinor: 600});
  });
});

describe('editBalanceDelta', () => {
  it('has no float noise (33.3 - 11.1 is 22.199999999999996 in floats)', () => {
    expect(33.3 - 11.1).not.toBe(22.2);
    // Expense raised from 11.1 to 33.3: the balance goes down by 22.2.
    expect(editBalanceDelta({amount: '11.1'}, 'expense', '33.3', 'INR')).toBe(
      -22.2,
    );
    // Income raised from 11.1 to 33.3: the balance goes up by 22.2.
    expect(editBalanceDelta({amount: '11.1'}, 'income', '33.3', 'INR')).toBe(
      22.2,
    );
  });

  it('is zero for an unchanged amount and signed correctly for decreases', () => {
    expect(editBalanceDelta({amount: 10}, 'expense', '10', 'INR')).toBe(0);
    expect(editBalanceDelta({amount: 10}, 'expense', '4', 'INR')).toBe(6);
    expect(editBalanceDelta({amount: 10}, 'income', '4', 'INR')).toBe(-6);
  });

  it('uses amountMinor of the existing document when present', () => {
    expect(
      editBalanceDelta(
        {amount: '1', amountMinor: 5000},
        'expense',
        '40',
        'INR',
      ),
    ).toBe(10);
  });

  it('returns null so the caller can fall back when an amount cannot be converted', () => {
    expect(editBalanceDelta({amount: 'abc'}, 'expense', '5', 'INR')).toBeNull();
    expect(editBalanceDelta({amount: '5'}, 'expense', 'abc', 'INR')).toBeNull();
  });
});
