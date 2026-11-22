import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTransactions} from '../data/hooks';
import {
  EMPTY_HISTORY,
  buildCategoryHistory,
  guessCategory,
  suggestedCategories,
  type CategoryHistory,
} from '../utils/categorySuggest';

/**
 * What the person filed before, from the transactions cache (no Firestore read). Empty while the
 * cache has no data.
 */
export const useCategoryHistory = (
  type: 'expense' | 'income',
  allowed: readonly string[],
): CategoryHistory => {
  const {data} = useTransactions();
  const allowedKey = allowed.join('\n');
  return useMemo(
    () => (data ? buildCategoryHistory(data, type, allowed) : EMPTY_HISTORY),
    // `allowed` is compared by content, so a new array with the same values does not rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, type, allowedKey],
  );
};

interface Options {
  title: string;
  category: string;
  setCategory: (value: string) => void;
  allowed: readonly string[];
  keywordMap?: Record<string, string>;
  history?: CategoryHistory;
  /**
   * The current category was chosen by the person (an edit screen opening a saved entry). The
   * guess then never changes it until `reset`.
   */
  startPickedByHand?: boolean;
}

export interface CategorySuggestion {
  /** The current category is the app's guess, not the person's choice. */
  guessed: boolean;
  /** Categories to offer first in the picker. */
  suggested: string[];
  /** Call when the person picks a category; the guess then leaves it alone. */
  pickByHand: (value: string) => void;
  /** Call when the title is set from a suggestion with a known category (still a guess). */
  applyGuess: (value: string) => void;
  /** Forget the hand pick (a cleared form). */
  reset: () => void;
}

/**
 * Fills the category from the title while it is empty or still a guess, and keeps revising it as
 * the title changes, until the person picks one by hand.
 */
export const useCategorySuggestion = ({
  title,
  category,
  setCategory,
  allowed,
  keywordMap,
  history = EMPTY_HISTORY,
  startPickedByHand = false,
}: Options): CategorySuggestion => {
  const [pickedByHand, setPickedByHand] = useState(startPickedByHand);
  const [guessedValue, setGuessedValue] = useState<string | null>(null);
  const setCategoryRef = useRef(setCategory);
  setCategoryRef.current = setCategory;
  const categoryRef = useRef(category);
  categoryRef.current = category;

  const allowedKey = allowed.join('\n');
  const guess = useMemo(
    () =>
      guessCategory(title, {keywordMap, history, allowed})?.category ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, keywordMap, history, allowedKey],
  );

  useEffect(() => {
    if (pickedByHand) {
      return;
    }
    const current = categoryRef.current;
    const isGuessOrEmpty = current === '' || current === guessedValue;
    if (!isGuessOrEmpty) {
      return;
    }
    if (guess) {
      if (guess !== current) {
        setCategoryRef.current(guess);
      }
      setGuessedValue(guess);
    } else if (guessedValue !== null) {
      setCategoryRef.current('');
      setGuessedValue(null);
    }
    // Runs when the guess changes; the category itself is read from the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guess, pickedByHand]);

  const pickByHand = useCallback((value: string) => {
    setPickedByHand(true);
    setGuessedValue(null);
    setCategoryRef.current(value);
  }, []);

  const applyGuess = useCallback(
    (value: string) => {
      if (pickedByHand) {
        return;
      }
      setGuessedValue(value);
      setCategoryRef.current(value);
    },
    [pickedByHand],
  );

  const reset = useCallback(() => {
    setPickedByHand(false);
    setGuessedValue(null);
  }, []);

  const suggested = useMemo(
    () => suggestedCategories(history, allowed, guess),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, allowedKey, guess],
  );

  return {
    guessed: !pickedByHand && category !== '' && category === guessedValue,
    suggested,
    pickByHand,
    applyGuess,
    reset,
  };
};
