/**
 * A one-at-a-time lock for async actions. `begin` takes the lock synchronously and returns false
 * when it is already taken, so a second tap in the same frame is ignored before React has
 * re-rendered. `end` always releases it.
 */
export const createActionGuard = () => {
  let busy = false;
  return {
    begin(): boolean {
      if (busy) {
        return false;
      }
      busy = true;
      return true;
    },
    end(): void {
      busy = false;
    },
    isBusy(): boolean {
      return busy;
    },
  };
};

/**
 * Runs `action` under the guard. Returns `undefined` without running it when another call is in
 * progress. `onStart` and `onEnd` bracket the call (the hook uses them to set its pending state);
 * `onEnd` runs even when the action throws, and the error is rethrown.
 */
export const runGuarded = async <Result>(
  guard: ReturnType<typeof createActionGuard>,
  action: () => Promise<Result>,
  onStart: () => void,
  onEnd: () => void,
): Promise<Result | undefined> => {
  if (!guard.begin()) {
    return undefined;
  }
  onStart();
  try {
    return await action();
  } finally {
    guard.end();
    onEnd();
  }
};
