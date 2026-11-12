import {describe, expect, it} from '@jest/globals';
import {
  calculateNetLendingBalances,
  type LendingSplit,
} from '../src/utils/lending';

const split = (
  paidBy: string,
  users: string[],
  amount: string,
  extra: Partial<LendingSplit> = {},
): LendingSplit => ({
  amount,
  paidBy: {email: paidBy, name: paidBy.split('@')[0]},
  splitUsers: users.map(email => ({email, name: email.split('@')[0]})),
  ...extra,
});

describe('calculateNetLendingBalances', () => {
  it('splits equally and shows who owes the payer', () => {
    const result = calculateNetLendingBalances(
      [split('a@x.com', ['a@x.com', 'b@x.com'], '100')],
      'INR',
    );
    expect(result).toEqual([
      {
        lender: {email: 'a@x.com', name: 'a'},
        borrower: {email: 'b@x.com', name: 'b'},
        amount: 50,
      },
    ]);
  });

  it('nets two splits that go in opposite directions', () => {
    const result = calculateNetLendingBalances(
      [
        split('a@x.com', ['a@x.com', 'b@x.com'], '100'),
        split('b@x.com', ['a@x.com', 'b@x.com'], '40'),
      ],
      'INR',
    );
    expect(result).toHaveLength(1);
    expect(result[0].lender.email).toBe('a@x.com');
    expect(result[0].amount).toBe(30);
  });

  it('gives the odd paisa to the first person and keeps the total exact', () => {
    const result = calculateNetLendingBalances(
      [split('a@x.com', ['b@x.com', 'c@x.com'], '100.01')],
      'INR',
    );
    const owed = result.reduce((sum, r) => sum + Math.round(r.amount * 100), 0);
    expect(owed).toBe(10001);
  });

  it('reduces the debt when a settlement is recorded', () => {
    const result = calculateNetLendingBalances(
      [
        split('a@x.com', ['a@x.com', 'b@x.com'], '100'),
        split('b@x.com', ['a@x.com'], '50', {type: 'settlement'}),
      ],
      'INR',
    );
    expect(result).toEqual([]);
  });

  it('ignores a split whose amount cannot be read', () => {
    expect(
      calculateNetLendingBalances(
        [split('a@x.com', ['a@x.com', 'b@x.com'], 'abc')],
        'INR',
      ),
    ).toEqual([]);
  });

  it('returns nothing for no splits', () => {
    expect(calculateNetLendingBalances([], 'INR')).toEqual([]);
  });
});
