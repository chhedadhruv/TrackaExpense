import {describe, expect, it} from '@jest/globals';
import {
  EMPTY_PREFS,
  arrangeCategories,
  categoryNameError,
  cleanCategoryName,
  customFromDoc,
  isLastVisible,
  moveValue,
  prefsFromDoc,
  visibleCategories,
  withHidden,
  withRenamed,
  withoutValue,
  type CategoryPrefs,
  type CustomCategory,
} from '../src/utils/customCategories';
import {categoryIconFor} from '../src/constants/categoryIcons';

const Icon = () => null;
const BUILT_INS = [
  {value: 'Food', label: 'Food', icon: Icon},
  {value: 'Rent', label: 'Rent', icon: Icon},
  {value: 'Others', label: 'Others', icon: Icon},
];

const custom = (
  id: string,
  name: string,
  extra: Partial<CustomCategory> = {},
): CustomCategory => ({
  id,
  name,
  type: 'expense',
  icon: 'pet',
  createdAtMs: 0,
  renamingFrom: null,
  ...extra,
});

describe('cleanCategoryName and categoryNameError', () => {
  const customs = [custom('a', 'Pets'), custom('b', 'Tips', {type: 'income'})];
  const err = (
    name: string,
    type: 'expense' | 'income' = 'expense',
    id?: string,
  ) => categoryNameError(name, ['Food', 'Salary'], customs, type, id ?? null);

  it('trims and collapses spaces', () => {
    expect(cleanCategoryName('  Kids   school ')).toBe('Kids school');
  });

  it('accepts a new name', () => {
    expect(err('Kids')).toBeNull();
    expect(err('Tips')).toBeNull(); // only taken for income
  });

  it('rejects empty, long, reserved and duplicate names', () => {
    expect(err('   ')).toBe('Enter a name.');
    expect(err('x'.repeat(25))).toMatch(/at most 24/);
    expect(err('settlement')).toMatch(/used by the app/);
    expect(err('Card Bill')).toMatch(/used by the app/);
    expect(err('food')).toMatch(/built-in/);
    expect(err('SALARY')).toMatch(/built-in/);
    expect(err('pets')).toMatch(/already have/);
    expect(err('tips', 'income')).toMatch(/already have/);
  });

  it('lets a category keep its own name when renamed', () => {
    expect(err('PETS', 'expense', 'a')).toBeNull();
  });
});

describe('customFromDoc and prefsFromDoc', () => {
  it('reads a valid document', () => {
    expect(
      customFromDoc('x', {
        name: ' Pets ',
        type: 'expense',
        icon: 'pet',
        createdAt: {toMillis: () => 42},
        renamingFrom: 'Dog',
      }),
    ).toEqual(custom('x', 'Pets', {createdAtMs: 42, renamingFrom: 'Dog'}));
  });

  it('drops invalid documents and unknown icons', () => {
    expect(customFromDoc('_prefs', {name: 'A', type: 'expense'})).toBeNull();
    expect(customFromDoc('x', {name: '', type: 'expense'})).toBeNull();
    expect(customFromDoc('x', {name: 'A', type: 'split'})).toBeNull();
    expect(
      customFromDoc('x', {name: 'A', type: 'income', icon: 'nope'})?.icon,
    ).toBe('shapes');
  });

  it('reads preferences and ignores junk', () => {
    expect(prefsFromDoc(undefined)).toEqual(EMPTY_PREFS);
    expect(
      prefsFromDoc({hidden: {expense: ['Rent', 3, '']}, order: 'bad'}),
    ).toEqual({
      hidden: {expense: ['Rent'], income: []},
      order: {expense: [], income: []},
    });
  });
});

describe('arrangeCategories', () => {
  const customs = [
    custom('b', 'Kids', {createdAtMs: 2}),
    custom('a', 'Pets', {createdAtMs: 1}),
    custom('c', 'Tips', {type: 'income'}),
  ];

  it('puts built-in first, then own categories by creation, flagging hidden ones', () => {
    const prefs = withHidden(EMPTY_PREFS, 'expense', 'Rent', true);
    const entries = arrangeCategories(BUILT_INS, customs, prefs, 'expense');
    expect(entries.map(e => [e.value, e.builtIn, e.hidden, e.id])).toEqual([
      ['Food', true, false, null],
      ['Rent', true, true, null],
      ['Others', true, false, null],
      ['Pets', false, false, 'a'],
      ['Kids', false, false, 'b'],
    ]);
    expect(entries[3].icon).toBe(categoryIconFor('pet'));
    expect(visibleCategories(entries).map(c => c.value)).toEqual([
      'Food',
      'Others',
      'Pets',
      'Kids',
    ]);
  });

  it('follows the saved order and appends values it does not list', () => {
    const prefs: CategoryPrefs = {
      ...EMPTY_PREFS,
      order: {expense: ['Kids', 'Others', 'Gone'], income: []},
    };
    expect(
      arrangeCategories(BUILT_INS, customs, prefs, 'expense').map(e => e.value),
    ).toEqual(['Kids', 'Others', 'Food', 'Rent', 'Pets']);
  });
});

describe('preference helpers', () => {
  it('moves a value and stops at the ends', () => {
    expect(moveValue(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveValue(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(moveValue(['a', 'b'], 'x', 1)).toEqual(['a', 'b']);
  });

  it('hides and shows without duplicates', () => {
    const once = withHidden(EMPTY_PREFS, 'income', 'Gift', true);
    const twice = withHidden(once, 'income', 'Gift', true);
    expect(twice.hidden.income).toEqual(['Gift']);
    expect(withHidden(twice, 'income', 'Gift', false).hidden.income).toEqual(
      [],
    );
    expect(twice.hidden.expense).toEqual([]);
  });

  it('renames in the order and removes a deleted value', () => {
    const prefs: CategoryPrefs = {
      hidden: {expense: ['Pets'], income: []},
      order: {expense: ['Food', 'Pets'], income: ['Pets']},
    };
    expect(withRenamed(prefs, 'expense', 'Pets', 'Animals').order).toEqual({
      expense: ['Food', 'Animals'],
      income: ['Pets'],
    });
    expect(withoutValue(prefs, 'expense', 'Pets')).toEqual({
      hidden: {expense: [], income: []},
      order: {expense: ['Food'], income: ['Pets']},
    });
  });

  it('knows when only one category is left visible', () => {
    const entries = arrangeCategories(
      BUILT_INS,
      [],
      {
        ...EMPTY_PREFS,
        hidden: {expense: ['Food', 'Rent'], income: []},
      },
      'expense',
    );
    expect(isLastVisible(entries)).toBe(true);
    expect(
      isLastVisible(arrangeCategories(BUILT_INS, [], EMPTY_PREFS, 'expense')),
    ).toBe(false);
  });
});
