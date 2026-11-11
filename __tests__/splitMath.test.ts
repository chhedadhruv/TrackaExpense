import {describe, expect, it} from '@jest/globals';
import {sumMinor} from '../src/utils/money';
import {
  isSettlementEntry,
  shareOfMinor,
  sharesMinor,
  totalSpentMajor,
} from '../src/utils/splitMath';

const users = (...emails: string[]) => emails.map(email => ({email}));

describe('sharesMinor, equal split', () => {
  it('splits evenly when it divides exactly', () => {
    expect(
      sharesMinor({amount: 100, splitUsers: users('a', 'b')}, 'INR'),
    ).toEqual([5000, 5000]);
  });

  it('gives the extra minor unit to the first participants and always sums to the total', () => {
    const shares = sharesMinor(
      {amount: 100, splitUsers: users('a', 'b', 'c')},
      'INR',
    );
    expect(shares).toEqual([3334, 3333, 3333]);
    expect(sumMinor(shares as number[])).toBe(10000);
  });

  it('uses amountMinor when present and the legacy amount otherwise', () => {
    expect(
      sharesMinor(
        {amount: '1', amountMinor: 3000, splitUsers: users('a', 'b')},
        'INR',
      ),
    ).toEqual([1500, 1500]);
    expect(
      sharesMinor({amount: '30', splitUsers: users('a', 'b')}, 'INR'),
    ).toEqual([1500, 1500]);
  });

  it('is equal when splitType is missing or not percentage', () => {
    expect(
      sharesMinor(
        {
          amount: 10,
          splitUsers: [
            {email: 'a', percentage: 90},
            {email: 'b', percentage: 10},
          ],
        },
        'INR',
      ),
    ).toEqual([500, 500]);
    expect(
      sharesMinor(
        {amount: 10, splitType: 'equal', splitUsers: users('a', 'b')},
        'INR',
      ),
    ).toEqual([500, 500]);
  });
});

describe('sharesMinor, percentage split', () => {
  it('splits by percentage', () => {
    const split = {
      amount: 200,
      splitType: 'percentage',
      splitUsers: [
        {email: 'a', percentage: 50},
        {email: 'b', percentage: 30},
        {email: 'c', percentage: 20},
      ],
    };
    expect(sharesMinor(split, 'INR')).toEqual([10000, 6000, 4000]);
  });

  it('adds up exactly for awkward percentages', () => {
    const split = {
      amount: 100,
      splitType: 'percentage',
      splitUsers: [
        {email: 'a', percentage: 33.33},
        {email: 'b', percentage: 33.33},
        {email: 'c', percentage: 33.34},
      ],
    };
    const shares = sharesMinor(split, 'INR') as number[];
    expect(shares).toEqual([3333, 3333, 3334]);
    expect(sumMinor(shares)).toBe(10000);
  });

  it('gives everyone zero when all percentages are zero or missing', () => {
    expect(
      sharesMinor(
        {amount: 50, splitType: 'percentage', splitUsers: users('a', 'b')},
        'INR',
      ),
    ).toEqual([0, 0]);
  });
});

describe('sharesMinor, edge cases', () => {
  it('returns null for an unconvertible total and [] without participants', () => {
    expect(
      sharesMinor({amount: 'abc', splitUsers: users('a')}, 'INR'),
    ).toBeNull();
    expect(
      sharesMinor(
        {amount: '10000000000000000000000000000', splitUsers: users('a')},
        'INR',
      ),
    ).toBeNull();
    expect(sharesMinor({amount: 10, splitUsers: []}, 'INR')).toEqual([]);
    expect(sharesMinor({amount: 10}, 'INR')).toEqual([]);
  });

  it('works for currencies without a minor unit', () => {
    expect(
      sharesMinor({amount: 100, splitUsers: users('a', 'b', 'c')}, 'JPY'),
    ).toEqual([34, 33, 33]);
  });

  it('every split of any total adds up exactly', () => {
    for (let total = 0; total <= 500; total += 1) {
      for (const n of [1, 2, 3, 4, 7]) {
        const shares = sharesMinor(
          {
            amount: total / 100,
            splitUsers: users(...Array.from({length: n}, (_, i) => `u${i}`)),
          },
          'INR',
        ) as number[];
        expect(sumMinor(shares)).toBe(total);
      }
    }
  });
});

describe('shareOfMinor', () => {
  it('finds a participant case-insensitively', () => {
    const split = {
      amount: 100,
      splitUsers: users('A@x.com', 'b@x.com', 'c@x.com'),
    };
    expect(shareOfMinor(split, 'a@x.com', 'INR')).toBe(3334);
    expect(shareOfMinor(split, 'B@X.COM', 'INR')).toBe(3333);
  });

  it('returns null for a non-participant, no email, or an unconvertible total', () => {
    const split = {amount: 100, splitUsers: users('a@x.com')};
    expect(shareOfMinor(split, 'z@x.com', 'INR')).toBeNull();
    expect(shareOfMinor(split, null, 'INR')).toBeNull();
    expect(
      shareOfMinor(
        {amount: 'x', splitUsers: users('a@x.com')},
        'a@x.com',
        'INR',
      ),
    ).toBeNull();
  });
});

describe('totalSpentMajor', () => {
  it('leaves settlement entries out of the total', () => {
    const splits = [
      {amount: 100, amountMinor: 10000},
      {amount: 50.5, amountMinor: 5050},
      {amount: 80, amountMinor: 8000, type: 'settlement'},
      {amount: 20, amountMinor: 2000, isSettlement: true},
    ];
    expect(totalSpentMajor(splits, 'INR')).toBe(150.5);
  });

  it('is zero when only settlements exist', () => {
    expect(totalSpentMajor([{amount: 5, type: 'settlement'}], 'INR')).toBe(0);
  });

  it('recognises both settlement markers', () => {
    expect(isSettlementEntry({type: 'settlement'})).toBe(true);
    expect(isSettlementEntry({isSettlement: true})).toBe(true);
    expect(isSettlementEntry({type: 'expense'})).toBe(false);
  });
});
