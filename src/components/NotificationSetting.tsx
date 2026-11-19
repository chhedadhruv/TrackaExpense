import React from 'react';
import {Text, View} from 'react-native';
import Bell from 'lucide-react-native/icons/bell';
import {useUserData} from '../data/hooks';
import {reportError} from '../services/ErrorReporter';
import {setFunNudgeEnabled} from '../services/NotificationPrefsService';
import {useTheme} from '../theme';
import {isFunNudgeOn} from '../utils/notificationPrefs';
import {snackbar} from '../utils/snackbarStore';
import Toggle from './Toggle';

/**
 * The "Notifications" section of Profile: the switch for the evening reminder. The profile comes
 * from the shared cache, and a change reaches the screen through the profile listener, so there is
 * no local copy of the value to keep in step.
 */
const NotificationSetting = () => {
  const {colors} = useTheme();
  const {data} = useUserData();

  if (!data) {
    return null;
  }

  const change = (next: boolean) => {
    setFunNudgeEnabled(next).catch(error => {
      reportError(error as Error);
      snackbar.error('Could not save this setting. Please try again.');
    });
  };

  return (
    <View className="px-5 pb-[30px]">
      <Text
        accessibilityRole="header"
        className="mb-[15px] font-heading text-xl font-bold text-text-strong">
        Notifications
      </Text>
      <View className="rounded-2xl border border-card-border bg-surface ios:shadow-md">
        <View className="flex-row items-center justify-between px-5 py-4">
          <View className="flex-1 flex-row items-center">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-surface-muted">
              <Bell size={24} color={colors.primary} />
            </View>
            <View className="flex-1 pr-3">
              <Text className="mb-0.5 font-sans-bold text-base font-semibold text-text-strong">
                Evening reminder
              </Text>
              <Text className="font-sans text-sm text-text-secondary">
                A short nudge each evening to log your spending
              </Text>
            </View>
          </View>
          <Toggle
            value={isFunNudgeOn(data.funNudgeEnabled)}
            onValueChange={change}
          />
        </View>
      </View>
    </View>
  );
};

export default NotificationSetting;
