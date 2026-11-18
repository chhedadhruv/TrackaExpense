import {describe, expect, it} from '@jest/globals';
import {applyGuess, scanErrorMessage} from '../src/utils/receiptScan';

const empty = {title: '', amount: '', date: '2026-11-18'};
const guess = {
  amounts: ['1197.00', '1140.00', '28.50'],
  date: '2026-11-14',
  merchant: 'SPICE GARDEN RESTAURANT',
};

describe('applyGuess', () => {
  it('fills an empty form and offers the other amounts', () => {
    expect(applyGuess(guess, empty)).toEqual({
      title: 'SPICE GARDEN RESTAURANT',
      amount: '1197.00',
      date: '2026-11-14',
      alternatives: ['1140.00', '28.50'],
      filled: ['amount', 'title', 'date'],
      empty: false,
    });
  });

  it('never overwrites a typed title or amount, but offers the amounts that differ', () => {
    const fill = applyGuess(guess, {
      title: 'Dinner',
      amount: '1140.00',
      date: '2026-11-18',
    });
    expect(fill.title).toBeUndefined();
    expect(fill.amount).toBeUndefined();
    expect(fill.alternatives).toEqual(['1197.00', '28.50']);
    expect(fill.filled).toEqual(['date']);
  });

  it('leaves the date alone when it already matches or the receipt has none', () => {
    expect(
      applyGuess({...guess, date: '2026-11-18'}, empty).date,
    ).toBeUndefined();
    expect(applyGuess({...guess, date: null}, empty).date).toBeUndefined();
  });

  it('reports a scan that found nothing', () => {
    const fill = applyGuess({amounts: [], date: null, merchant: null}, empty);
    expect(fill.empty).toBe(true);
    expect(fill.filled).toEqual([]);
  });

  it('shortens a long merchant name to the title limit', () => {
    const fill = applyGuess({...guess, merchant: 'A'.repeat(150)}, empty);
    expect(fill.title).toHaveLength(100);
  });
});

describe('scanErrorMessage', () => {
  it('uses the server message for limits and unavailability, without the code prefix', () => {
    expect(
      scanErrorMessage({
        code: 'functions/resource-exhausted',
        message:
          '[functions/resource-exhausted] You have scanned the most receipts allowed for today.',
      }),
    ).toBe('You have scanned the most receipts allowed for today.');
  });

  it('hides everything else behind a plain message', () => {
    const plain = 'The receipt could not be scanned. Enter it by hand.';
    expect(
      scanErrorMessage({code: 'functions/internal', message: 'boom'}),
    ).toBe(plain);
    expect(scanErrorMessage(new Error('x'))).toBe(plain);
    expect(scanErrorMessage(null)).toBe(plain);
  });
});
