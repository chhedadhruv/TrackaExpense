import {describe, expect, it} from '@jest/globals';
import {
  EMPTY_HISTORY,
  buildCategoryHistory,
  filterCategories,
  guessCategory,
  isLearnable,
  keywordCategory,
  normalizeTitle,
  suggestedCategories,
  tokenize,
  type HistorySource,
} from '../src/utils/categorySuggest';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_KEYWORD_MAP,
  GOAL_KEYWORD_MAP,
  INCOME_CATEGORIES,
  INCOME_KEYWORD_MAP,
  SPLIT_CATEGORIES,
  SPLIT_KEYWORD_MAP,
} from '../utils/CategoryData';

const EXPENSE = EXPENSE_CATEGORIES.map(c => c.value);
const INCOME = INCOME_CATEGORIES.map(c => c.value);
const SPLIT = SPLIT_CATEGORIES.map(c => c.value);

const guessExpense = (title: string, history = EMPTY_HISTORY) =>
  guessCategory(title, {
    keywordMap: EXPENSE_KEYWORD_MAP,
    history,
    allowed: EXPENSE,
  });

const tx = (
  title: string,
  category: string,
  extra: Partial<HistorySource> = {},
): HistorySource => ({title, category, type: 'expense', ...extra});

describe('normalizeTitle and tokenize', () => {
  it('folds case and spacing', () => {
    expect(normalizeTitle('  Swiggy   Order ')).toBe('swiggy order');
  });

  it('splits on punctuation', () => {
    expect(tokenize('Zomato-order, #2 (dinner)')).toEqual([
      'zomato',
      'order',
      '2',
      'dinner',
    ]);
  });
});

describe('keywordCategory', () => {
  const kw = (title: string) =>
    keywordCategory(title, EXPENSE_KEYWORD_MAP, EXPENSE);

  it('matches whole words only', () => {
    expect(kw('Coca cola')).toBeNull();
    expect(kw('business lunch')).toBe('Food');
    expect(kw('phone upgrade')).toBeNull();
    expect(kw('Ola to office')).toBe('Travel');
    expect(kw('Bus pass')).toBe('Travel');
  });

  it('matches plurals of the last word', () => {
    expect(kw('Two pizzas')).toBe('Food');
    expect(kw('Buses')).toBe('Travel');
  });

  it('prefers the longest keyword', () => {
    expect(kw('Amazon Prime renewal')).toBe('Entertainment');
    expect(kw('Amazon order')).toBe('Shopping');
    expect(kw('Monthly house rent')).toBe('Rent');
  });

  it('ignores keywords for categories that are not allowed', () => {
    expect(keywordCategory('Uber', EXPENSE_KEYWORD_MAP, ['Food'])).toBeNull();
  });

  it('maps split keywords to split categories', () => {
    expect(keywordCategory('Uber home', SPLIT_KEYWORD_MAP, SPLIT)).toBe(
      'Transport',
    );
    expect(keywordCategory('Blinkit', SPLIT_KEYWORD_MAP, SPLIT)).toBe('Food');
    expect(keywordCategory('Goa hotel', SPLIT_KEYWORD_MAP, SPLIT)).toBeNull();
  });
});

describe('isLearnable', () => {
  it('skips entries the app wrote itself', () => {
    expect(isLearnable(tx('Settle up', 'Settlement'))).toBe(false);
    expect(isLearnable(tx('IOU', 'IOU'))).toBe(false);
    expect(isLearnable(tx('HDFC', 'Card bill'))).toBe(false);
    expect(isLearnable(tx('Fix', 'Food', {source: 'card_payment'}))).toBe(
      false,
    );
    expect(
      isLearnable(tx('Fix', 'Others', {source: 'balance_adjustment'})),
    ).toBe(false);
    expect(isLearnable(tx('Dinner', 'Food', {splitRole: 'payer'}))).toBe(false);
    expect(isLearnable(tx('Dinner', ''))).toBe(false);
    expect(isLearnable(tx('Dinner', 'Food', {source: 'recurring'}))).toBe(true);
  });
});

