import {describe, expect, it} from '@jest/globals';
import {
  daysBetween,
  dueDateFor,
  inPeriod,
  nextPeriod,
  paymentIdFor,
  periodFor,
  previousPeriod,
} from '../src/utils/cardPeriods';
import {
  cardIdOf,
  currentBill,
  isCardPayment,
  parseCardDoc,
  periodOwedMinor,
  periodTransactions,
  recentPeriods,
  validateCardInput,
} from '../src/utils/cards';
import {balanceEffect, editBalanceDelta} from '../src/utils/amounts';

describe('billing periods', () => {
  it('puts a date on the statement day in the period that ends that day', () => {
    expect(periodFor(15, '2026-11-15')).toEqual({
      start: '2026-10-16',
      end: '2026-11-15',
    });
  });

  it('starts a new period the day after the statement day', () => {
    expect(periodFor(15, '2026-11-16')).toEqual({
      start: '2026-11-16',
      end: '2026-12-15',
    });
  });

  it('crosses the year end', () => {
    expect(periodFor(5, '2026-12-20')).toEqual({
      start: '2026-12-06',
      end: '2027-01-05',
    });
    expect(periodFor(5, '2027-01-03')).toEqual({
      start: '2026-12-06',
      end: '2027-01-05',
    });
  });

  it('handles a statement day of 28 around a short February', () => {
    expect(periodFor(28, '2027-03-01')).toEqual({
      start: '2027-03-01',
      end: '2027-03-28',
    });
    expect(periodFor(28, '2027-02-28')).toEqual({
      start: '2027-01-29',
      end: '2027-02-28',
    });
  });

  it('rejects malformed input', () => {
    expect(periodFor(0, '2026-11-15')).toBeNull();
    expect(periodFor(29, '2026-11-15')).toBeNull();
    expect(periodFor(15, '2026-11')).toBeNull();
  });

  it('walks to the previous and next period without gaps', () => {
    const p = periodFor(15, '2026-11-20');
    expect(p).not.toBeNull();
    const prev = previousPeriod(15, p!);
    const next = nextPeriod(15, p!);
    expect(prev).toEqual({start: '2026-10-16', end: '2026-11-15'});
    expect(next).toEqual({start: '2026-12-16', end: '2027-01-15'});
    expect(inPeriod(p!, '2026-11-16')).toBe(true);
    expect(inPeriod(p!, '2026-12-15')).toBe(true);
    expect(inPeriod(p!, '2026-12-16')).toBe(false);
  });

  it('puts the due date in the statement month or the next one', () => {
    const period = {start: '2026-10-16', end: '2026-11-15'};
    expect(dueDateFor(15, 25, period)).toBe('2026-11-25');
    expect(dueDateFor(15, 5, period)).toBe('2026-12-05');
    expect(dueDateFor(15, null, period)).toBeNull();
  });

  it('counts whole days and builds the payment id', () => {
    expect(daysBetween('2026-11-19', '2026-11-22')).toBe(3);
    expect(daysBetween('2026-11-22', '2026-11-19')).toBe(-3);
    expect(paymentIdFor('c1', {start: '2026-10-16', end: '2026-11-15'})).toBe(
      'c1_2026-11-15',
    );
  });
});

describe('card documents', () => {
  it('reads a valid document and drops an unusable one', () => {
    expect(
      parseCardDoc('c1', {
        name: 'HDFC',
        last4: '1234',
        statementDay: 15,
        dueDay: 3,
        currency: 'INR',
      }),
    ).toEqual({
      id: 'c1',
      name: 'HDFC',
      last4: '1234',
      statementDay: 15,
      dueDay: 3,
      currency: 'INR',
      archived: false,
    });
    expect(
      parseCardDoc('c2', {name: 'X', statementDay: 40, currency: 'INR'}),
    ).toBeNull();
    expect(parseCardDoc('c3', null)).toBeNull();
  });

  it('validates what a person typed', () => {
    const ok = {name: 'Axis', last4: '', statementDay: 10, dueDay: null};
    expect(validateCardInput(ok)).toBeNull();
    expect(validateCardInput({...ok, name: '  '})).toBe('name');
    expect(validateCardInput({...ok, last4: '12a4'})).toBe('last4');
    expect(validateCardInput({...ok, statementDay: null})).toBe('statementDay');
    expect(validateCardInput({...ok, dueDay: 31})).toBe('dueDay');
  });

  it('reads the card of a transaction and recognises a bill payment', () => {
    expect(cardIdOf({cardId: 'c1'})).toBe('c1');
    expect(cardIdOf({cardId: ''})).toBeNull();
    expect(cardIdOf({})).toBeNull();
    expect(isCardPayment({source: 'card_payment'})).toBe(true);
    expect(isCardPayment({source: 'split'})).toBe(false);
  });
});

