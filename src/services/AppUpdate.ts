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

export default appUpdate;
