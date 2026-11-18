import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Text, TouchableOpacity, View} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Pencil from 'lucide-react-native/icons/pencil';
import AmountInput from '../src/components/AmountInput';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../src/components/ScreenState';
import FormButton from '../components/FormButton';
import {useTransactions} from '../src/data/hooks';
import {useAsyncAction} from '../src/hooks/useAsyncAction';
import {useCardActions, useCardPayments, useCards} from '../src/hooks/useCards';
import {reportError} from '../src/services/ErrorReporter';
import {getConfig} from '../src/services/RemoteConfigService';
import {useTheme} from '../src/theme';
import {
  daysBetween,
  nextPeriod,
  paymentIdFor,
  periodFor,
  previousPeriod,
  type CardPeriod,
} from '../src/utils/cardPeriods';
import {periodOwedMinor, periodTransactions} from '../src/utils/cards';
import {fromMinor, toMajorNumber, tryToMinor} from '../src/utils/money';
import {minorOf} from '../src/utils/amounts';
import {snackbar} from '../src/utils/snackbarStore';
import {formatDisplayDate, todayAsYMD} from '../src/utils/formatters';
import {formatCurrency, getCurrencyByCode} from '../utils/CurrencyUtil';
import {dueDateFor} from '../src/utils/cardPeriods';

const money = (minor: number, currency: string): string =>
  formatCurrency(toMajorNumber(minor, currency), currency);

/**
 * One card's bill for one billing period (`/profile/card-bill?id=`): what was bought on the card,
 * what the card owes, an optional check against the bank's statement total, and "Mark paid",
 * which lowers the balance once and records the payment as a transfer (not spending).
 */
const CardBillScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const {id} = useLocalSearchParams<{id?: string}>();
  const cards = useCards();
  const payments = useCardPayments();
  const transactions = useTransactions();
  const {pay, undo} = useCardActions();
  const card = cards.data?.find(c => c.id === id);

  const today = todayAsYMD();
  // The period shown. Starts on the latest finished period when it still has a bill to pay,
  // otherwise the current one.
  const [period, setPeriod] = useState<CardPeriod | null>(null);
  const [statementText, setStatementText] = useState('');
  const [payText, setPayText] = useState('');

  const txs = useMemo(() => transactions.data ?? [], [transactions.data]);
  const current = card ? periodFor(card.statementDay, today) : null;

  useEffect(() => {
    if (!card || !current || period) {
      return;
    }
    const before = previousPeriod(card.statementDay, current);
    const paidIds = new Set((payments.data ?? []).map(p => p.id));
    const startOnBefore =
      before !== null &&
      periodOwedMinor(card, before, txs) > 0 &&
      !paidIds.has(paymentIdFor(card.id, before));
    setPeriod(startOnBefore ? before : current);
  }, [card, current, period, payments.data, txs]);

  const owed = useMemo(
    () => (card && period ? periodOwedMinor(card, period, txs) : 0),
    [card, period, txs],
  );
  const list = useMemo(
    () => (card && period ? periodTransactions(card, period, txs) : []),
    [card, period, txs],
  );
  const payment =
    card && period
      ? payments.data?.find(p => p.id === paymentIdFor(card.id, period))
      : undefined;

  // The amount to pay starts as what the app added up; the person can change it (interest, fees).
  useEffect(() => {
    if (card && !payment) {
      setPayText(owed > 0 ? fromMinor(owed, card.currency) : '');
    }
  }, [card, owed, payment, period]);

  const markPaid = async () => {
    if (!card || !period) {
      return;
    }
    const amountMinor = tryToMinor(payText, card.currency);
    if (amountMinor === null || amountMinor <= 0) {
      snackbar.error('Enter the amount you paid.');
      return;
    }
    const statementMinor =
      statementText.trim() === ''
        ? null
        : tryToMinor(statementText, card.currency);
    try {
      await pay(card, period, amountMinor, statementMinor);
      snackbar.success('Bill marked as paid');
    } catch (e) {
      if ((e as {code?: string}).code === 'already-paid') {
        snackbar.info('This bill is already marked as paid.');
        payments.refetch();
        return;
      }
      reportError(e as Error);
      snackbar.error('Could not record the payment. Try again.');
    }
  };
  const {run: handlePay, pending: paying} = useAsyncAction(markPaid);

  const undoPayment = async () => {
    if (!payment) {
      return;
    }
    try {
      await undo(payment.id);
      snackbar.success('Payment undone');
    } catch (e) {
      reportError(e as Error);
      snackbar.error('Could not undo the payment. Try again.');
    }
  };
  const {run: handleUndo, pending: undoing} = useAsyncAction(undoPayment);
  const confirmUndo = () =>
    Alert.alert(
      'Undo payment',
      'The paid amount goes back to your balance and the bill shows as unpaid again.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Undo', style: 'destructive', onPress: handleUndo},
      ],
    );

  if (!getConfig().enable_cards) {
    return (
      <EmptyState
        fill
        icon={CreditCard}
        title="Cards are not available yet"
        message="This feature is being rolled out. Check again soon."
      />
    );
  }
  if (cards.loading || payments.loading) {
    return <LoadingState message="Loading the bill..." />;
  }
  if (cards.error || payments.error || !card) {
    return (
      <ErrorState
        title="Could not load this card"
        message="It may have been removed, or the connection failed."
        onRetry={() => {
          cards.refetch();
          payments.refetch();
        }}
      />
    );
  }
  if (!period) {
    return <LoadingState message="Loading the bill..." />;
  }

  const dueDate = dueDateFor(card.statementDay, card.dueDay, period);
  const overdue =
    !payment && dueDate !== null && daysBetween(today, dueDate) < 0;
  const isFuture = period.end >= today && current?.end === period.end;
  const next = nextPeriod(card.statementDay, period);
  const canGoNext =
    next !== null && current !== null && next.end <= current.end;
  const prev = previousPeriod(card.statementDay, period);
  const symbol = getCurrencyByCode(card.currency).symbol;
  const statementMinor =
    statementText.trim() === ''
      ? null
      : tryToMinor(statementText, card.currency);
  const difference = statementMinor === null ? null : statementMinor - owed;
  const busy = paying || undoing;
  const title = card.last4 ? `${card.name} ${card.last4}` : card.name;

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-5 pb-10"
      keyboardShouldPersistTaps="handled">
      <View className="flex-row items-center">
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          className="flex-1 font-heading text-[28px] font-bold text-text-strong">
          {title}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Edit card"
          hitSlop={10}
          onPress={() =>
            router.navigate({
              pathname: '/profile/card-form',
              params: {id: card.id},
            })
          }>
          <Pencil size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-card-border bg-surface p-3">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Earlier statement"
          disabled={!prev}
          hitSlop={10}
          onPress={() => prev && setPeriod(prev)}>
          <ChevronLeft size={24} color={colors.primary} />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="font-sans-bold text-sm font-bold text-text-strong">
            {formatDisplayDate(period.start)} to {formatDisplayDate(period.end)}
          </Text>
          <Text className="font-sans text-xs text-text-secondary">
            {isFuture ? 'Current period' : 'Statement made'}
            {dueDate ? `, due ${formatDisplayDate(dueDate)}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Later statement"
          disabled={!canGoNext}
          hitSlop={10}
          onPress={() => next && canGoNext && setPeriod(next)}>
          <ChevronRight
            size={24}
            color={canGoNext ? colors.primary : colors.textPlaceholder}
          />
        </TouchableOpacity>
      </View>

      <View className="mt-4 rounded-2xl border border-card-border bg-surface p-4">
        <Text className="font-sans text-sm text-text-secondary">
          {isFuture ? 'Spent so far' : 'Total to pay'}
        </Text>
        <Text className="mt-1 font-heading text-3xl font-bold text-text-strong">
          {money(owed, card.currency)}
        </Text>
        {payment ? (
          <Text className="mt-2 font-sans-bold text-sm font-bold text-income-text">
            Paid {money(payment.amountMinor, payment.currency)}
          </Text>
        ) : overdue ? (
          <Text className="mt-2 font-sans-bold text-sm font-bold text-expense-text">
            Overdue since {formatDisplayDate(dueDate ?? undefined)}
          </Text>
        ) : null}
      </View>

      {payment ? (
        <View className="mt-4">
          <FormButton
            buttonTitle="Undo payment"
            onPress={confirmUndo}
            loading={undoing}
            disabled={busy}
            style={{backgroundColor: colors.expense}}
          />
        </View>
      ) : owed > 0 ? (
        <View className="mt-4 rounded-2xl border border-card-border bg-surface p-4">
          <AmountInput
            value={statementText}
            onChangeText={setStatementText}
            currencySymbol={symbol}
            disabled={busy}
            label="Bank statement total (optional)"
            placeholder="Check against your bank"
          />
          {difference !== null ? (
            <Text className="mt-2 font-sans text-sm text-text-secondary">
              {difference === 0
                ? 'Matches what you logged.'
                : difference > 0
                ? `${money(
                    difference,
                    card.currency,
                  )} on the statement is not logged here.`
                : `${money(
                    -difference,
                    card.currency,
                  )} logged here is not on the statement.`}
            </Text>
          ) : null}
          <View className="mt-4">
            <AmountInput
              value={payText}
              onChangeText={setPayText}
              currencySymbol={symbol}
              disabled={busy}
              label="Amount paid"
              placeholder="Enter the amount"
            />
          </View>
          <View className="mt-4">
            <FormButton
              buttonTitle="Mark paid"
              onPress={handlePay}
              loading={paying}
              disabled={busy}
            />
          </View>
          <Text className="mt-2 font-sans text-xs text-text-placeholder">
            Marking it paid lowers your balance by the amount paid. It is not
            counted as spending again.
          </Text>
        </View>
      ) : null}

      <Text className="mb-2 mt-6 font-sans-bold text-base font-bold text-text-strong">
        Purchases
      </Text>
      {list.length === 0 ? (
        <Text className="font-sans text-sm text-text-secondary">
          Nothing was paid with this card in this period.
        </Text>
      ) : (
        list.map(tx => {
          const minor = minorOf(tx, card.currency) ?? 0;
          const isRefund = tx.type === 'income';
          return (
            <TouchableOpacity
              key={tx.id ?? tx.documentId}
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={() =>
                tx.id
                  ? router.navigate(
                      `/transaction/${tx.id}` as '/transaction/[id]',
                    )
                  : undefined
              }
              className="mb-2 flex-row items-center justify-between rounded-xl border border-card-border bg-surface p-3">
              <View className="flex-1 pr-3">
                <Text
                  numberOfLines={1}
                  className="font-sans-bold text-sm font-bold text-text-strong">
                  {tx.title}
                </Text>
                <Text className="font-sans text-xs text-text-secondary">
                  {formatDisplayDate(tx.date)}
                  {tx.category ? `, ${tx.category}` : ''}
                </Text>
              </View>
              <Text
                className={`font-sans-bold text-sm font-bold ${
                  isRefund ? 'text-income-text' : 'text-text-strong'
                }`}>
                {isRefund ? '-' : ''}
                {money(minor, card.currency)}
              </Text>
            </TouchableOpacity>
          );
        })
      )}
    </KeyboardAwareScrollView>
  );
};

export default CardBillScreen;
