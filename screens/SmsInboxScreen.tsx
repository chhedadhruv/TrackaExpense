import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useRouter} from 'expo-router';
import ArrowDownLeft from 'lucide-react-native/icons/arrow-down-left';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import MessageSquareText from 'lucide-react-native/icons/message-square-text';
import FormButton from '../components/FormButton';
import {FormHeader} from '../src/components/form/FormParts';
import {useTheme} from '../src/theme';
import {useUid} from '../src/data/hooks';
import {useCurrency} from '../utils/CurrencyUtil';
import {reportError} from '../src/services/ErrorReporter';
import {
  hasDisclosureConsent,
  hasInboxPermission,
  isInboxSupported,
  loadOffers,
  markHandled,
  recordDisclosureConsent,
  requestInboxPermission,
} from '../src/services/SmsInboxService';
import {formatDisplayDate} from '../src/utils/formatters';
import {
  prefillFor,
  prefillParams,
  targetFor,
  titleFor,
} from '../src/utils/smsImport';
import type {SmsOffer} from '../src/utils/smsInbox';
import {snackbar} from '../src/utils/snackbarStore';

type Phase = 'disclosure' | 'blocked' | 'loading' | 'ready' | 'error';

/**
 * Bank payments found in the phone's inbox (Android only). The in-app disclosure comes first and
 * the system permission prompt only after the person accepts it. Messages are read and parsed on
 * the phone and go nowhere. Tapping an offer opens the normal Add form filled in, and nothing is
 * saved until it is confirmed there. An offer that was opened or skipped is not shown again.
 */
const SmsInboxScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const uid = useUid();
  const {currency, formatAmount} = useCurrency();
  const [phase, setPhase] = useState<Phase>('disclosure');
  const [offers, setOffers] = useState<SmsOffer[]>([]);

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      setOffers(await loadOffers(uid));
      setPhase('ready');
    } catch (error) {
      reportError(error);
      setPhase('error');
    }
  }, [uid]);

  // Come back to the list when the permission was already granted after an earlier accept.
  useEffect(() => {
    let active = true;
    (async () => {
      if (hasDisclosureConsent(uid) && (await hasInboxPermission())) {
        if (active) {
          await load();
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [uid, load]);

  const accept = async () => {
    recordDisclosureConsent(uid);
    const result = await requestInboxPermission();
    if (result === 'granted') {
      await load();
    } else {
      setPhase(result === 'blocked' ? 'blocked' : 'disclosure');
    }
  };

  const open = (offer: SmsOffer) => {
    const prefill = prefillFor(offer.parsed, currency.code);
    if (!prefill) {
      snackbar.error(
        `This message is in ${offer.parsed.currency}, not ${currency.code}. Add it by hand.`,
      );
      return;
    }
    markHandled(uid, [offer.parsed.id]);
    setOffers(current => current.filter(o => o.parsed.id !== offer.parsed.id));
    router.push({
      pathname:
        targetFor(offer.parsed) === 'expense' ? '/expense/add' : '/income/add',
      params: prefillParams(prefill),
    });
  };

  const skip = (offer: SmsOffer) => {
    markHandled(uid, [offer.parsed.id]);
    setOffers(current => current.filter(o => o.parsed.id !== offer.parsed.id));
  };

  if (!isInboxSupported()) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-center font-sans text-base text-text-secondary">
          Reading messages is available on Android only. You can still paste a
          bank message.
        </Text>
      </View>
    );
  }

  if (phase === 'disclosure' || phase === 'blocked') {
    return (
      <View className="flex-1 bg-background">
        <FormHeader
          icon={MessageSquareText}
          iconColor={colors.primary}
          title="Read my messages"
          subtitle="Find payments in your bank messages."
        />
        <View className="mx-5 rounded-[20px] border border-card-border bg-surface p-6">
          <Text className="font-sans-bold text-base font-semibold text-text-strong">
            What this does
          </Text>
          <Text className="mt-2 font-sans text-sm text-text">
            TrackaExpense reads SMS messages from bank and service senders on
            your phone, from the last 30 days, to suggest expenses and income
            from payment messages.
          </Text>
          <Text className="mt-3 font-sans text-sm text-text">
            Messages from phone numbers are never read. Messages are read and
            processed on your phone only. They are not stored, uploaded or
            shared. Only a list of codes of the messages you have handled is
            kept on your phone, so a message is not shown twice.
          </Text>
          <Text className="mt-3 font-sans text-sm text-text">
            Nothing is saved until you confirm it. You can stop at any time in
            your phone's app settings.
          </Text>
          {phase === 'blocked' ? (
            <>
              <Text className="mt-3 font-sans text-sm text-expense-text">
                Permission was turned off. Allow SMS for TrackaExpense in your
                phone's app settings, then come back.
              </Text>
              <View className="mt-4">
                <FormButton
                  buttonTitle="Open settings"
                  onPress={() => Linking.openSettings()}
                />
              </View>
            </>
          ) : (
            <View className="mt-5">
              <FormButton buttonTitle="Allow and continue" onPress={accept} />
            </View>
          )}
        </View>
      </View>
    );
  }

  if (phase === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="mb-4 text-center font-sans text-base text-text">
          Could not read your messages.
        </Text>
        <FormButton buttonTitle="Try again" onPress={load} />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerClassName="p-5"
      data={offers}
      keyExtractor={offer => offer.parsed.id}
      onRefresh={load}
      refreshing={false}
      ListEmptyComponent={
        <Text className="mt-10 text-center font-sans text-base text-text-secondary">
          No new payments found in the last 30 days.
        </Text>
      }
      renderItem={({item}) => {
        const expense = targetFor(item.parsed) === 'expense';
        return (
          <View className="mb-3 rounded-xl border border-card-border bg-surface p-4">
            <View className="flex-row items-center">
              {expense ? (
                <ArrowUpRight size={20} color={colors.expense} />
              ) : (
                <ArrowDownLeft size={20} color={colors.income} />
              )}
              <Text className="ml-2 flex-1 font-sans-bold text-base font-semibold text-text-strong">
                {titleFor(item.parsed)}
              </Text>
              <Text className="font-heading text-lg font-bold text-text-strong">
                {item.parsed.currency === currency.code
                  ? formatAmount(Number(item.parsed.amount))
                  : `${item.parsed.currency} ${item.parsed.amount}`}
              </Text>
            </View>
            <Text className="mt-1 font-sans text-xs text-text-secondary">
              {formatDisplayDate(item.parsed.date)}
              {item.parsed.account
                ? `, account ending ${item.parsed.account}`
                : ''}
            </Text>
            <View className="mt-3 flex-row">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Review and add ${titleFor(item.parsed)}`}
                className="mr-4 py-1"
                onPress={() => open(item)}>
                <Text className="font-sans-bold text-sm font-semibold text-primary">
                  {expense ? 'Review and add expense' : 'Review and add income'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Skip ${titleFor(item.parsed)}`}
                className="py-1"
                onPress={() => skip(item)}>
                <Text className="font-sans text-sm text-text-secondary">
                  Skip
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
    />
  );
};

export default SmsInboxScreen;
