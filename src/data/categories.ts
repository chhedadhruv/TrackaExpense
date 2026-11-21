import {useCallback, useMemo} from 'react';
import {
  collection,
  getFirestore,
  onSnapshot,
} from '@react-native-firebase/firestore';
import {reportError} from '../services/ErrorReporter';
import {categoryIconFor} from '../constants/categoryIcons';
import type {Category} from '../types';
import type {AppIcon} from '../types/icons';
import {
  EMPTY_PREFS,
  PREFS_DOC_ID,
  arrangeCategories,
  customFromDoc,
  prefsFromDoc,
  visibleCategories,
  type CategoryEntry,
  type CategoryPrefs,
  type CategoryType,
  type CustomCategory,
} from '../utils/customCategories';
import {
  EXPENSE_CATEGORIES,
  DEFAULT_GOAL_CATEGORY,
  GOAL_CATEGORIES,
  INCOME_CATEGORIES,
  SPLIT_CATEGORIES,
  getCategoryIcon,
} from '../../utils/CategoryData';
import {useCached, useUid} from './hooks';
import {queryKeys} from './keys';
import {queryClient} from './queryClient';
import {useRetainedListener} from './retainedListener';
import {statusOf, useSyncStore} from './syncStore';

/**
 * The person's own categories and their choices about the built-in ones, from
 * `users/{uid}/categories` through a shared live listener (saved to the phone, so pickers show
 * them at once on a cold start). See src/utils/customCategories.ts.
 */

export interface CategoryData {
  customs: CustomCategory[];
  prefs: CategoryPrefs;
}

const EMPTY: CategoryData = {customs: [], prefs: EMPTY_PREFS};

const categoriesListenerId = (uid: string) => `categories:${uid}`;

const startCategoriesListener = (uid: string) => () => {
  const id = categoriesListenerId(uid);
  const {setStatus} = useSyncStore.getState();
  setStatus(id, 'loading');
  return onSnapshot(
    collection(getFirestore(), 'users', uid, 'categories'),
    snapshot => {
      const customs: CustomCategory[] = [];
      let prefs = EMPTY_PREFS;
      snapshot.docs.forEach(d => {
        if (d.id === PREFS_DOC_ID) {
          prefs = prefsFromDoc(d.data());
          return;
        }
        const custom = customFromDoc(d.id, d.data());
        if (custom) {
          customs.push(custom);
        }
      });
      queryClient.setQueryData<CategoryData>(queryKeys.categories(uid), {
        customs,
        prefs,
      });
      setStatus(id, 'live');
    },
    error => {
      reportError(error);
      setStatus(id, 'error');
    },
  );
};

export interface CategoryDataResult extends CategoryData {
  /** Confirmed by the live listener; a write built on what is shown must wait for it. */
  live: boolean;
  failed: boolean;
  loading: boolean;
  retry: () => void;
}

export const useCategoryData = (): CategoryDataResult => {
  const uid = useUid();
  useRetainedListener(
    uid ? categoriesListenerId(uid) : null,
    startCategoriesListener(uid),
  );
  const status = useSyncStore(state =>
    statusOf(state.statuses, categoriesListenerId(uid)),
  );
  const cached = useCached<CategoryData>(queryKeys.categories(uid), status);
  const data = cached.data ?? EMPTY;
  return {
    customs: data.customs,
    prefs: data.prefs,
    live: cached.live,
    failed: cached.failed,
    loading: cached.loading,
    retry: cached.retry,
  };
};

/** Every built-in transaction name (expense, income and split). */
const TRANSACTION_BUILT_IN_NAMES: readonly string[] = Array.from(
  new Set(
    [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SPLIT_CATEGORIES].map(
      c => c.value,
    ),
  ),
);

/** A goal whose category the app does not know shows the "Other" piggy bank, as old apps do. */
const GOAL_FALLBACK_ICON = GOAL_CATEGORIES.find(
  c => c.value === DEFAULT_GOAL_CATEGORY,
)!.icon;

/** Goal ids and their labels ("other" and "Other"). */
const GOAL_BUILT_IN_NAMES: readonly string[] = GOAL_CATEGORIES.flatMap(c => [
  c.value,
  c.label,
]);

/**
 * Names a custom category of this type may not reuse. Transaction categories share one set of
 * names (icons are looked up by name); goal categories are their own set.
 */
export const builtInNamesFor = (type: CategoryType): readonly string[] =>
  type === 'goal' ? GOAL_BUILT_IN_NAMES : TRANSACTION_BUILT_IN_NAMES;

export const builtInsFor = (type: CategoryType): readonly Category[] =>
  type === 'expense'
    ? EXPENSE_CATEGORIES
    : type === 'income'
    ? INCOME_CATEGORIES
    : GOAL_CATEGORIES;

export interface CategoryLists {
  /** Every category of the type, hidden ones included, in the person's order. */
  entries: CategoryEntry[];
  /** What pickers offer: the visible ones, in order. */
  categories: Category[];
  /** Their values, for suggestions. */
  values: string[];
  live: boolean;
}

/** The categories of one type as this person arranged them. */
export const useCategoryLists = (type: CategoryType): CategoryLists => {
  const {customs, prefs, live} = useCategoryData();
  return useMemo(() => {
    const entries = arrangeCategories(builtInsFor(type), customs, prefs, type);
    const categories = visibleCategories(entries);
    return {entries, categories, values: categories.map(c => c.value), live};
  }, [customs, prefs, type, live]);
};

/**
 * A function giving the icon of any category value, the person's own ones included. A value the
 * app does not know gets the generic icon.
 */
export const useCategoryIcon = (): ((
  value: string,
  type?: string,
) => AppIcon) => {
  const {customs} = useCategoryData();
  return useCallback(
    (value: string, type?: string) => {
      if (type === 'goal') {
        const goal = GOAL_CATEGORIES.find(c => c.value === value);
        if (goal) {
          return goal.icon;
        }
        const own = customs.find(c => c.name === value && c.type === 'goal');
        return own ? categoryIconFor(own.icon) : GOAL_FALLBACK_ICON;
      }
      const custom =
        customs.find(c => c.name === value && c.type === type) ??
        customs.find(c => c.name === value && c.type !== 'goal');
      return custom ? categoryIconFor(custom.icon) : getCategoryIcon(value);
    },
    [customs],
  );
};
