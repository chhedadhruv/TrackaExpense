import {isSuppressed, suppressedUntil} from '../utils/appLock';

let until = 0;

/**
 * Call right before the app itself sends the person away (camera, gallery, share sheet, a
 * permission prompt) so coming back does not show the lock. It covers the next return only, and
 * only for a couple of minutes (see SUPPRESS_WINDOW_MS).
 */
export const suppressNextLock = (): void => {
  until = suppressedUntil(Date.now());
};

/** Reads and clears the flag. Used by AppLockProvider on the way back to the foreground. */
export const consumeLockSuppression = (): boolean => {
  const active = isSuppressed(until, Date.now());
  until = 0;
  return active;
};
