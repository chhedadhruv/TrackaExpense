import {useContext, useRef} from 'react';
import {skipToken, useIsRestoring, useQuery} from '@tanstack/react-query';
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
} from '@react-native-firebase/firestore';
import {AuthContext} from '../../navigation/AuthProvider';
import {reportError} from '../services/ErrorReporter';
import type {
  SavingsHistoryDocument,
  TransactionDocument,
  UserDocument,
} from '../types';
import {cachedFlags} from './cachedFlags';
import {queryKeys} from './keys';
import {statusOf, useSyncStore, type SyncStatus} from './syncStore';

export interface CachedData<T> {
  /** The data, from the cache: the saved copy at first, then what the live listener delivers. */
  data: T | undefined;
  /** True until there is something to show (no saved copy and no answer yet). */
  loading: boolean;
  /** True only when the read failed and there is nothing to show; saved data stays on screen. */
  error: boolean;
  /**
   * True once the live listener has confirmed the data. Until then `data` may be the copy saved
   * on the phone, which is fine to look at but not to build a write on: a screen that rewrites a
   * whole field from what it shows (savings goals, a profile form) must wait for `live`.
   */
  live: boolean;
  /** True when the live listener failed, even if a saved copy is still in `data`. */
  failed: boolean;
  /** Starts the live listeners again. */
  retry: () => void;
}

/**
 * Reads one kind of cached data. Nothing is fetched here: the data arrives through DataSync, and
 * `skipToken` makes this query only observe the cache.
 */
export const useCached = <T>(
  key: readonly unknown[],
  status: SyncStatus,
): CachedData<T> => {
  const restoring = useIsRestoring();
  const retry = useSyncStore(state => state.retry);
  const {data} = useQuery<T>({queryKey: key, queryFn: skipToken});
  return {
    data,
    ...cachedFlags(data !== undefined, restoring, status),
    retry,
  };
};

export const useUid = (): string => useContext(AuthContext).user?.uid ?? '';

/** The signed-in person's own profile document. */
export const useUserData = (): CachedData<UserDocument> => {
  const status = useSyncStore(state => statusOf(state.statuses, 'user'));
  return useCached<UserDocument>(queryKeys.user(useUid()), status);
};

/** The signed-in person's transactions, newest first (by when they were saved). */
export const useTransactions = (): CachedData<TransactionDocument[]> => {
  const status = useSyncStore(state =>
    statusOf(state.statuses, 'transactions'),
  );
  return useCached<TransactionDocument[]>(
    queryKeys.transactions(useUid()),
    status,
  );
};

export type LoadedTransaction = TransactionDocument & {id: string};

/**
 * One transaction by id, taken from the cached list. Once found it is kept for as long as the
 * screen lives, so deleting it does not flash a "not found" message while the screen closes.
 */
export const useTransactionById = (
  id: string | undefined,
): CachedData<LoadedTransaction> => {
  const list = useTransactions();
  const last = useRef<LoadedTransaction | undefined>(undefined);
  const found = id
    ? (list.data?.find(t => t.id === id) as LoadedTransaction | undefined)
    : undefined;
  if (found) {
    last.current = found;
  }
  const data = found ?? last.current;
  return {
    data,
    loading: list.loading,
    error: list.error,
    live: list.live,
    failed: list.failed,
    retry: list.retry,
  };
};

export interface SavingsHistoryResult {
  data: SavingsHistoryDocument[] | undefined;
  /** True until there is something to show (no saved copy and the first read is still running). */
  loading: boolean;
  /** True only when the read failed and there is nothing to show. */
  error: boolean;
  /** Reads the history again; resolves when it is done. */
  refetch: () => Promise<unknown>;
}

const SAVINGS_HISTORY_LIMIT = 100;

/**
 * The latest savings history entries, newest first. Unlike the profile and the transactions this
 * is an ordinary query, not a live listener: the saved copy shows at once and the history is read
 * again every time the screen opens (and on pull to refresh), because the Savings screen adds
 * entries while this screen is not mounted.
 */
export const useSavingsHistory = (): SavingsHistoryResult => {
  const uid = useUid();
  const restoring = useIsRestoring();
  const result = useQuery<SavingsHistoryDocument[]>({
    queryKey: queryKeys.savingsHistory(uid),
    enabled: uid !== '',
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(getFirestore(), 'users', uid, 'savingsHistory'),
            orderBy('createdAt', 'desc'),
            limit(SAVINGS_HISTORY_LIMIT),
          ),
        );
        return snapshot.docs.map(document => {
          const data = document.data();
          return {
            id: document.id,
            ...data,
            goalName: data.goalName || data.goal?.name || 'savings goal',
          } as SavingsHistoryDocument;
        });
      } catch (error) {
        reportError(error as Error);
        throw error;
      }
    },
  });
  const empty = result.data === undefined;
  return {
    data: result.data,
    loading: empty && (restoring || result.isPending),
    error: empty && !restoring && result.isError,
    refetch: result.refetch,
  };
};
