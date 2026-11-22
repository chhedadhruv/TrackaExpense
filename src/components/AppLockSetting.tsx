import React, {useEffect, useState} from 'react';
import {Text, View} from 'react-native';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import {useAppLock} from '../lock/AppLockProvider';
import {getLockAvailability} from '../services/AppLockService';
import * as AnalyticsService from '../services/AnalyticsService';
import {useTheme} from '../theme';
import {snackbar} from '../utils/snackbarStore';
import Toggle from './Toggle';

/**
 * The "Security" section of Profile with the app lock switch. Both directions ask for the fingerprint, face or passcode first
 * (see AppLockProvider.setEnabled). Hidden on a phone that has no screen lock, unless the lock is
 * already on, so it can still be turned off.
 */
const AppLockSetting = () => {
  const {colors} = useTheme();
  const {enabled, setEnabled} = useAppLock();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getLockAvailability().then(result => {
      if (active) {
        setAvailable(result.available);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (available === null || (!available && !enabled)) {
    return null;
  }

  const change = async (next: boolean) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const result = await setEnabled(next);
      if (result === 'ok') {
        AnalyticsService.logAppLockToggled(next);
      }
      if (result === 'unavailable') {
        snackbar.error(
          'Set up a fingerprint, face or screen lock on your phone first.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="px-5 pb-[30px]">
      <Text
        accessibilityRole="header"
        className="mb-[15px] font-heading text-xl font-bold text-text-strong">
        Security
      </Text>
      <View className="rounded-2xl border border-card-border bg-surface ios:shadow-md">
        <View className="flex-row items-center justify-between px-5 py-4">
          <View className="flex-1 flex-row items-center">
            <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-surface-muted">
              <ShieldCheck size={24} color={colors.primary} />
            </View>
            <View className="flex-1 pr-3">
              <Text className="mb-0.5 font-sans-bold text-base font-semibold text-text-strong">
                App lock
              </Text>
              <Text className="font-sans text-sm text-text-secondary">
                Ask for fingerprint, face or passcode when you open the app
              </Text>
            </View>
          </View>
          <Toggle value={enabled} onValueChange={change} disabled={busy} />
        </View>
      </View>
    </View>
  );
};

export default AppLockSetting;
