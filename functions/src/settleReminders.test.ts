import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {netDebts, owedByPerson, worthReminding} from './settleReminders';
import type {Fields} from './derive';

const split = (
  paidBy: string,
  amountMinor: number,
  users: string[],
  extra: Fields = {},
): Fields => ({
  paidBy: {email: paidBy},
  amountMinor,
  currency: 'INR',
  splitUsers: users.map(email => ({email})),
  ...extra,
});

describe('netDebts', () => {
  it('splits equally in minor units and nets the pair', () => {
    const debts = netDebts([
      split('a@x.com', 10000, ['a@x.com', 'b@x.com']),
      split('b@x.com', 2000, ['a@x.com', 'b@x.com']),
    ]);
    assert.deepEqual(debts, [
      {currency: 'INR', lender: 'a@x.com', borrower: 'b@x.com', minor: 4000},
    ]);
  });

  it('gives the extra minor unit to the first participant, so shares add up', () => {
    const debts = netDebts([
      split('a@x.com', 100, ['a@x.com', 'b@x.com', 'c@x.com']),
    ]);
    const total = debts.reduce((s, d) => s + d.minor, 0);
    assert.equal(total, 66);
  });

  it('applies a settlement entry and drops a cleared pair', () => {
    const debts = netDebts([
      split('a@x.com', 10000, ['a@x.com', 'b@x.com']),
      {
        type: 'settlement',
        paidBy: {email: 'B@x.com'},
        splitUsers: [{email: 'a@x.com'}],
        amountMinor: 5000,
        currency: 'INR',
      },
    ]);
    assert.deepEqual(debts, []);
  });

  it('supports percentage splits and skips splits without amountMinor', () => {
    const debts = netDebts([
      split('a@x.com', 10000, ['a@x.com', 'b@x.com'], {
        splitType: 'percentage',
        splitUsers: [
          {email: 'a@x.com', percentage: 70},
          {email: 'b@x.com', percentage: 30},
        ],
      }),
      {
        paidBy: {email: 'a@x.com'},
        splitUsers: [{email: 'b@x.com'}],
        amount: '5',
      },
    ]);
    assert.equal(debts.length, 1);
    assert.equal(debts[0].minor, 3000);
  });

  it('keeps currencies apart', () => {
    const debts = netDebts([
      split('a@x.com', 1000, ['b@x.com']),
      split('a@x.com', 1000, ['b@x.com'], {currency: 'USD'}),
    ]);
    assert.equal(debts.length, 2);
  });
});

describe('owedByPerson', () => {
  it('adds group debts and pending IOUs per currency', () => {
    const owed = owedByPerson(
      [{currency: 'INR', lender: 'a@x.com', borrower: 'b@x.com', minor: 4000}],
      [
        {fromEmail: 'B@x.com', amountMinor: 1000, currency: 'INR'},
        {fromEmail: 'b@x.com', amount: '5'},
      ],
    );
    assert.deepEqual(owed.get('b@x.com')?.get('INR'), {total: 5000, count: 2});
  });

  it('nets what a person owes against what they are owed, across groups', () => {
    // Me owes Sanaj 28583 in one group; Sanaj owes me 18105 in three others (the reported case).
    const debts = [
      {
        currency: 'INR',
        lender: 's@x.com',
        borrower: 'me@x.com',
        minor: 2858300,
      },
      {
        currency: 'INR',
        lender: 'me@x.com',
        borrower: 's@x.com',
        minor: 1114830,
      },
      {currency: 'INR', lender: 'me@x.com', borrower: 's@x.com', minor: 435725},
      {currency: 'INR', lender: 'me@x.com', borrower: 's@x.com', minor: 248998},
      {currency: 'INR', lender: 'y@x.com', borrower: 'me@x.com', minor: 134625},
      {currency: 'INR', lender: 'me@x.com', borrower: 'm@x.com', minor: 127575},
    ];
    const owed = owedByPerson(debts, []);
    // Owes Sanaj 2858300 - 1799553 = 1058747, owes Yash 134625, is owed 127575 by Mayu.
    assert.deepEqual(owed.get('me@x.com')?.get('INR'), {
      total: 1058747 + 134625 - 127575,
      count: 2,
    });
    // Sanaj is owed overall, so there is no entry for them.
    assert.equal(owed.get('s@x.com'), undefined);
  });

  it('has no entry for a person who is owed more than they owe', () => {
    const owed = owedByPerson(
      [
        {currency: 'INR', lender: 'a@x.com', borrower: 'b@x.com', minor: 1000},
        {currency: 'INR', lender: 'b@x.com', borrower: 'a@x.com', minor: 4000},
      ],
      [],
    );
    // a owes b 4000 and is owed 1000: 3000 overall. b is owed overall, so has no entry.
    assert.deepEqual(owed.get('a@x.com')?.get('INR'), {total: 3000, count: 1});
    assert.equal(owed.get('b@x.com'), undefined);
  });

  it('nets an IOU against a group debt with the same person', () => {
    const owed = owedByPerson(
      [{currency: 'INR', lender: 'a@x.com', borrower: 'b@x.com', minor: 5000}],
      [
        {
          fromEmail: 'a@x.com',
          toEmail: 'B@x.com',
          amountMinor: 2000,
          currency: 'INR',
        },
      ],
    );
    // b owes a 5000 in the group, a owes b 2000 by IOU: 3000 overall.
    assert.deepEqual(owed.get('b@x.com')?.get('INR'), {total: 3000, count: 1});
    assert.equal(owed.get('a@x.com'), undefined);
    const only = owedByPerson(
      [{currency: 'INR', lender: 'a@x.com', borrower: 'b@x.com', minor: 5000}],
      [
        {
          fromEmail: 'b@x.com',
          toEmail: 'a@x.com',
          amountMinor: 2000,
          currency: 'INR',
        },
      ],
    );
    assert.deepEqual(only.get('b@x.com')?.get('INR'), {total: 7000, count: 1});
  });

  it('keeps currencies apart', () => {
    const owed = owedByPerson(
      [
        {currency: 'INR', lender: 'a@x.com', borrower: 'b@x.com', minor: 1000},
        {currency: 'USD', lender: 'b@x.com', borrower: 'a@x.com', minor: 9000},
      ],
      [],
    );
    assert.deepEqual(owed.get('b@x.com')?.get('INR'), {total: 1000, count: 1});
    assert.deepEqual(owed.get('a@x.com')?.get('USD'), {total: 9000, count: 1});
  });
});

describe('worthReminding', () => {
  it('needs at least one whole unit', () => {
    assert.equal(worthReminding(99, 'INR'), false);
    assert.equal(worthReminding(100, 'INR'), true);
    assert.equal(worthReminding(99, 'JPY'), true);
  });
});
