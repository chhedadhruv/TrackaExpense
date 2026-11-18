import React, {useEffect, useMemo, useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useRouter} from 'expo-router';
import Scale from 'lucide-react-native/icons/scale';
import {useTransactions} from '../data/hooks';
import {getConfig} from '../services/RemoteConfigService';
import {useTheme} from '../theme';
import {catchUpOf, shouldPromptCatchUp} from '../utils/balanceAdjust';
import {todayAsYMD} from '../utils/formatters';

const SNOOZE_KEY = 'balanceFix.snoozedOn';

/**
 * Shown on Home when the person has not added anything by hand for a while but splits and
 * settle-ups kept changing the balance: asks whether the balance is still right and opens the
 * Fix balance screen. "Not now" hides it for a week. Nothing is changed from here.
 */
const CatchUpPrompt = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const transactions = useTransactions();
  const enabled = getConfig().enable_balance_adjust;
  // undefined until the saved "Not now" date has been read, so the card never flashes up.
  const [snoozedOn, setSnoozedOn] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SNOOZE_KEY)
      .then(value => active && setSnoozedOn(value))
      .catch(() => active && setSnoozedOn(null));
    return () => {
      active = false;
    };
  }, []);

  const today = todayAsYMD();
  const catchUp = useMemo(
    () => (enabled ? catchUpOf(transactions.data ?? [], today) : null),
    [enabled, transactions.data, today],
  );

  if (
    !enabled ||
    snoozedOn === undefined ||
    !shouldPromptCatchUp(catchUp, today, snoozedOn)
  ) {
    return null;
  }

  const snooze = () => {
    setSnoozedOn(today);
    AsyncStorage.setItem(SNOOZE_KEY, today).catch(() => undefined);
  };

  return (
    <View className="mx-5 mb-2 mt-4 rounded-2xl border border-card-border bg-surface p-4">
      <View className="flex-row items-center">
        <Scale size={20} color={colors.primary} />
        <Text className="ml-2 flex-1 font-sans-bold text-base font-bold text-text-strong">
          Is your balance still right?
        </Text>
      </View>
      <Text className="mt-2 font-sans text-sm text-text-secondary">
        You have not added an entry for {catchUp?.gapDays} days, but{' '}
        {catchUp?.splitEntries.length} entries came in from splits. Tell us your
        balance now and we will fix it without changing your income and expense
        totals.
      </Text>
      <View className="mt-3 flex-row">
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.8}
          onPress={() => router.navigate('/profile/fix-balance')}
          className="mr-3 rounded-xl bg-primary-fill px-4 py-2.5">
          <Text className="font-sans-bold text-sm font-bold text-on-primary">
            Fix my balance
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.8}
          onPress={snooze}
          className="rounded-xl border border-card-border px-4 py-2.5">
          <Text className="font-sans-bold text-sm font-bold text-text-secondary">
            Not now
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CatchUpPrompt;
