/**
 * Title autocomplete: the person's own past titles that match what they are typing, best first.
 * Pure functions only; `src/components/form/TitleSuggestions.tsx` shows them.
 */
import {
  isLearnable,
  normalizeTitle,
  tokenize,
  type HistorySource,
} from './categorySuggest';

/** Fewer typed characters than this show nothing. */
export const MIN_TITLE_QUERY = 2;

export interface TitleEntry {
  /** Normalised title (see `normalizeTitle`). */
  key: string;
  /** The title as last written. */
  title: string;
  /** The category last used with it, when it is one of the allowed values; otherwise null. */
  category: string | null;
  count: number;
  /** Position of the newest use; lower is newer. */
  newest: number;
}

/**
 * Distinct titles of one type, from transactions newest first (the order of the caches). Entries
 * the app wrote itself are left out, like in `buildCategoryHistory`.
 */
export const buildTitleIndex = (
  transactions: readonly HistorySource[],
  type: 'expense' | 'income',
  allowed: readonly string[],
): TitleEntry[] => {
  const allowedSet = new Set(allowed);
  const byKey = new Map<string, TitleEntry>();
  transactions.forEach((tx, position) => {
    if (tx.type !== type || !isLearnable(tx)) {
      return;
    }
    const title = tx.title?.trim() ?? '';
    const key = normalizeTitle(title);
    if (key === '') {
      return;
    }
    const entry = byKey.get(key);
    if (entry) {
      entry.count += 1;
      return;
    }
    const category = tx.category?.trim() ?? '';
    byKey.set(key, {
      key,
      title: title.replace(/\s+/g, ' '),
      category: allowedSet.has(category) ? category : null,
      count: 1,
      newest: position,
    });
  });
  return Array.from(byKey.values());
};

/** Split documents as history: settlements are left out, the rest count as expenses. */
export const splitsAsHistory = (
  splits: readonly {
    title?: string | null;
    category?: string | null;
    type?: string | null;
    isSettlement?: boolean | null;
  }[],
): HistorySource[] =>
  splits
    .filter(s => s.type !== 'settlement' && !s.isSettlement)
    .map(s => ({title: s.title, category: s.category, type: 'expense'}));

const byUse = (a: TitleEntry, b: TitleEntry): number =>
  b.count - a.count || a.newest - b.newest;

/**
 * Past titles for what is typed: titles starting with it first, then titles with a word starting
 * with it, each the most used (then the newest) first. The exact text already typed is not
 * offered again.
 */
export const suggestTitles = (
  index: readonly TitleEntry[],
  input: string,
  limit = 5,
): TitleEntry[] => {
  const query = normalizeTitle(input);
  if (query.length < MIN_TITLE_QUERY) {
    return [];
  }
  const queryWords = tokenize(query);
  const starts: TitleEntry[] = [];
  const words: TitleEntry[] = [];
  for (const entry of index) {
    if (entry.key === query) {
      continue;
    }
    if (entry.key.startsWith(query)) {
      starts.push(entry);
    } else if (
      queryWords.length === 1 &&
      tokenize(entry.key).some(w => w.startsWith(queryWords[0]))
    ) {
      words.push(entry);
    }
  }
  return [...starts.sort(byUse), ...words.sort(byUse)].slice(0, limit);
};
