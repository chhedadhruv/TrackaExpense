import {useCallback, useMemo, useState} from 'react';
import {useTransactions} from '../data/hooks';
import {
  buildTitleIndex,
  suggestTitles,
  type TitleEntry,
} from '../utils/titleSuggest';
import type {HistorySource} from '../utils/categorySuggest';

/** Past titles of one type from the transactions cache (no Firestore read). */
export const useTransactionTitleIndex = (
  type: 'expense' | 'income',
  allowed: readonly string[],
): TitleEntry[] => {
  const {data} = useTransactions();
  return useTitleIndex(data, type, allowed);
};

/** Past titles from any list of history entries, newest first. */
export const useTitleIndex = (
  data: readonly HistorySource[] | undefined,
  type: 'expense' | 'income',
  allowed: readonly string[],
): TitleEntry[] => {
  const allowedKey = allowed.join('\n');
  return useMemo(
    () => (data ? buildTitleIndex(data, type, allowed) : []),
    // `allowed` is compared by content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, type, allowedKey],
  );
};

interface Options {
  index: readonly TitleEntry[];
  title: string;
  setTitle: (value: string) => void;
  /** Called with the picked title's last category (when it has one). */
  onCategory?: (category: string) => void;
}

export interface TitleSuggestionsState {
  /** Matching past titles to show now (empty while the field is not focused). */
  suggestions: TitleEntry[];
  onFocus: () => void;
  onBlur: () => void;
  pick: (entry: TitleEntry) => void;
}

/**
 * Title autocomplete for a form: suggestions show while the title field is focused, and picking
 * one sets the title (and offers its last category) and hides them until the title is typed again.
 */
export const useTitleSuggestions = ({
  index,
  title,
  setTitle,
  onCategory,
}: Options): TitleSuggestionsState => {
  const [focused, setFocused] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const suggestions = useMemo(
    () => (focused && title !== picked ? suggestTitles(index, title) : []),
    [focused, index, title, picked],
  );

  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);

  const pick = useCallback(
    (entry: TitleEntry) => {
      setPicked(entry.title);
      setTitle(entry.title);
      if (entry.category && onCategory) {
        onCategory(entry.category);
      }
    },
    [setTitle, onCategory],
  );

  return {suggestions, onFocus, onBlur, pick};
};
