import type {SyncStatus} from './syncStore';

export interface CachedFlags {
  loading: boolean;
  error: boolean;
  live: boolean;
  failed: boolean;
}

/**
 * What a screen needs to know about cached data, from three facts: is there any data (a saved
 * copy or a listener answer), is the saved cache still being read back, and where the live
 * listener stands.
 *
 * - `loading`: nothing to show yet.
 * - `error`: the listener failed and there is nothing to show.
 * - `live`: the listener has confirmed the data. A screen that writes from what it shows must
 *   wait for this, because a saved copy can be older than the server.
 * - `failed`: the listener failed, even if a saved copy is still on screen.
 */
export const cachedFlags = (
  hasData: boolean,
  restoring: boolean,
  status: SyncStatus,
): CachedFlags => ({
  loading: !hasData && (restoring || status === 'loading'),
  error: !hasData && !restoring && status === 'error',
  live: status === 'live',
  failed: status === 'error',
});
