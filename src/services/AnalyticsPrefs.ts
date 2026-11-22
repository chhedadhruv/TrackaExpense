import {createMMKV} from 'react-native-mmkv';

const STORAGE_ID = 'analytics-prefs';
const KEY_ENABLED = 'analyticsEnabled';

// Its own MMKV file, separate from the query cache: the cache is wiped on sign-out, and the
// person's choice to opt out must survive that.
const storage = createMMKV({id: STORAGE_ID});

/** Product analytics are on unless the person switched them off. */
export const isAnalyticsEnabled = (): boolean => {
  try {
    return storage.getBoolean(KEY_ENABLED) !== false;
  } catch {
    return true;
  }
};

export const saveAnalyticsEnabled = (enabled: boolean): void => {
  try {
    storage.set(KEY_ENABLED, enabled);
  } catch {
    // the choice still applies for this session through MixpanelService
  }
};
