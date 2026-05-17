import remoteConfig from '@react-native-firebase/remote-config';

export interface RemoteConfigDefaults {
  max_transactions_displayed: number;
  enable_fun_notifications: boolean;
  enable_reminder_notifications: boolean;
  stats_default_time_range: string;
  image_upload_max_size_mb: number;
  enable_iou_feature: boolean;
  onboarding_version: number;
}

const DEFAULTS: RemoteConfigDefaults = {
  max_transactions_displayed: 50,
  enable_fun_notifications: true,
  enable_reminder_notifications: true,
  stats_default_time_range: 'all',
  image_upload_max_size_mb: 5,
  enable_iou_feature: true,
  onboarding_version: 1,
};

export async function initRemoteConfig(): Promise<void> {
  try {
    await remoteConfig().setDefaults(DEFAULTS as unknown as Record<string, string | number | boolean>);
    await remoteConfig().setConfigSettings({
      minimumFetchIntervalMillis: __DEV__ ? 0 : 3600000,
    });
    await remoteConfig().fetchAndActivate();
  } catch (_) {
    // Remote Config failure must never crash the app — defaults are always available
  }
}

export function getConfig(): RemoteConfigDefaults {
  const cfg = remoteConfig();
  try {
    return {
      max_transactions_displayed: cfg.getValue('max_transactions_displayed').asNumber() || DEFAULTS.max_transactions_displayed,
      enable_fun_notifications: cfg.getValue('enable_fun_notifications').asBoolean(),
      enable_reminder_notifications: cfg.getValue('enable_reminder_notifications').asBoolean(),
      stats_default_time_range: cfg.getValue('stats_default_time_range').asString() || DEFAULTS.stats_default_time_range,
      image_upload_max_size_mb: cfg.getValue('image_upload_max_size_mb').asNumber() || DEFAULTS.image_upload_max_size_mb,
      enable_iou_feature: cfg.getValue('enable_iou_feature').asBoolean(),
      onboarding_version: cfg.getValue('onboarding_version').asNumber() || DEFAULTS.onboarding_version,
    };
  } catch (_) {
    return DEFAULTS;
  }
}
