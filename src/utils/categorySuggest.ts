/**
 * Category suggestions: guess a category from a title, using the person's own history first and a
 * keyword map second. Pure functions only; `src/hooks/useCategorySuggestion.ts` wires them to a form.
 *
 * Matching is on whole words (a title "Coca cola" does not match the keyword "ola"), a keyword also
 * matches its plural ("pizzas" matches "pizza"), and the longest keyword wins ("amazon prime" beats
 * "amazon"). A guess is always one of the `allowed` category values.
 */

/** Lowercase, trimmed, with runs of spaces collapsed. Two titles with the same key are one title. */
export const normalizeTitle = (title: string): string =>
  title.trim().toLowerCase().replace(/\s+/g, ' ');

/** Words of a title: lowercase letters and digits, split on anything else. */
export const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9À-￿]+/)
    .filter(t => t !== '');

/** Categories the app writes itself; never learned and never suggested. */
const SYSTEM_CATEGORIES = new Set([
  'settlement',
  'iou',
  'card bill',
  'balance adjustment',
]);

/** Transaction sources that are not something the person typed. */
const SYSTEM_SOURCES = new Set(['card_payment', 'balance_adjustment', 'split']);

/**
 * Leading words too generic to say anything about the category ("UPI payment", "Paid to ...").
 * A history title starting with one of these is still used for an exact match.
 */
const GENERIC_LEADING_WORDS = new Set([
  'a',
  'an',
  'the',
  'to',
  'for',
  'from',
  'at',
  'my',
  'paid',
  'pay',
  'payment',
  'upi',
  'transfer',
  'sent',
  'received',
  'bank',
  'card',
  'new',
]);

const MIN_LEADING_WORD = 3;

export interface HistorySource {
  title?: string | null;
  category?: string | null;
  type?: string | null;
  source?: string | null;
  splitRole?: string | null;
}

interface CategoryScore {
  count: number;
  /** Position of the newest use; lower is newer. */
  newest: number;
}

export interface CategoryHistory {
  /** Normalised title to the category it was filed under most recently. */
  titles: Map<string, string>;
  /** First word of a title to how often each category was used with it. */
  leading: Map<string, Map<string, CategoryScore>>;
  /** How often each category was used. */
  counts: Map<string, CategoryScore>;
}

export const EMPTY_HISTORY: CategoryHistory = {
  titles: new Map(),
  leading: new Map(),
  counts: new Map(),
};

const bump = (
  map: Map<string, CategoryScore>,
  key: string,
  position: number,
): void => {
  const score = map.get(key);
  if (score) {
    score.count += 1;
    score.newest = Math.min(score.newest, position);
  } else {
    map.set(key, {count: 1, newest: position});
  }
};

/** Whether a transaction is something the person filed themselves, worth learning from. */
export const isLearnable = (tx: HistorySource): boolean => {
  if (tx.source && SYSTEM_SOURCES.has(tx.source)) {
    return false;
  }
  if (tx.splitRole) {
    return false;
  }
  const category = tx.category?.trim();
  return !!category && !SYSTEM_CATEGORIES.has(category.toLowerCase());
};

/**
 * Learns from the person's transactions of one type. `transactions` must be newest first (the
 * order of the transactions cache); the newest category of a title wins. Categories not in
 * `allowed` are left out.
 */
export const buildCategoryHistory = (
  transactions: readonly HistorySource[],
  type: 'expense' | 'income',
  allowed: readonly string[],
): CategoryHistory => {
  const allowedSet = new Set(allowed);
  const history: CategoryHistory = {
    titles: new Map(),
    leading: new Map(),
    counts: new Map(),
  };
  transactions.forEach((tx, position) => {
    if (tx.type !== type || !isLearnable(tx)) {
      return;
    }
    const category = tx.category!.trim();
    if (!allowedSet.has(category)) {
      return;
    }
    bump(history.counts, category, position);
    const key = normalizeTitle(tx.title ?? '');
    if (key === '') {
      return;
    }
    if (!history.titles.has(key)) {
      history.titles.set(key, category);
    }
    const first = tokenize(key)[0];
    if (
      first &&
      first.length >= MIN_LEADING_WORD &&
      !GENERIC_LEADING_WORDS.has(first)
    ) {
      let byCategory = history.leading.get(first);
      if (!byCategory) {
        byCategory = new Map();
        history.leading.set(first, byCategory);
      }
      bump(byCategory, category, position);
    }
  });
  return history;
};

const byUse = (a: CategoryScore, b: CategoryScore): number =>
  b.count - a.count || a.newest - b.newest;

interface Keyword {
  tokens: string[];
  category: string;
  length: number;
}

