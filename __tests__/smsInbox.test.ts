import {describe, expect, it} from '@jest/globals';
import {
  addHandled,
  isNamedSender,
  LOOKBACK_DAYS,
  MAX_HANDLED,
  offersFrom,
  sinceFor,
} from '../src/utils/smsInbox';

const NOW = new Date(2026, 10, 22, 12, 0).getTime();
const DEBIT =
  'Rs.500.00 debited from a/c **1234 on 15-11-26 to VPA coffee.shop@okhdfc (UPI Ref No 123456789012).';
const CREDIT =
  'Rs.2,000.00 credited to a/c **1234 on 16-11-26 by a/c linked to mobile no 98XXXXX123 (IMPS Ref No 123456789013)';

describe('isNamedSender', () => {
  it('accepts bank sender ids', () => {
    expect(isNamedSender('VM-HDFCBK')).toBe(true);
    expect(isNamedSender('AX-SBIINB')).toBe(true);
  });

  it('rejects phone numbers', () => {
    expect(isNamedSender('+919812345678')).toBe(false);
    expect(isNamedSender('98123 45678')).toBe(false);
    expect(isNamedSender('')).toBe(false);
  });
});

describe('sinceFor', () => {
  it('looks back the configured number of days', () => {
    expect(NOW - sinceFor(NOW)).toBe(LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  });
});

describe('offersFrom', () => {
  it('offers payments and deposits, newest first', () => {
    const offers = offersFrom(
      [
        {sender: 'VM-HDFCBK', body: DEBIT, date: NOW - 2000},
        {sender: 'VM-HDFCBK', body: CREDIT, date: NOW - 1000},
      ],
      new Set(),
    );
    expect(offers.map(o => o.parsed.direction)).toEqual(['credit', 'debit']);
    expect(offers[1].parsed.amountMinor).toBe(50000);
  });

  it('skips messages from a phone number', () => {
    expect(
      offersFrom(
        [{sender: '+919812345678', body: DEBIT, date: NOW}],
        new Set(),
      ),
    ).toEqual([]);
  });

  it('skips one-time passwords and other non-transactions', () => {
    expect(
      offersFrom(
        [
          {
            sender: 'VM-HDFCBK',
            body: '123456 is your OTP for a payment of Rs.500.00. Do not share it.',
            date: NOW,
          },
          {sender: 'VM-HDFCBK', body: 'Happy Diwali from your bank', date: NOW},
        ],
        new Set(),
      ),
    ).toEqual([]);
  });

  it('does not offer a handled message again', () => {
    const [first] = offersFrom(
      [{sender: 'VM-HDFCBK', body: DEBIT, date: NOW}],
      new Set(),
    );
    expect(
      offersFrom(
        [{sender: 'VM-HDFCBK', body: DEBIT, date: NOW}],
        new Set([first.parsed.id]),
      ),
    ).toEqual([]);
  });

  it('offers an identical message once', () => {
    const message = {sender: 'VM-HDFCBK', body: DEBIT, date: NOW};
    expect(offersFrom([message, message], new Set())).toHaveLength(1);
  });
});

describe('addHandled', () => {
  it('appends new ids without repeats', () => {
    expect(addHandled(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('keeps only the newest ids', () => {
    const current = Array.from({length: MAX_HANDLED}, (_, i) => `id${i}`);
    const next = addHandled(current, ['new']);
    expect(next).toHaveLength(MAX_HANDLED);
    expect(next[next.length - 1]).toBe('new');
    expect(next).not.toContain('id0');
  });
});
