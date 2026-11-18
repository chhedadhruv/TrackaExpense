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
});

describe('worthReminding', () => {
  it('needs at least one whole unit', () => {
    assert.equal(worthReminding(99, 'INR'), false);
    assert.equal(worthReminding(100, 'INR'), true);
    assert.equal(worthReminding(99, 'JPY'), true);
  });
});
