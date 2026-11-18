import {describe, expect, it} from '@jest/globals';
import {
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
