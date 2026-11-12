import {useContext, useRef} from 'react';
import {skipToken, useIsRestoring, useQuery} from '@tanstack/react-query';
import {AuthContext} from '../../navigation/AuthProvider';
import type {TransactionDocument, UserDocument} from '../types';
import {queryKeys} from './keys';
import {useSyncStore, type SyncStatus} from './syncStore';

export interface CachedData<T> {
  /** The data, from the cache: the saved copy at first, then what the live listener delivers. */
  data: T | undefined;
  /** True until there is something to show (no saved copy and no answer yet). */
  loading: boolean;
  /** True only when the read failed and there is nothing to show; saved data stays on screen. */
  error: boolean;
  /** Starts the live listeners again. */
  retry: () => void;
}

/**
 * Reads one kind of cached data. Nothing is fetched here: the data arrives through DataSync, and
 * `skipToken` makes this query only observe the cache.
 */
const useCached = <T>(
  key: readonly unknown[],
  status: SyncStatus,
): CachedData<T> => {
  const restoring = useIsRestoring();
  const retry = useSyncStore(state => state.retry);
  const {data} = useQuery<T>({queryKey: key, queryFn: skipToken});
  const empty = data === undefined;
  return {
    data,
    loading: empty && (restoring || status === 'loading'),
    error: empty && !restoring && status === 'error',
    retry,
  };
};

const useUid = (): string => useContext(AuthContext).user?.uid ?? '';

/** The signed-in person's own profile document. */
export const useUserData = (): CachedData<UserDocument> => {
  const status = useSyncStore(state => state.user);
  return useCached<UserDocument>(queryKeys.user(useUid()), status);
};

/** The signed-in person's transactions, newest first (by when they were saved). */
export const useTransactions = (): CachedData<TransactionDocument[]> => {
  const status = useSyncStore(state => state.transactions);
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
    retry: list.retry,
  };
};