describe('buildCategoryHistory and guessCategory', () => {
  // Newest first, like the transactions cache.
  const history = buildCategoryHistory(
    [
      tx('Chai Point', 'Food'),
      tx('chai point', 'Shopping'),
      tx('Swiggy Instamart', 'Groceries'),
      tx('Swiggy dinner', 'Food'),
      tx('Swiggy lunch', 'Food'),
      tx('Salary', 'Salary', {type: 'income'}),
      tx('Settle up', 'Settlement'),
      tx('UPI payment', 'Bills'),
      tx('Old thing', 'Transport'),
    ],
    'expense',
    EXPENSE,
  );

  it('uses the newest category for an exact title', () => {
    expect(guessExpense('CHAI  point', history)).toEqual({
      category: 'Food',
      source: 'history',
    });
  });

  it('uses the most common category for the same leading word', () => {
    expect(guessExpense('Swiggy order', history)).toEqual({
      category: 'Food',
      source: 'history',
    });
  });

  it('beats the keyword map with history', () => {
    const own = buildCategoryHistory(
      [tx('Uber eats', 'Food')],
      'expense',
      EXPENSE,
    );
    expect(guessExpense('Uber eats', own)?.category).toBe('Food');
    expect(guessExpense('Uber ride', own)?.category).toBe('Food');
    expect(guessExpense('Uber ride')?.category).toBe('Travel');
  });

  it('ignores generic leading words but keeps the exact title', () => {
    expect(guessExpense('UPI payment', history)?.category).toBe('Bills');
    expect(guessExpense('UPI to Ramesh', history)).toBeNull();
  });

  it('leaves out other types, system entries and unknown categories', () => {
    expect(history.counts.has('Salary')).toBe(false);
    expect(history.counts.has('Settlement')).toBe(false);
    expect(history.counts.has('Transport')).toBe(false);
    expect(guessExpense('Old thing', history)).toBeNull();
  });

  it('falls back to keywords and returns null for nothing', () => {
    expect(guessExpense('Netflix', history)).toEqual({
      category: 'Entertainment',
      source: 'keyword',
    });
    expect(guessExpense('x', history)).toBeNull();
    expect(guessExpense('Random words', history)).toBeNull();
  });

  it('works for income and goals', () => {
    expect(
      guessCategory('Diwali bonus', {
        keywordMap: INCOME_KEYWORD_MAP,
        allowed: INCOME,
      })?.category,
    ).toBe('Bonus');
    expect(
      guessCategory('New car', {
        keywordMap: GOAL_KEYWORD_MAP,
        allowed: ['car', 'house'],
      })?.category,
    ).toBe('car');
    expect(
      guessCategory('Bring snacks', {
        keywordMap: GOAL_KEYWORD_MAP,
        allowed: ['wedding'],
      }),
    ).toBeNull();
  });
});

describe('suggestedCategories', () => {
  const history = buildCategoryHistory(
    [
      tx('a', 'Travel'),
      tx('b', 'Food'),
      tx('c', 'Food'),
      tx('d', 'Rent'),
      tx('e', 'Travel'),
      tx('f', 'Health'),
    ],
    'expense',
    EXPENSE,
  );

  it('puts the guess first, then the most used', () => {
    expect(suggestedCategories(history, EXPENSE, 'Rent')).toEqual([
      'Rent',
      'Travel',
      'Food',
      'Health',
    ]);
  });

  it('breaks ties by the newest use and respects the limit', () => {
    expect(suggestedCategories(history, EXPENSE, null, 2)).toEqual([
      'Travel',
      'Food',
    ]);
  });

  it('drops values that are not allowed', () => {
    expect(suggestedCategories(history, ['Food'], 'Rent')).toEqual(['Food']);
  });
});

describe('filterCategories', () => {
  it('ranks word starts before other matches', () => {
    const list = [
      {label: 'Bills'},
      {label: 'Subscriptions'},
      {label: 'Shopping'},
      {label: 'Fitness'},
    ];
    expect(filterCategories(list, 's').map(c => c.label)).toEqual([
      'Subscriptions',
      'Shopping',
      'Bills',
      'Fitness',
    ]);
    expect(filterCategories(list, 'ness').map(c => c.label)).toEqual([
      'Fitness',
    ]);
    expect(filterCategories(list, '  ')).toHaveLength(4);
  });
});

describe('keyword maps', () => {
  const check = (map: Record<string, string>, allowed: string[]) => {
    for (const [keyword, category] of Object.entries(map)) {
      expect({keyword, ok: allowed.includes(category)}).toEqual({
        keyword,
        ok: true,
      });
    }
  };

  it('point at real categories', () => {
    check(EXPENSE_KEYWORD_MAP, EXPENSE);
    check(INCOME_KEYWORD_MAP, INCOME);
  });

  it('are lowercase', () => {
    for (const map of [
      EXPENSE_KEYWORD_MAP,
      INCOME_KEYWORD_MAP,
      GOAL_KEYWORD_MAP,
    ]) {
      for (const keyword of Object.keys(map)) {
        expect(keyword).toBe(keyword.toLowerCase());
      }
    }
  });
});
