import {describe, expect, it} from '@jest/globals';
import {
  matchCard,
  prefillFor,
  prefillFromParams,
  prefillParams,
  targetFor,
  titleFor,
} from '../src/utils/smsImport';
import type {ParsedSms} from '../src/utils/sms/types';

const parsed: ParsedSms = {
  id: 'x',
  bank: 'hdfc',
  direction: 'debit',
  currency: 'INR',
  amountMinor: 50000,
  amount: '500.00',
  merchant: 'Coffee Shop',
  account: '1234',
  date: '2026-11-15',
  method: 'upi',
  reference: null,
};

describe('prefillFor', () => {
  it('fills title, amount, date and a description', () => {
    expect(prefillFor(parsed, 'INR')).toEqual({
      title: 'Coffee Shop',
      amount: '500.00',
      date: '2026-11-15',
      description: 'From a bank message (account ending 1234)',
    });
  });

  it('refuses a message in another currency than the person uses', () => {
    expect(prefillFor({...parsed, currency: 'USD'}, 'INR')).toBeNull();
  });

  it('describes a message with no merchant or account', () => {
    const fill = prefillFor({...parsed, merchant: null, account: null}, 'INR');
    expect(fill?.title).toBe('UPI payment');
    expect(fill?.description).toBe('From a bank message');
  });
});

describe('titleFor and targetFor', () => {
  it('names the transaction by method and direction when there is no merchant', () => {
    const base = {...parsed, merchant: null};
    expect(titleFor({...base, method: 'card'})).toBe('Card payment');
    expect(titleFor({...base, method: 'atm'})).toBe('Cash withdrawal');
    expect(titleFor({...base, direction: 'credit', method: 'transfer'})).toBe(
      'Bank transfer received',
    );
  });

  it('sends debits to expenses and credits to income', () => {
    expect(targetFor(parsed)).toBe('expense');
    expect(targetFor({...parsed, direction: 'credit'})).toBe('income');
  });
});

describe('prefillFromParams', () => {
  it('accepts well-formed values', () => {
    expect(
      prefillFromParams({
        title: ' Tea ',
        amount: '12.50',
        date: '2026-11-15',
        description: 'x',
      }),
    ).toEqual({
      title: 'Tea',
      amount: '12.50',
      date: '2026-11-15',
      description: 'x',
    });
  });

  it('drops malformed amounts and dates, and takes the first of repeated params', () => {
    expect(
      prefillFromParams({
        amount: '1e9',
        date: '15/11/2026',
        title: ['A', 'B'],
      }),
    ).toEqual({title: 'A'});
    expect(prefillFromParams({amount: '-5'})).toEqual({});
    expect(prefillFromParams({amount: '12.12345'})).toEqual({});
  });

  it('limits the length of text', () => {
    expect(prefillFromParams({title: 'a'.repeat(300)}).title).toHaveLength(100);
  });

  it('round-trips through route params', () => {
    const fill = prefillFor(parsed, 'INR')!;
    expect(prefillFromParams(prefillParams(fill))).toEqual(fill);
  });
});

describe('matching a bank message to a card', () => {
  const msg = (over: Partial<ParsedSms> = {}): ParsedSms => ({
    id: 'm',
    bank: 'hdfc',
    direction: 'debit',
    currency: 'INR',
    amountMinor: 100,
    amount: '1.00',
    merchant: null,
    account: '1234',
    date: '2026-11-19',
    method: 'card',
    reference: null,
    ...over,
  });
  const cards = [
    {id: 'a', last4: '1234', archived: false},
    {id: 'b', last4: '9999', archived: false},
    {id: 'c', last4: null, archived: false},
  ];

  it('picks the one card whose digits match a card payment', () => {
    expect(matchCard(msg(), cards)).toBe('a');
    expect(matchCard(msg({account: '234'}), cards)).toBe('a');
  });

  it('never guesses: no digits, UPI, credits, archived or two matches give null', () => {
    expect(matchCard(msg({account: null}), cards)).toBeNull();
    expect(matchCard(msg({method: 'upi'}), cards)).toBeNull();
    expect(matchCard(msg({direction: 'credit'}), cards)).toBeNull();
    expect(matchCard(msg(), [{...cards[0], archived: true}])).toBeNull();
    expect(
      matchCard(msg(), [cards[0], {id: 'd', last4: '1234', archived: false}]),
    ).toBeNull();
    expect(matchCard(msg({account: '5555'}), cards)).toBeNull();
  });

  it('accepts only a well-formed card id from route params', () => {
    expect(prefillFromParams({cardId: 'abc_12-3'}).cardId).toBe('abc_12-3');
    expect(prefillFromParams({cardId: 'a/b'}).cardId).toBeUndefined();
  });
});
