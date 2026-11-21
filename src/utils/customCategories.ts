/**
 * A person's own categories and their choices about the built-in ones. Pure functions only; the
 * data lives in `users/{uid}/categories/{id}` (one document per custom category) and
 * `users/{uid}/categories/_prefs` (hidden built-in categories and the order of each list).
 *
 * A transaction stores its category as plain text, so a custom category is just a name: old
 * installed apps, the server (budgets, summaries) and Statistics all handle it as they handle any
 * category they do not know, with the generic icon.
 */
import {categoryIconFor, isCategoryIconKey} from '../constants/categoryIcons';
import type {Category} from '../types';

/** Expense and income categories go on transactions; goal categories on savings goals. */
export type CategoryType = 'expense' | 'income' | 'goal';

export const CATEGORY_TYPES: readonly CategoryType[] = [
  'expense',
  'income',
  'goal',
];

const isCategoryType = (value: unknown): value is CategoryType =>
  CATEGORY_TYPES.includes(value as CategoryType);

export const PREFS_DOC_ID = '_prefs';
export const MAX_CATEGORY_NAME = 24;
export const MAX_CUSTOM_CATEGORIES = 40;

/** Names the app writes itself; a person's category may not use them. */
const RESERVED_NAMES = [
  'settlement',
  'iou',
  'card bill',
  'balance adjustment',
  'uncategorized',
  'split',
];

export interface CustomCategory {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  createdAtMs: number;
  /**
   * The old name while a rename is still being written to the person's transactions, recurring
   * rules and budgets; null once it finished. See `renameCategory` in CategoryService.
   */
  renamingFrom: string | null;
}

export interface CategoryPrefs {
  hidden: Record<CategoryType, string[]>;
  order: Record<CategoryType, string[]>;
}

export const EMPTY_PREFS: CategoryPrefs = {
  hidden: {expense: [], income: [], goal: []},
  order: {expense: [], income: [], goal: []},
};

/** One row of a category list: built-in or custom, visible or hidden. */
export interface CategoryEntry extends Category {
  builtIn: boolean;
  hidden: boolean;
  /** The custom category's document id; null for a built-in one. */
  id: string | null;
  renamingFrom: string | null;
}

/** Trimmed, with runs of spaces collapsed. */
export const cleanCategoryName = (raw: string): string =>
  raw.trim().replace(/\s+/g, ' ');

const sameName = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase();

/**
 * Why `name` cannot be used for a category of this type, or null when it can. `excludeId` is the
 * category being renamed (its own current name is allowed).
 */
export const categoryNameError = (
  rawName: string,
  builtIns: readonly string[],
  customs: readonly CustomCategory[],
  type: CategoryType,
  excludeId: string | null = null,
): string | null => {
  const name = cleanCategoryName(rawName);
  if (name === '') {
    return 'Enter a name.';
  }
  if (name.length > MAX_CATEGORY_NAME) {
    return `Use at most ${MAX_CATEGORY_NAME} characters.`;
  }
  if (RESERVED_NAMES.some(r => sameName(r, name))) {
    return 'That name is used by the app. Choose another.';
  }
  if (builtIns.some(b => sameName(b, name))) {
    return 'There is already a built-in category with that name.';
  }
  if (
    customs.some(
      c => c.type === type && c.id !== excludeId && sameName(c.name, name),
    )
  ) {
    return 'You already have a category with that name.';
  }
  return null;
};

const toMillis = (value: unknown): number => {
  if (value && typeof value === 'object' && 'toMillis' in value) {
    const fn = (value as {toMillis: unknown}).toMillis;
    if (typeof fn === 'function') {
      return Number(fn.call(value)) || 0;
    }
  }
  return typeof value === 'number' ? value : 0;
};

/** A custom category from its document, or null when the document is not a valid one. */
export const customFromDoc = (
  id: string,
  data: Record<string, unknown>,
): CustomCategory | null => {
  if (id === PREFS_DOC_ID) {
    return null;
  }
  const name =
    typeof data.name === 'string' ? cleanCategoryName(data.name) : '';
  const type = data.type;
  if (name === '' || !isCategoryType(type)) {
    return null;
  }
  return {
    id,
    name,
    type,
    icon: isCategoryIconKey(data.icon) ? data.icon : 'shapes',
    createdAtMs: toMillis(data.createdAt),
    renamingFrom:
      typeof data.renamingFrom === 'string' && data.renamingFrom !== ''
        ? data.renamingFrom
        : null,
  };
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v !== '')
    : [];

