import * as Updates from 'expo-updates';
import type {UpdateApi} from '../utils/otaUpdate';

/**
 * The over-the-air update calls of expo-updates, in the shape src/utils/otaUpdate.ts works with.
 * Updates are off in development builds (`isEnabled` is false there), so nothing is asked.
 *
 * The native side still checks and downloads on every cold start (`checkAutomatically: ON_LOAD`
 * in app.json); these calls only let the app act on the result sooner than the next restart.
 */
export const appUpdate: UpdateApi = {
  isEnabled: Updates.isEnabled && !__DEV__,
  check: async () => (await Updates.checkForUpdateAsync()).isAvailable,
  fetch: async () => (await Updates.fetchUpdateAsync()).isNew,
  reload: () => Updates.reloadAsync(),
};

/**
 * The id of the over-the-air update the app is running, or null when it runs the JavaScript
 * that came with the store build (also in development builds). The built-in bundle has an id of
 * its own, which is not an update anyone published, so it counts as none.
 */
export const runningUpdateId: string | null =
  appUpdate.isEnabled && !Updates.isEmbeddedLaunch ? Updates.updateId : null;

export default appUpdate;
