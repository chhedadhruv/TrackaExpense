import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  alertId,
  cardRemindersAllowed,
  dueDateFor,
  owedMinor,
  parseCard,
  periodFor,
  reminderFor,
  reminderMessage,
  type Card,
} from './cardDue';

const card = (over: Partial<Card> = {}): Card => ({
  id: 'c1',
  name: 'HDFC',
  last4: '1234',
  statementDay: 15,
  dueDay: 3,
  currency: 'INR',
  archived: false,
  ...over,
});

describe('card reminder switch', () => {
  it('is off only for an explicit false', () => {
    assert.equal(cardRemindersAllowed(false), false);
    assert.equal(cardRemindersAllowed(true), true);
    assert.equal(cardRemindersAllowed(undefined), true);
    assert.equal(cardRemindersAllowed(null), true);
    assert.equal(cardRemindersAllowed('false'), true);
    assert.equal(cardRemindersAllowed(0), true);
  });
});

describe('card periods (mirror of the app)', () => {
  it('puts the statement day in the period that ends that day', () => {
    assert.deepEqual(periodFor(15, '2026-11-15'), {
      start: '2026-10-16',
      end: '2026-11-15',
    });
    assert.deepEqual(periodFor(15, '2026-11-16'), {
      start: '2026-11-16',
      end: '2026-12-15',
    });
  });

  it('crosses the year end and puts the due date in the right month', () => {
    assert.deepEqual(periodFor(5, '2026-12-20'), {
      start: '2026-12-06',
      end: '2027-01-05',
    });
    assert.equal(
      dueDateFor(15, 25, {start: '2026-10-16', end: '2026-11-15'}),
      '2026-11-25',
    );
    assert.equal(
      dueDateFor(15, 3, {start: '2026-10-16', end: '2026-11-15'}),
      '2026-12-03',
    );
  });
});

describe('reminderFor', () => {
  // Statement 15th, due the 3rd of the next month: the bill of 2026-11-15 is due 2026-12-03.
  it('reminds three days before and on the due date, not on other days', () => {
    assert.equal(reminderFor(card(), '2026-11-30')?.stage, 'soon');
    assert.equal(reminderFor(card(), '2026-12-03')?.stage, 'today');
    assert.equal(reminderFor(card(), '2026-12-01'), null);
    assert.equal(reminderFor(card(), '2026-12-04'), null);
    assert.equal(reminderFor(card(), '2026-11-20'), null);
  });

  it('is about the latest finished period', () => {
    assert.equal(reminderFor(card(), '2026-11-30')?.period.end, '2026-11-15');
    assert.equal(reminderFor(card(), '2026-12-03')?.period.end, '2026-11-15');
  });

  it('works when the due day is after the statement day', () => {
    const c = card({dueDay: 25});
    assert.equal(reminderFor(c, '2026-11-22')?.stage, 'soon');
    assert.equal(reminderFor(c, '2026-11-25')?.stage, 'today');
  });

  it('does nothing without a due day', () => {
    assert.equal(reminderFor(card({dueDay: null}), '2026-12-03'), null);
  });
});

describe('owedMinor', () => {
  const period = {start: '2026-10-16', end: '2026-11-15'};
  it('sums purchases minus refunds of this card and period only', () => {
    const txs = [
      {cardId: 'c1', type: 'expense', amountMinor: 10000, date: '2026-10-20'},
      {cardId: 'c1', type: 'income', amountMinor: 2500, date: '2026-11-01'},
      {cardId: 'c2', type: 'expense', amountMinor: 999, date: '2026-10-20'},
      {cardId: 'c1', type: 'expense', amountMinor: 999, date: '2026-11-16'},
      {
        cardId: 'c1',
        type: 'expense',
        amountMinor: 999,
        date: '2026-11-02',
        source: 'card_payment',
      },
      {
        cardId: 'c1',
        type: 'expense',
        amountMinor: 999,
        date: '2026-10-21',
        currency: 'USD',
      },
    ];
    assert.equal(owedMinor(card(), period, txs), 7500);
  });
});

describe('parseCard and messages', () => {
  it('reads valid cards and refuses unusable ones', () => {
    assert.equal(
      parseCard('x', {name: 'A', statementDay: 10, currency: 'inr'})?.currency,
      'INR',
    );
    assert.equal(parseCard('x', {name: 'A', statementDay: 40}), null);
    assert.equal(parseCard('x', null), null);
  });

  it('names the marker and writes plain ASCII text', () => {
    assert.equal(
      alertId('c1', {start: 'a', end: '2026-11-15'}, 'soon'),
      'c1_2026-11-15_soon',
    );
    const m = reminderMessage(card(), 'soon', '123.45', 'INR');
    assert.match(m.body, /HDFC 1234: 123.45 INR is due in 3 days/);
    assert.ok(/^[\x20-\x7e]*$/.test(m.title + m.body));
  });
});
