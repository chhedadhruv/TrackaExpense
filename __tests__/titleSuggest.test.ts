import {describe, expect, it} from '@jest/globals';
import {
  buildTitleIndex,
  splitsAsHistory,
  suggestTitles,
} from '../src/utils/titleSuggest';
import type {HistorySource} from '../src/utils/categorySuggest';

const ALLOWED = ['Food', 'Groceries', 'Travel', 'Shopping'];

const tx = (
  title: string,
  category: string,
  extra: Partial<HistorySource> = {},
): HistorySource => ({title, category, type: 'expense', ...extra});

// Newest first, like the transactions cache.
const index = buildTitleIndex(
  [
    tx('Swiggy  Instamart', 'Groceries'),
    tx('swiggy', 'Food'),
    tx('Swiggy', 'Shopping'),
    tx('Swiggy', 'Food'),
    tx('Uber to office', 'Travel'),
    tx('Big Swing ride', 'Travel'),
    tx('Mystery', 'Unknown category'),
    tx('Salary', 'Salary', {type: 'income'}),
    tx('Settlement: Test', 'Settlement'),
    tx('Swiggy split', 'Food', {splitRole: 'payer'}),
  ],
  'expense',
  ALLOWED,
);

const titles = (input: string, limit?: number) =>
  suggestTitles(index, input, limit).map(e => e.title);

describe('buildTitleIndex', () => {
  it('keeps one entry per title with the newest spelling and category', () => {
    const swiggy = index.find(e => e.key === 'swiggy');
    expect(swiggy).toEqual({
      key: 'swiggy',
      title: 'swiggy',
      category: 'Food',
      count: 3,
      newest: 1,
    });
    expect(index.find(e => e.key === 'swiggy instamart')?.title).toBe(
      'Swiggy Instamart',
    );
  });

  it('leaves out other types and entries the app wrote', () => {
    const keys = index.map(e => e.key);
    expect(keys).not.toContain('salary');
    expect(keys).not.toContain('settlement: test');
    expect(keys).not.toContain('swiggy split');
  });

  it('keeps a title whose category is not allowed, without a category', () => {
    expect(index.find(e => e.key === 'mystery')?.category).toBeNull();
  });
});

describe('suggestTitles', () => {
  it('needs two characters', () => {
    expect(titles('s')).toEqual([]);
    expect(titles('  ')).toEqual([]);
  });

  it('puts prefix matches first, most used then newest', () => {
    expect(titles('sw')).toEqual([
      'swiggy',
      'Swiggy Instamart',
      'Big Swing ride',
    ]);
  });

  it('matches the start of a later word', () => {
    expect(titles('off')).toEqual(['Uber to office']);
    expect(titles('ride')).toEqual(['Big Swing ride']);
  });

  it('does not offer the exact text already typed', () => {
    expect(titles('Swiggy')).toEqual(['Swiggy Instamart']);
  });

  it('matches multi-word input only as a prefix', () => {
    expect(titles('uber to')).toEqual(['Uber to office']);
    expect(titles('to office')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(titles('sw', 1)).toEqual(['swiggy']);
  });
});

describe('splitsAsHistory', () => {
  it('drops settlements and treats the rest as expenses', () => {
    expect(
      splitsAsHistory([
        {title: 'Dinner', category: 'Food'},
        {title: 'Settle', category: 'Settlement', type: 'settlement'},
        {title: 'Old settle', category: 'Others', isSettlement: true},
      ]),
    ).toEqual([{title: 'Dinner', category: 'Food', type: 'expense'}]);
  });
});
