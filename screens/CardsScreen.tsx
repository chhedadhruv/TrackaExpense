import React, {useMemo} from 'react';
import {FlatList, Text, TouchableOpacity, View} from 'react-native';
import {useRouter} from 'expo-router';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Plus from 'lucide-react-native/icons/plus';
import {useTransactions} from '../src/data/hooks';
import {useCardPayments, useCards} from '../src/hooks/useCards';
import {getConfig} from '../src/services/RemoteConfigService';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../src/components/ScreenState';
import {useTheme} from '../src/theme';
import {
  paymentIdFor,
  previousPeriod,
  type CardPeriod,
} from '../src/utils/cardPeriods';
import {
  currentBill,
  periodOwedMinor,
  type CardDocument,
} from '../src/utils/cards';
import {toMajorNumber} from '../src/utils/money';
import {todayAsYMD, formatDisplayDate} from '../src/utils/formatters';
import {formatCurrency} from '../utils/CurrencyUtil';

interface Row {
  card: CardDocument;
  period: CardPeriod;
  dueDate: string | null;
  owedMinor: number;
  /** The finished period before this one, when it has something owed and is not paid yet. */
  unpaid: {period: CardPeriod; owedMinor: number} | null;
}

const money = (minor: number, currency: string): string =>
  formatCurrency(toMajorNumber(minor, currency), currency);

const CardRow = ({row, onPress}: {row: Row; onPress: () => void}) => {
  const {colors} = useTheme();
  const {card, period, dueDate, owedMinor, unpaid} = row;
  const title = card.last4 ? `${card.name} ${card.last4}` : card.name;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${money(
        owedMinor,
        card.currency,
      )} this period`}
      activeOpacity={0.7}
      onPress={onPress}
      className="mb-3 rounded-2xl border border-card-border bg-surface p-4">
      <View className="flex-row items-center">
        <CreditCard size={20} color={colors.primary} />
        <Text
          numberOfLines={1}
          className="ml-2 flex-1 font-sans-bold text-base font-bold text-text-strong">
          {title}
        </Text>
      </View>
      {unpaid ? (
        <View className="mt-3 rounded-xl bg-expense-soft p-3">
          <Text className="font-sans-bold text-sm font-bold text-expense-text">
            Bill to pay: {money(unpaid.owedMinor, card.currency)}
          </Text>
          <Text className="mt-0.5 font-sans text-xs text-expense-text">
            Statement of {formatDisplayDate(unpaid.period.end)}
          </Text>
        </View>
      ) : null}
      <Text className="mt-3 font-sans text-sm text-text-strong">
        {money(owedMinor, card.currency)} so far this period
      </Text>
      <Text className="mt-0.5 font-sans text-xs text-text-secondary">
        Statement on {formatDisplayDate(period.end)}
        {dueDate ? `, due ${formatDisplayDate(dueDate)}` : ''}
      </Text>
    </TouchableOpacity>
  );
};

const CardsScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const cards = useCards();
  const payments = useCardPayments();
  const transactions = useTransactions();
  const enabled = getConfig().enable_cards;

  const rows = useMemo<Row[]>(() => {
    const txs = transactions.data ?? [];
    const paid = new Set((payments.data ?? []).map(p => p.id));
    const today = todayAsYMD();
    const result: Row[] = [];
    for (const card of cards.data ?? []) {
      if (card.archived) {
        continue;
      }
      const bill = currentBill(card, today);
      if (!bill) {
        continue;
      }
      const before = previousPeriod(card.statementDay, bill.period);
      const beforeOwed = before ? periodOwedMinor(card, before, txs) : 0;
      result.push({
        card,
        period: bill.period,
        dueDate: bill.dueDate,
        owedMinor: periodOwedMinor(card, bill.period, txs),
        unpaid:
          before && beforeOwed > 0 && !paid.has(paymentIdFor(card.id, before))
            ? {period: before, owedMinor: beforeOwed}
            : null,
      });
    }
    return result;
  }, [cards.data, payments.data, transactions.data]);

  if (!enabled) {
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
    return <LoadingState message="Loading your cards..." />;
  }
  if (cards.error || payments.error) {
    return (
      <ErrorState
        title="Could not load your cards"
        message="Check your connection and try again."
        onRetry={() => {
          cards.refetch();
          payments.refetch();
        }}
      />
    );
  }

  const header = (
    <View className="mb-4">
      <Text
        accessibilityRole="header"
        className="font-heading text-[28px] font-bold text-text-strong">
        Cards
      </Text>
      <Text className="mt-1 font-sans text-base text-text-secondary">
        Mark an expense as paid with a card. It reaches your balance when you
        pay the card bill.
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Add card"
        activeOpacity={0.8}
        onPress={() => router.navigate('/profile/card-form')}
        className="mt-4 flex-row items-center justify-center rounded-xl bg-primary-fill py-3">
        <Plus size={20} color={colors.onPrimary} />
        <Text className="ml-2 font-sans-bold text-base font-bold text-on-primary">
          Add card
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerClassName="p-5 pb-10"
      data={rows}
      keyExtractor={row => row.card.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState
          icon={CreditCard}
          title="No cards yet"
          message="Add a credit card to see what you owe and when the bill is due."
        />
      }
      renderItem={({item}) => (
        <CardRow
          row={item}
          onPress={() =>
            router.navigate({
              pathname: '/profile/card-bill',
              params: {id: item.card.id},
            })
          }
        />
      )}
      onRefresh={() => {
        cards.refetch();
        payments.refetch();
      }}
      refreshing={false}
    />
  );
};

export default CardsScreen;
