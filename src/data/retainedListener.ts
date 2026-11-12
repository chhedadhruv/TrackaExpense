import {useEffect} from 'react';
import {useSyncStore} from './syncStore';

interface Entry {
  count: number;
  stop: () => void;
}

const active = new Map<string, Entry>();

/**
 * Starts a listener for `id` unless one is already running, and counts the caller as a user of it.
 * Several mounted screens that need the same data (the group list is read by the Split screen and
 * by the group screens above it) share one listener; it stops when the last of them lets go.
 * Returns the function that lets go.
 */
export const retainListener = (
  id: string,
  start: () => () => void,
): (() => void) => {
  let entry = active.get(id);
  if (!entry) {
    entry = {count: 0, stop: start()};
    active.set(id, entry);
  }
  const current = entry;
  current.count += 1;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    current.count -= 1;
    if (current.count === 0) {
      current.stop();
      if (active.get(id) === current) {
        active.delete(id);
      }
    }
  };
};

/** Number of listeners running, for tests. */
export const activeListenerCount = (): number => active.size;

/**
 * Keeps the listener for `id` running while the component is mounted. Pass `null` to run nothing
 * (for example while the id still depends on something that is not known yet). `start` must be
 * stable for a given id; the first caller's `start` is the one that runs. Listeners start again
 * when the sync store's `retry` is used.
 */
export const useRetainedListener = (
  id: string | null,
  start: () => () => void,
): void => {
  const restartKey = useSyncStore(state => state.restartKey);
  useEffect(() => {
    if (id === null) {
      return undefined;
    }
    return retainListener(id, start);
    // `start` is stable for an id by contract; the id and the restart key decide when to rerun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, restartKey]);
};
