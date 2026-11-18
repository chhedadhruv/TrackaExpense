import React, {useMemo, useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {useRouter} from 'expo-router';
import Scale from 'lucide-react-native/icons/scale';
import AmountInput from '../src/components/AmountInput';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import {EmptyState} from '../src/components/ScreenState';
import FormButton from '../components/FormButton';
import {useTransactions, useUid, useUserData} from '../src/data/hooks';
import {useAsyncAction} from '../src/hooks/useAsyncAction';
import {BalanceError, adjustBalance} from '../src/services/BalanceService';
import {reportError} from '../src/services/ErrorReporter';
import {getConfig} from '../src/services/RemoteConfigService';
import {useTheme} from '../src/theme';
import {adjustmentFor, catchUpOf, entryMinor} from '../src/utils/balanceAdjust';
import {toMajorNumber} from '../src/utils/money';
import {snackbar} from '../src/utils/snackbarStore';
import {formatDisplayDate, todayAsYMD} from '../src/utils/formatters';
import {formatCurrency, useCurrency} from '../utils/CurrencyUtil';

const LIST_LIMIT = 10;

/**
 * "Fix my balance" (`/profile/fix-balance`). The person types what their balance really is; the
 * app records one Balance adjustment for the difference. Income and expense totals, statistics and
 * budgets do not change. Above the form it lists what arrived from splits since the last entry
 * made by hand, which is usually why the balance drifted.
 */
const FixBalanceScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const {currency} = useCurrency();
  const uid = useUid();
  const user = useUserData();
  const transactions = useTransactions();
  const [actualText, setActualText] = useState('');

  const balance = user.data?.balance ?? 0;
  const catchUp = useMemo(
    () => catchUpOf(transactions.data ?? [], todayAsYMD()),
    [transactions.data],
  );
  const adjustment = adjustmentFor(balance, actualText, currency.code);
  const money = (minor: number): string =>
    formatCurrency(toMajorNumber(minor, currency.code), currency.code);

  const submit = async () => {
    try {
      await adjustBalance(uid, actualText, currency.code);
      snackbar.success('Balance updated');
      router.back();
    } catch (e) {
      if (e instanceof BalanceError) {
        snackbar.info(
          'Your balance already matches, or the amount is not valid.',
        );
        return;
      }
      reportError(e as Error);
      snackbar.error('Could not update the balance. Try again.');
    }
  };
  const {run: handleSubmit, pending: saving} = useAsyncAction(submit);

  if (!getConfig().enable_balance_adjust) {
    return (
      <EmptyState
        fill
        icon={Scale}
        title="Fix my balance is not available yet"
        message="This feature is being rolled out. Check again soon."
      />
    );
  }

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5 pb-10"
      keyboardShouldPersistTaps="handled">
      <Text
        accessibilityRole="header"
        className="font-heading text-[28px] font-bold text-text-strong">
        Fix my balance
      </Text>
      <Text className="mt-1 font-sans text-base text-text-secondary">
        Tell us what you have right now. We add one adjustment for the
        difference, so your income and expense totals stay true.
      </Text>

      <View className="mt-4 rounded-2xl border border-card-border bg-surface p-4">
        <Text className="font-sans text-sm text-text-secondary">
          Balance in the app
        </Text>
        <Text className="mt-1 font-heading text-3xl font-bold text-text-strong">
          {formatCurrency(balance, currency.code)}
        </Text>
        <View className="mt-4">
          <AmountInput
            value={actualText}
            onChangeText={setActualText}
            currencySymbol={currency.symbol}
            disabled={saving}
            label="Your real balance now"
            placeholder="Enter your balance"
          />
        </View>
        {adjustment ? (
          <Text className="mt-3 font-sans text-sm text-text-strong">
            {adjustment.type === 'income'
              ? `We will add ${money(adjustment.amountMinor)} to your balance.`
              : `We will take ${money(
                  adjustment.amountMinor,
                )} off your balance.`}{' '}
            It is saved as a Balance adjustment and is not counted as income or
            spending.
          </Text>
        ) : actualText.trim() !== '' ? (
          <Text className="mt-3 font-sans text-sm text-text-secondary">
            Your balance already matches.
          </Text>
        ) : null}
        <View className="mt-4">
          <FormButton
            buttonTitle="Update balance"
            onPress={handleSubmit}
            loading={saving}
            disabled={saving || adjustment === null}
          />
        </View>
      </View>

      {catchUp ? (
        <View className="mt-6">
          <Text className="font-sans-bold text-base font-bold text-text-strong">
            Added from splits since your last entry
          </Text>
          <Text className="mb-2 mt-1 font-sans text-sm text-text-secondary">
            {catchUp.splitEntries.length} entries changed your balance without
            you adding them
            {catchUp.lastResetDay
              ? ` since ${formatDisplayDate(catchUp.lastResetDay)}`
              : ''}
            .
          </Text>
          {catchUp.splitEntries.slice(0, LIST_LIMIT).map((tx, index) => (
            <TouchableOpacity
              key={tx.id ?? `${index}`}
              accessibilityRole="button"
              activeOpacity={0.7}
              disabled={!tx.id}
              onPress={() =>
                router.navigate(`/transaction/${tx.id}` as '/transaction/[id]')
              }
              className="mb-2 flex-row items-center justify-between rounded-xl border border-card-border bg-surface p-3">
              <View className="flex-1 pr-3">
                <Text
                  numberOfLines={1}
                  className="font-sans-bold text-sm font-bold text-text-strong">
                  {tx.title ?? 'Split entry'}
                </Text>
                <Text className="font-sans text-xs text-text-secondary">
                  {formatDisplayDate(tx.date)}
                </Text>
              </View>
              <Text
                className="font-sans-bold text-sm font-bold"
                style={{
                  color: tx.type === 'income' ? colors.income : colors.expense,
                }}>
                {tx.type === 'income' ? '+' : '-'}
                {money(entryMinor(tx, currency.code))}
              </Text>
            </TouchableOpacity>
          ))}
          {catchUp.splitEntries.length > LIST_LIMIT ? (
            <Text className="font-sans text-xs text-text-placeholder">
              and {catchUp.splitEntries.length - LIST_LIMIT} more
            </Text>
          ) : null}
        </View>
      ) : null}
    </KeyboardAwareScrollView>
  );
};

export default FixBalanceScreen;
