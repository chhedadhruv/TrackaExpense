import {QueryClient} from '@tanstack/react-query';
import {createSyncStoragePersister} from '@tanstack/query-sync-storage-persister';
import type {PersistQueryClientProviderProps} from '@tanstack/react-query-persist-client';
import {createMMKV, deleteMMKV} from 'react-native-mmkv';
import {decodeTimestamps, encodeTimestamps} from './timestampCodec';

/**
 * The app's one query cache. The data in it is filled by live Firestore listeners (see
 * DataSync.tsx), so it is never "stale" in the query sense: nothing refetches on mount or on
 * focus, and a failed read is not retried by the library (the screen offers Retry).
 *
 * The cache is saved to MMKV, so a cold start shows the last known data at once, also offline,
 * until the listeners deliver the current data. It holds only the signed-in person's own data and
 * is wiped on sign-out.
 */

const SEVEN_DAYS = 1000 * 60 * 60 * 24 * 7;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: SEVEN_DAYS,
      staleTime: Infinity,
      retry: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    },
  },
});

/** Only these kinds of data are saved to disk. Add a kind here when its screen moves over. */
export const PERSISTED_KINDS = [
  'user',
  'transactions',
  'savingsHistory',
  'tags',
  'categories',
  'groups',
  'invitations',
  'groupSplits',
  'splitHistory',
  'iouFrom',
  'iouTo',
] as const;
for (const kind of PERSISTED_KINDS) {
  queryClient.setQueryDefaults([kind], {meta: {persist: true}});
}

const STORAGE_ID = 'query-cache';

// `let`: sign-out deletes the files and opens a fresh instance. The persister below reads this
// binding on every call, so it always talks to the current one.
let storage = createMMKV({id: STORAGE_ID});

const persister = createSyncStoragePersister({
  storage: {
    getItem: key => storage.getString(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => {
      storage.remove(key);
    },
  },
  key: 'tracka-query-cache',
  throttleTime: 1000,
  serialize: client => JSON.stringify(encodeTimestamps(client)),
  deserialize: text => decodeTimestamps(JSON.parse(text)) as never,
});

/**
 * Bump `buster` when the shape of cached data changes: an old cache is then dropped instead of
 * being read by code that expects the new shape.
 */
export const persistOptions: PersistQueryClientProviderProps['persistOptions'] =
  {
    persister,
    maxAge: SEVEN_DAYS,
    buster: 'v1',
    dehydrateOptions: {
      shouldDehydrateQuery: query =>
        query.meta?.persist === true && query.state.status === 'success',
    },
  };

/**
 * Drops everything cached, in memory and on disk. Called on sign-out. The MMKV files are deleted
 * and a fresh instance opened: `clearAll` and `trim` only reset MMKV's own bookkeeping and leave
 * the old text (email, transactions) physically in the file.
 */
export const clearCachedData = (): void => {
  queryClient.clear();
  persister.removeClient();
  deleteMMKV(STORAGE_ID);
  storage = createMMKV({id: STORAGE_ID});
};
