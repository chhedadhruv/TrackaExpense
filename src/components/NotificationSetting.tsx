import React from 'react';
import {Text, View} from 'react-native';
import Bell from 'lucide-react-native/icons/bell';
import CreditCard from 'lucide-react-native/icons/credit-card';
import {useUserData} from '../data/hooks';
import * as AnalyticsService from '../services/AnalyticsService';
import {reportError} from '../services/ErrorReporter';
import {
  setCardRemindersEnabled,
  setFunNudgeEnabled,
} from '../services/NotificationPrefsService';
import {getConfig} from '../services/RemoteConfigService';
import {useTheme} from '../theme';
import type {AppIcon} from '../types/icons';
import {isCardRemindersOn, isFunNudgeOn} from '../utils/notificationPrefs';
import {snackbar} from '../utils/snackbarStore';
import Toggle from './Toggle';

interface SwitchRowProps {
  /** Short key for analytics, for example 'evening_reminder'. */
  pref: string;
  icon: AppIcon;
  title: string;
  subtitle: string;
  value: boolean;
  save: (next: boolean) => Promise<void>;
}

/** One notification switch. The value comes from the profile cache, so there is no local copy. */
const SwitchRow = ({
  pref,
  icon: Icon,
  title,
  subtitle,
  value,
  save,
}: SwitchRowProps) => {
  const {colors} = useTheme();
  const change = (next: boolean) => {
    save(next)
      .then(() =>
        AnalyticsService.logNotificationPrefChanged({pref, enabled: next}),
      )
      .catch(error => {
        reportError(error as Error);
        snackbar.error('Could not save this setting. Please try again.');
      });
  };
  return (
    <View className="flex-row items-center justify-between px-5 py-4">
      <View className="flex-1 flex-row items-center">
        <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-surface-muted">
          <Icon size={24} color={colors.primary} />
        </View>
        <View className="flex-1 pr-3">
          <Text className="mb-0.5 font-sans-bold text-base font-semibold text-text-strong">
            {title}
          </Text>
          <Text className="font-sans text-sm text-text-secondary">
            {subtitle}
          </Text>
        </View>
      </View>
      <Toggle value={value} onValueChange={change} />
    </View>
  );
};

/**
 * The "Notifications" section of Profile: the switches for the evening reminder and, while credit
 * cards are on, the card bill reminders. The profile comes from the shared cache, and a change
 * reaches the screen through the profile listener.
 */
const NotificationSetting = () => {
  const {data} = useUserData();

  if (!data) {
    return null;
  }

  return (
    <View className="px-5 pb-[30px]">
      <Text
        accessibilityRole="header"
        className="mb-[15px] font-heading text-xl font-bold text-text-strong">
        Notifications
      </Text>
      <View className="rounded-2xl border border-card-border bg-surface ios:shadow-md">
        <SwitchRow
          pref="evening_reminder"
          icon={Bell}
          title="Evening reminder"
          subtitle="A short nudge each evening to log your spending"
          value={isFunNudgeOn(data.funNudgeEnabled)}
          save={setFunNudgeEnabled}
        />
        {getConfig().enable_cards ? (
          <>
            <View className="mx-5 h-px bg-divider" />
            <SwitchRow
              pref="card_reminders"
              icon={CreditCard}
              title="Card bill reminders"
              subtitle="Three days before and on the day a card bill is due"
              value={isCardRemindersOn(data.cardRemindersEnabled)}
              save={setCardRemindersEnabled}
            />
          </>
        ) : null}
      </View>
    </View>
  );
};

export default NotificationSetting;
