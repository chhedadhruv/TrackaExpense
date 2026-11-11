import {useCallback, useRef, useState} from 'react';
import {reportError} from '../services/ErrorReporter';
import {snackbar} from '../utils/snackbarStore';

/**
 * Failure handling for a screen's data load, the same everywhere:
 *
 * - the error is reported;
 * - if nothing has loaded yet, `failed` turns true so the screen can show an ErrorState with Retry
 *   (a failed load must never look like an empty result);
 * - if data is already on screen (a refresh or a refocus failed), the data stays and a snackbar says
 *   the refresh did not work.
 *
 * Call `succeed()` after a load works and `fail(error)` in the catch block.
 */
export function useLoadFailure() {
  const [failed, setFailed] = useState(false);
  const hasData = useRef(false);

  const succeed = useCallback(() => {
    hasData.current = true;
    setFailed(false);
  }, []);

  const fail = useCallback((error: unknown) => {
    reportError(error);
    if (hasData.current) {
      snackbar.error('Could not refresh. Showing the last data.');
    } else {
      setFailed(true);
    }
  }, []);

  return {failed, succeed, fail};
}