const perType = (value: unknown): Record<CategoryType, string[]> => {
  const obj =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  return {
    expense: stringList(obj.expense),
    income: stringList(obj.income),
    goal: stringList(obj.goal),
  };
};

/** The preferences document, with anything malformed dropped. */
export const prefsFromDoc = (
  data: Record<string, unknown> | undefined,
): CategoryPrefs =>
  data
    ? {hidden: perType(data.hidden), order: perType(data.order)}
    : EMPTY_PREFS;

/**
 * Every category of one type, built-in and custom, hidden ones included (flagged), in the
 * person's order. Values not in the saved order keep the default order (built-in first, then
 * custom ones by when they were made) after the ordered ones.
 */
export const arrangeCategories = (
  builtIns: readonly Category[],
  customs: readonly CustomCategory[],
  prefs: CategoryPrefs,
  type: CategoryType,
): CategoryEntry[] => {
  const hidden = new Set(prefs.hidden[type]);
  const entries: CategoryEntry[] = [
    ...builtIns.map(c => ({
      ...c,
      builtIn: true,
      hidden: hidden.has(c.value),
      id: null,
      renamingFrom: null,
    })),
    ...customs
      .filter(c => c.type === type)
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .map(c => ({
        value: c.name,
        label: c.name,
        icon: categoryIconFor(c.icon),
        builtIn: false,
        hidden: false,
        id: c.id,
        renamingFrom: c.renamingFrom,
      })),
  ];
  const rank = new Map(prefs.order[type].map((v, i) => [v, i]));
  return entries
    .map((entry, index) => ({entry, index}))
    .sort((a, b) => {
      const ra = rank.get(a.entry.value);
      const rb = rank.get(b.entry.value);
      if (ra !== undefined && rb !== undefined) {
        return ra - rb;
      }
      if (ra !== undefined) {
        return -1;
      }
      if (rb !== undefined) {
        return 1;
      }
      return a.index - b.index;
    })
    .map(({entry}) => entry);
};

/** The categories to offer in pickers: the visible ones, in order. */
export const visibleCategories = (
  entries: readonly CategoryEntry[],
): Category[] =>
  entries
    .filter(e => !e.hidden)
    .map(({value, label, icon}) => ({value, label, icon}));

/** The list of values after moving `value` up (-1) or down (+1); unchanged at either end. */
export const moveValue = (
  values: readonly string[],
  value: string,
  delta: -1 | 1,
): string[] => {
  const out = [...values];
  const from = out.indexOf(value);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= out.length) {
    return out;
  }
  [out[from], out[to]] = [out[to], out[from]];
  return out;
};

/** Preferences with a built-in category hidden or shown again. */
export const withHidden = (
  prefs: CategoryPrefs,
  type: CategoryType,
  value: string,
  hide: boolean,
): CategoryPrefs => {
  const rest = prefs.hidden[type].filter(v => v !== value);
  return {
    ...prefs,
    hidden: {...prefs.hidden, [type]: hide ? [...rest, value] : rest},
  };
};

/** Preferences with a category's name replaced in the order (a rename). */
export const withRenamed = (
  prefs: CategoryPrefs,
  type: CategoryType,
  from: string,
  to: string,
): CategoryPrefs => ({
  ...prefs,
  order: {
    ...prefs.order,
    [type]: prefs.order[type].map(v => (v === from ? to : v)),
  },
});

/** Preferences without a deleted category. */
export const withoutValue = (
  prefs: CategoryPrefs,
  type: CategoryType,
  value: string,
): CategoryPrefs => ({
  hidden: {
    ...prefs.hidden,
    [type]: prefs.hidden[type].filter(v => v !== value),
  },
  order: {...prefs.order, [type]: prefs.order[type].filter(v => v !== value)},
});

/** Whether hiding one more category would leave a list with nothing to pick. */
export const isLastVisible = (entries: readonly CategoryEntry[]): boolean =>
  entries.filter(e => !e.hidden).length <= 1;