const keywordCache = new WeakMap<Record<string, string>, Keyword[]>();

/** The map's keywords as word lists, longest first. */
const keywordsOf = (map: Record<string, string>): Keyword[] => {
  const cached = keywordCache.get(map);
  if (cached) {
    return cached;
  }
  const list = Object.entries(map)
    .map(([kw, category]) => ({
      tokens: tokenize(kw),
      category,
      length: kw.length,
    }))
    .filter(k => k.tokens.length > 0)
    .sort((a, b) => b.tokens.length - a.tokens.length || b.length - a.length);
  keywordCache.set(map, list);
  return list;
};

const sameWord = (word: string, keyword: string, isLast: boolean): boolean =>
  word === keyword ||
  (isLast && (word === `${keyword}s` || word === `${keyword}es`));

const containsPhrase = (words: string[], phrase: string[]): boolean => {
  for (let i = 0; i + phrase.length <= words.length; i++) {
    let all = true;
    for (let j = 0; j < phrase.length; j++) {
      if (!sameWord(words[i + j], phrase[j], j === phrase.length - 1)) {
        all = false;
        break;
      }
    }
    if (all) {
      return true;
    }
  }
  return false;
};

/** The category of the longest keyword found as whole words in `title`, or null. */
export const keywordCategory = (
  title: string,
  keywordMap: Record<string, string>,
  allowed: readonly string[],
): string | null => {
  const words = tokenize(title);
  if (words.length === 0) {
    return null;
  }
  const allowedSet = new Set(allowed);
  const hit = keywordsOf(keywordMap).find(
    k => allowedSet.has(k.category) && containsPhrase(words, k.tokens),
  );
  return hit?.category ?? null;
};

export interface CategoryGuess {
  category: string;
  source: 'history' | 'keyword';
}

export interface GuessOptions {
  keywordMap?: Record<string, string>;
  history?: CategoryHistory;
  allowed: readonly string[];
}

/**
 * Best category for `title`, in this order:
 * 1. the category the person last used for exactly this title;
 * 2. the category they use most with titles starting with the same word ("Swiggy order" after
 *    several "Swiggy ..." entries), for words of at least 3 letters that are not generic;
 * 3. the longest whole-word keyword.
 */
export const guessCategory = (
  title: string,
  {keywordMap, history = EMPTY_HISTORY, allowed}: GuessOptions,
): CategoryGuess | null => {
  const key = normalizeTitle(title);
  if (key.length < 2) {
    return null;
  }
  const allowedSet = new Set(allowed);

  const exact = history.titles.get(key);
  if (exact && allowedSet.has(exact)) {
    return {category: exact, source: 'history'};
  }

  const first = tokenize(key)[0];
  const byCategory = first ? history.leading.get(first) : undefined;
  if (byCategory) {
    const best = Array.from(byCategory.entries())
      .filter(([category]) => allowedSet.has(category))
      .sort(([, a], [, b]) => byUse(a, b))[0];
    if (best) {
      return {category: best[0], source: 'history'};
    }
  }

  if (keywordMap) {
    const category = keywordCategory(key, keywordMap, allowed);
    if (category) {
      return {category, source: 'keyword'};
    }
  }
  return null;
};

/**
 * Up to `limit` categories to offer first in the picker: the guess, then the person's most used
 * categories. Every value is in `allowed`.
 */
export const suggestedCategories = (
  history: CategoryHistory,
  allowed: readonly string[],
  guess: string | null,
  limit = 4,
): string[] => {
  const allowedSet = new Set(allowed);
  const out: string[] = [];
  if (guess && allowedSet.has(guess)) {
    out.push(guess);
  }
  const used = Array.from(history.counts.entries())
    .filter(([category]) => allowedSet.has(category))
    .sort(([, a], [, b]) => byUse(a, b))
    .map(([category]) => category);
  for (const category of used) {
    if (out.length >= limit) {
      break;
    }
    if (!out.includes(category)) {
      out.push(category);
    }
  }
  return out;
};

/**
 * Categories matching a search: those with a word starting with the query first, then those
 * containing it anywhere, each in their original order.
 */
export const filterCategories = <T extends {label: string}>(
  categories: readonly T[],
  query: string,
): T[] => {
  const q = query.trim().toLowerCase();
  if (q === '') {
    return [...categories];
  }
  const starts: T[] = [];
  const contains: T[] = [];
  for (const c of categories) {
    const label = c.label.toLowerCase();
    if (tokenize(label).some(w => w.startsWith(q)) || label.startsWith(q)) {
      starts.push(c);
    } else if (label.includes(q)) {
      contains.push(c);
    }
  }
  return [...starts, ...contains];
};
