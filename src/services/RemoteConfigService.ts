import {
  fetchAndActivate,
  getRemoteConfig,
  getValue,
} from '@react-native-firebase/remote-config';

export interface RemoteConfigDefaults {
  max_transactions_displayed: number;
  enable_fun_notifications: boolean;
  enable_reminder_notifications: boolean;
  stats_default_time_range: string;
  image_upload_max_size_mb: number;
  enable_iou_feature: boolean;
  onboarding_version: number;
  /** Installed versions below this are blocked until the user updates. '0.0.0' disables the check. */
  min_supported_version: string;
  update_message: string;
}

const DEFAULTS: RemoteConfigDefaults = {
  max_transactions_displayed: 50,
  enable_fun_notifications: true,
  enable_reminder_notifications: true,
  stats_default_time_range: 'all',
  image_upload_max_size_mb: 5,
  enable_iou_feature: true,
  onboarding_version: 1,
  min_supported_version: '0.0.0',
  update_message:
    'A newer version of TrackaExpense is required. Please update to continue.',
};

export async function initRemoteConfig(): Promise<void> {
  try {
    const remoteConfig = getRemoteConfig();
    remoteConfig.defaultConfig = DEFAULTS as unknown as Record<
      string,
      string | number | boolean
    >;
    remoteConfig.settings = {
      minimumFetchIntervalMillis: __DEV__ ? 0 : 3600000,
      fetchTimeoutMillis: 60000,
    };
    await fetchAndActivate(remoteConfig);
  } catch (_) {
    // Remote Config failure must never crash the app — defaults are always available
  }
}

export function getConfig(): RemoteConfigDefaults {
  const cfg = getRemoteConfig();
  try {
    return {
      max_transactions_displayed:
        getValue(cfg, 'max_transactions_displayed').asNumber() ||
        DEFAULTS.max_transactions_displayed,
      enable_fun_notifications: getValue(
        cfg,
        'enable_fun_notifications',
      ).asBoolean(),
      enable_reminder_notifications: getValue(
        cfg,
        'enable_reminder_notifications',
      ).asBoolean(),
      stats_default_time_range:
        getValue(cfg, 'stats_default_time_range').asString() ||
        DEFAULTS.stats_default_time_range,
      image_upload_max_size_mb:
        getValue(cfg, 'image_upload_max_size_mb').asNumber() ||
        DEFAULTS.image_upload_max_size_mb,
      enable_iou_feature: getValue(cfg, 'enable_iou_feature').asBoolean(),
      onboarding_version:
        getValue(cfg, 'onboarding_version').asNumber() ||
        DEFAULTS.onboarding_version,
      min_supported_version:
        getValue(cfg, 'min_supported_version').asString() ||
        DEFAULTS.min_supported_version,
      update_message:
        getValue(cfg, 'update_message').asString() || DEFAULTS.update_message,
    };
  } catch (_) {
    return DEFAULTS;
  }
}
