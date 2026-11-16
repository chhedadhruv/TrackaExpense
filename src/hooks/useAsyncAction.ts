import {useCallback, useEffect, useRef, useState} from 'react';
import {createActionGuard, runGuarded} from '../utils/actionGuard';

/**
 * Wraps an async handler so it cannot run twice at once. The lock (`utils/actionGuard.ts`) is
 * taken synchronously, so a second tap in the same frame, before React has re-rendered the
 * disabled button, is ignored. `pending` drives the spinner. Errors are rethrown to the caller,
 * so the handler's own try/catch and snackbar stay where they are. State is not set after the
 * screen unmounts.
 */
export const useAsyncAction = <Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
): {
  run: (...args: Args) => Promise<Result | undefined>;
  pending: boolean;
} => {
  const [pending, setPending] = useState(false);
  const guard = useRef(createActionGuard()).current;
  const mounted = useRef(true);
  const latest = useRef(action);
  latest.current = action;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    (...args: Args) =>
      runGuarded(
        guard,
        () => latest.current(...args),
        () => setPending(true),
        () => {
          if (mounted.current) {
            setPending(false);
          }
        },
      ),
    [guard],
  );

  return {run, pending};
};

/**
 * The same lock for a list: one action at a time across all rows, with `pendingKey` naming the
 * row that is running (a row id) so only that row shows a spinner.
 */
export const useAsyncActionByKey = <Args extends unknown[], Result>(
  action: (key: string, ...args: Args) => Promise<Result>,
): {
  run: (key: string, ...args: Args) => Promise<Result | undefined>;
  pendingKey: string | null;
} => {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const guard = useRef(createActionGuard()).current;
  const mounted = useRef(true);
  const latest = useRef(action);
  latest.current = action;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    (key: string, ...args: Args) =>
      runGuarded(
        guard,
        () => latest.current(key, ...args),
        () => setPendingKey(key),
        () => {
          if (mounted.current) {
            setPendingKey(null);
          }
        },
      ),
    [guard],
  );

  return {run, pendingKey};
};