describe('what a card owes', () => {
  const card = {id: 'c1', currency: 'INR'};
  const period = {start: '2026-10-16', end: '2026-11-15'};
  const txs = [
    {
      type: 'expense',
      cardId: 'c1',
      amountMinor: 10050,
      currency: 'INR',
      date: '2026-10-20',
    },
    {type: 'expense', cardId: 'c1', amount: '20.25', date: '2026-11-15'},
    {
      type: 'income',
      cardId: 'c1',
      amountMinor: 5000,
      currency: 'INR',
      date: '2026-11-01',
    },
    // other card, cash, outside the period, other currency, the bill payment itself
    {
      type: 'expense',
      cardId: 'c2',
      amountMinor: 999,
      currency: 'INR',
      date: '2026-10-20',
    },
    {type: 'expense', amountMinor: 999, currency: 'INR', date: '2026-10-20'},
    {
      type: 'expense',
      cardId: 'c1',
      amountMinor: 999,
      currency: 'INR',
      date: '2026-11-16',
    },
    {
      type: 'expense',
      cardId: 'c1',
      amountMinor: 999,
      currency: 'USD',
      date: '2026-10-21',
    },
    {
      type: 'expense',
      cardId: 'c1',
      source: 'card_payment',
      amountMinor: 999,
      currency: 'INR',
      date: '2026-11-02',
    },
  ];

  it('sums purchases minus refunds in integer minor units', () => {
    expect(periodOwedMinor(card, period, txs)).toBe(10050 + 2025 - 5000);
  });

  it('lists only that card and period, newest first', () => {
    const list = periodTransactions(card, period, txs);
    expect(list.map(t => t.date)).toEqual([
      '2026-11-15',
      '2026-11-01',
      '2026-10-20',
    ]);
  });

  it('finds the current bill and the recent periods', () => {
    const bill = currentBill({statementDay: 15, dueDay: 3}, '2026-11-20');
    expect(bill?.period).toEqual({start: '2026-11-16', end: '2026-12-15'});
    expect(bill?.dueDate).toBe('2027-01-03');
    const recent = recentPeriods(15, '2026-11-20', 3);
    expect(recent.map(p => p.end)).toEqual([
      '2026-12-15',
      '2026-11-15',
      '2026-10-15',
    ]);
  });
});

describe('the balance and a card', () => {
  it('leaves the balance alone for a card purchase', () => {
    expect(balanceEffect('expense', {amount: '100', cardId: 'c1'}, 'INR')).toBe(
      0,
    );
    expect(balanceEffect('expense', {amount: '100'}, 'INR')).toBe(-100);
    expect(balanceEffect('income', {amount: '40', cardId: 'c1'}, 'INR')).toBe(
      0,
    );
  });

  it('keeps add, edit and delete cancelling when the method changes', () => {
    const cash = {amountMinor: 10000, currency: 'INR'};
    // cash to card: the 100.00 already taken is given back
    expect(editBalanceDelta(cash, 'expense', '100', 'INR', 'c1')).toBe(100);
    // card to cash: 100.00 is taken now
    expect(
      editBalanceDelta({...cash, cardId: 'c1'}, 'expense', '100', 'INR', null),
    ).toBe(-100);
    // card to card with a new amount: nothing moves
    expect(
      editBalanceDelta({...cash, cardId: 'c1'}, 'expense', '250', 'INR'),
    ).toBe(0);
    // cash to cash keeps the old behaviour
    expect(editBalanceDelta(cash, 'expense', '250', 'INR', null)).toBe(-150);
    expect(editBalanceDelta(cash, 'expense', '250', 'INR')).toBe(-150);
  });
});

