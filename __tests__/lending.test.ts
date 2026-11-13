import {describe, expect, it} from '@jest/globals';
import {
  calculateNetLendingBalances,
  sameEmail,
  type LendingSplit,
} from '../src/utils/lending';
import {minorOf} from '../src/utils/amounts';
import {sharesMinor} from '../src/utils/splitMath';

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

  it('shows the debt when only the alphabetically later person paid', () => {
    const result = calculateNetLendingBalances(
      [split('z@x.com', ['a@x.com', 'z@x.com'], '100')],
      'INR',
    );
    expect(result).toEqual([
      {
        lender: {email: 'z@x.com', name: 'z'},
        borrower: {email: 'a@x.com', name: 'a'},
        amount: 50,
      },
    ]);
  });

  it('shows a row for each person the later payer paid for', () => {
    const result = calculateNetLendingBalances(
      [split('z@x.com', ['a@x.com', 'm@x.com', 'z@x.com'], '90')],
      'INR',
    );
    expect(result).toHaveLength(2);
    expect(result.every(r => r.lender.email === 'z@x.com')).toBe(true);
    expect(result.map(r => r.borrower.email).sort()).toEqual([
      'a@x.com',
      'm@x.com',
    ]);
    expect(result.map(r => r.amount)).toEqual([30, 30]);
  });

  it.each([
    ['a@x.com', 'z@x.com'],
    ['z@x.com', 'a@x.com'],
  ])(
    'reverses the row when %s is paid more than they were owed by %s',
    (lender, borrower) => {
      const result = calculateNetLendingBalances(
        [
          split(lender, [lender, borrower], '100'),
          split(borrower, [lender], '80', {type: 'settlement'}),
        ],
        'INR',
      );
      expect(result).toHaveLength(1);
      expect(result[0].lender.email).toBe(borrower);
      expect(result[0].borrower.email).toBe(lender);
      expect(result[0].amount).toBe(30);
    },
  );

  it.each([
    ['a@x.com', 'z@x.com'],
    ['z@x.com', 'a@x.com'],
  ])('shows a settlement from %s to %s that has no split', (from, to) => {
    const result = calculateNetLendingBalances(
      [split(from, [to], '25', {isSettlement: true})],
      'INR',
    );
    expect(result).toHaveLength(1);
    expect(result[0].lender.email).toBe(from);
    expect(result[0].borrower.email).toBe(to);
    expect(result[0].amount).toBe(25);
  });

  it('treats emails that differ only in case as one person and keeps the names', () => {
    const result = calculateNetLendingBalances(
      [
        {
          amount: '100',
          paidBy: {email: 'Zed@X.com', name: 'Zed'},
          splitUsers: [
            {email: 'Zed@X.com', name: 'Zed'},
            {email: 'Amy@X.com', name: 'Amy'},
          ],
        },
        {
          amount: '40',
          paidBy: {email: 'amy@x.com', name: 'Amy'},
          splitUsers: [
            {email: 'amy@x.com', name: 'Amy'},
            {email: 'zed@x.com', name: 'Zed'},
          ],
        },
      ],
      'INR',
    );
    expect(result).toEqual([
      {
        lender: {email: 'zed@x.com', name: 'Zed'},
        borrower: {email: 'amy@x.com', name: 'Amy'},
        amount: 30,
      },
    ]);
  });

  it('agrees with a per-person sum for every member', () => {
    const people = ['a@x.com', 'm@x.com', 'z@x.com'];
    const splits = [
      split('z@x.com', people, '100.01'),
      split('m@x.com', ['a@x.com', 'z@x.com'], '55.55'),
      split('a@x.com', people, '10'),
      split('a@x.com', ['z@x.com'], '20', {type: 'settlement'}),
      split('z@x.com', ['m@x.com'], '5.5', {isSettlement: true}),
      split('m@x.com', ['m@x.com', 'a@x.com'], '33.33'),
    ];
    // What the Friends screen does: for one person, the signed total with each other person.
    const netFor = (me: string): Record<string, number> => {
      const net: Record<string, number> = {};
      const add = (other: string, minor: number) => {
        net[other] = (net[other] ?? 0) + minor;
      };
      splits.forEach(s => {
        const payer = s.paidBy!.email!;
        if (s.type === 'settlement' || s.isSettlement) {
          const to = s.splitUsers![0].email!;
          const amount = minorOf(s, 'INR')!;
          if (payer === me) {
            add(to, amount);
          } else if (to === me) {
            add(payer, -amount);
          }
          return;
        }
        const shares = sharesMinor(s, 'INR')!;
        s.splitUsers!.forEach((u, i) => {
          if (u.email === payer) {
            return;
          }
          if (payer === me) {
            add(u.email!, shares[i]);
          } else if (u.email === me) {
            add(payer, -shares[i]);
          }
        });
      });
      return net;
    };

    const result = calculateNetLendingBalances(splits, 'INR');
    people.forEach(me => {
      const fromRows: Record<string, number> = {};
      result.forEach(r => {
        const minor = Math.round(r.amount * 100);
        if (r.lender.email === me) {
          fromRows[r.borrower.email] = minor;
        } else if (r.borrower.email === me) {
          fromRows[r.lender.email] = -minor;
        }
      });
      const expected = Object.fromEntries(
        Object.entries(netFor(me)).filter(([, minor]) => minor !== 0),
      );
      expect(fromRows).toEqual(expected);
    });
  });
});

describe('sameEmail', () => {
  it('ignores case and surrounding spaces', () => {
    expect(sameEmail(' Amy@X.com', 'amy@x.com ')).toBe(true);
    expect(sameEmail('amy@x.com', 'zed@x.com')).toBe(false);
  });

  it('is false when either side is missing', () => {
    expect(sameEmail(undefined, 'amy@x.com')).toBe(false);
    expect(sameEmail(null, null)).toBe(false);
  });
});
