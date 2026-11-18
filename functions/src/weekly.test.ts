import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {
  isQuietWeek,
  monthToSummarize,
  summarizeWeek,
  weekToSummarize,
} from './weekly';
import type {Fields} from './derive';

const tx = (
  type: string,
  amountMinor: number,
  dateISO: string,
  extra: Fields = {},
): Fields => ({
  type,
  amountMinor,
  dateISO,
  currency: 'INR',
  category: 'Food',
  ...extra,
});

describe('weekToSummarize', () => {
  it('returns the week only on Sunday at 9 in the zone', () => {
    // 2026-11-22 is a Sunday. 03:30 UTC is 09:00 in India.
    const range = weekToSummarize(
      Date.UTC(2026, 10, 22, 3, 30),
      'Asia/Kolkata',
    );
    assert.deepEqual(range, {
      key: '2026-11-22',
      start: '2026-11-16',
      end: '2026-11-22',
    });
  });

  it('is null at other hours and on other days', () => {
    assert.equal(
      weekToSummarize(Date.UTC(2026, 10, 22, 4, 30), 'Asia/Kolkata'),
      null,
    );
    assert.equal(
      weekToSummarize(Date.UTC(2026, 10, 23, 3, 30), 'Asia/Kolkata'),
      null,
    );
  });

  it('follows the zone: the same instant is a different local day elsewhere', () => {
    // Sunday 09:00 in New York (UTC-5 in November) is 14:00 UTC.
    const now = Date.UTC(2026, 10, 22, 14, 0);
    assert.notEqual(weekToSummarize(now, 'America/New_York'), null);
    assert.equal(weekToSummarize(now, 'Asia/Kolkata'), null);
  });

  it('falls back to the default zone for an invalid zone', () => {
    assert.notEqual(
      weekToSummarize(Date.UTC(2026, 10, 22, 3, 30), 'Not/AZone'),
      null,
    );
  });

  it('crosses a month boundary', () => {
    // Sunday 2026-11-01.
    const range = weekToSummarize(Date.UTC(2026, 10, 1, 3, 30), 'Asia/Kolkata');
    assert.equal(range?.start, '2026-10-26');
  });
});

describe('summarizeWeek', () => {
  const range = {key: '2026-11-22', start: '2026-11-16', end: '2026-11-22'};

  it('adds spending and income in minor units and finds the top category', () => {
    const s = summarizeWeek('INR', range, [
      tx('expense', 10010, '2026-11-17'),
      tx('expense', 20, '2026-11-18', {category: 'Fuel'}),
      tx('expense', 5000, '2026-11-22', {category: 'Fuel'}),
      tx('income', 300000, '2026-11-20'),
    ]);
    assert.equal(s.spentMinor, 15030);
    assert.equal(s.earnedMinor, 300000);
    assert.equal(s.expenseCount, 3);
    assert.equal(s.topCategory, 'Food');
    assert.equal(s.topCategoryMinor, 10010);
  });

  it('leaves out settlements, other currencies, missing minor amounts and other days', () => {
    const s = summarizeWeek('INR', range, [
      tx('expense', 100, '2026-11-17', {category: 'Settlement'}),
      tx('expense', 100, '2026-11-17', {isSettlement: true}),
      tx('expense', 100, '2026-11-17', {currency: 'USD'}),
      {type: 'expense', dateISO: '2026-11-17', currency: 'INR'},
      tx('expense', 100, '2026-11-15'),
      tx('expense', 100, '2026-11-23'),
    ]);
    assert.equal(s.spentMinor, 0);
    assert.equal(isQuietWeek(s), true);
  });

  it('breaks category ties alphabetically', () => {
    const s = summarizeWeek('INR', range, [
      tx('expense', 100, '2026-11-17', {category: 'Zoo'}),
      tx('expense', 100, '2026-11-17', {category: 'Art'}),
    ]);
    assert.equal(s.topCategory, 'Art');
  });
});

describe('monthToSummarize', () => {
  it('returns the month that ended, on the 1st at 9 local', () => {
    // 2026-12-01 03:30 UTC is 09:00 in India.
    assert.deepEqual(
      monthToSummarize(Date.UTC(2026, 11, 1, 3, 30), 'Asia/Kolkata'),
      {key: '2026-11', start: '2026-11-01', end: '2026-11-30'},
    );
  });

  it('handles January (previous year) and other days or hours', () => {
    assert.equal(
      monthToSummarize(Date.UTC(2027, 0, 1, 3, 30), 'Asia/Kolkata')?.key,
      '2026-12',
    );
    assert.equal(
      monthToSummarize(Date.UTC(2026, 11, 2, 3, 30), 'Asia/Kolkata'),
      null,
    );
    assert.equal(
      monthToSummarize(Date.UTC(2026, 11, 1, 5, 30), 'Asia/Kolkata'),
      null,
    );
  });
});