describe('statistics and a paid card bill', () => {
  it('leaves the bill payment out of the range filter', () => {
    const {filterByRange} = require('../src/utils/statistics');
    const kept = filterByRange(
      [
        {type: 'expense', amountMinor: 100, date: '2026-11-02'},
        {
          type: 'expense',
          amountMinor: 900,
          date: '2026-11-02',
          source: 'card_payment',
        },
      ],
      {start: null, end: null},
    );
    expect(kept).toHaveLength(1);
  });
});

describe('payment method views', () => {
  const {byPaymentMethod} = require('../src/utils/statistics');
  const {
    filterTransactions,
    CASH_FILTER,
  } = require('../src/utils/transactionFilter');
  const ts = (iso: string) => ({toDate: () => new Date(iso)});
  const txs = [
    {
      type: 'expense',
      amountMinor: 1000,
      currency: 'INR',
      date: '2026-11-02',
      cardId: 'c1',
    },
    {
      type: 'expense',
      amountMinor: 500,
      currency: 'INR',
      date: '2026-11-03',
      cardId: 'c1',
    },
    {type: 'expense', amountMinor: 700, currency: 'INR', date: '2026-11-04'},
    {type: 'income', amountMinor: 9999, currency: 'INR', date: '2026-11-04'},
  ];

  it('splits spending by card and cash, adding up to the total', () => {
    const rows = byPaymentMethod(txs, 'expense', 'INR', {c1: 'HDFC'});
    expect(rows.map((r: {name: string}) => r.name)).toEqual([
      'HDFC',
      'Cash / UPI',
    ]);
    expect(rows.reduce((s: number, r: {minor: number}) => s + r.minor, 0)).toBe(
      2200,
    );
  });

  it('filters by card and by cash only', () => {
    const base = {
      period: 'all',
      customStart: null,
      customEnd: null,
      query: '',
      tag: null,
    };
    const list = txs.map((t, i) => ({
      ...t,
      title: `t${i}`,
      amount: '1',
      createdAt: ts('2026-11-02T00:00:00Z'),
    }));
    expect(filterTransactions(list, {...base, card: 'c1'})).toHaveLength(2);
    expect(filterTransactions(list, {...base, card: CASH_FILTER})).toHaveLength(
      2,
    );
    expect(filterTransactions(list, {...base, card: null})).toHaveLength(4);
  });
});

describe('bills still to pay', () => {
  const {unpaidBills} = require('../src/utils/cards');
  const cards = [
    {
      id: 'a',
      name: 'A',
      last4: null,
      statementDay: 15,
      dueDay: 3,
      currency: 'INR',
      archived: false,
    },
    {
      id: 'b',
      name: 'B',
      last4: null,
      statementDay: 15,
      dueDay: 25,
      currency: 'INR',
      archived: false,
    },
    {
      id: 'z',
      name: 'Z',
      last4: null,
      statementDay: 15,
      dueDay: 3,
      currency: 'INR',
      archived: true,
    },
  ];
  const txs = [
    {
      type: 'expense',
      cardId: 'a',
      amountMinor: 1000,
      currency: 'INR',
      date: '2026-11-02',
    },
    {
      type: 'expense',
      cardId: 'b',
      amountMinor: 2000,
      currency: 'INR',
      date: '2026-11-03',
    },
    {
      type: 'expense',
      cardId: 'z',
      amountMinor: 3000,
      currency: 'INR',
      date: '2026-11-03',
    },
  ];

  it('lists made, unpaid bills soonest due first, skipping archived cards', () => {
    const bills = unpaidBills(cards, new Set(), txs, '2026-11-20');
    expect(bills.map((b: {card: {id: string}}) => b.card.id)).toEqual([
      'b',
      'a',
    ]);
    expect(bills[0].dueDate).toBe('2026-11-25');
    expect(bills[1].owedMinor).toBe(1000);
  });

  it('leaves out a paid bill and an empty period, and counts a statement made today', () => {
    expect(
      unpaidBills(cards, new Set(['a_2026-11-15']), txs, '2026-11-20').map(
        (b: {card: {id: string}}) => b.card.id,
      ),
    ).toEqual(['b']);
    expect(unpaidBills(cards, new Set(), txs, '2026-12-20')).toEqual([]);
    expect(
      unpaidBills(cards, new Set(), txs, '2026-11-15').map(
        (b: {card: {id: string}}) => b.card.id,
      ),
    ).toEqual(['b', 'a']);
  });
});
