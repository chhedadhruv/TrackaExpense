import React, {useMemo} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {useRouter} from 'expo-router';
import CreditCard from 'lucide-react-native/icons/credit-card';
import {useTransactions} from '../data/hooks';
import {useCardPayments, useCards} from '../hooks/useCards';
import {getConfig} from '../services/RemoteConfigService';
import {useTheme} from '../theme';
import {daysBetween} from '../utils/cardPeriods';
import {unpaidBills} from '../utils/cards';
import {formatDisplayDate, todayAsYMD} from '../utils/formatters';
import {toMajorNumber} from '../utils/money';
import {formatCurrency} from '../../utils/CurrencyUtil';

const MAX_SHOWN = 3;

/**
 * Home: card bills that are made and not yet marked paid, soonest due first. Shown only while
 * cards are on and there is something to pay; tapping a row opens that card's bill.
 */
const CardDuesStrip = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const enabled = getConfig().enable_cards;
  const cards = useCards().data;
  const payments = useCardPayments().data;
  const transactions = useTransactions().data;

  const today = todayAsYMD();
  const bills = useMemo(
    () =>
      enabled && cards && payments
        ? unpaidBills(
            cards,
            new Set(payments.map(p => p.id)),
            transactions ?? [],
            today,
          )
        : [],
    [enabled, cards, payments, transactions, today],
  );

  if (bills.length === 0) {
    return null;
  }

  return (
    <View className="mx-5 mb-2 mt-4 rounded-2xl border border-card-border bg-surface p-4">
      <View className="flex-row items-center">
        <CreditCard size={20} color={colors.primary} />
        <Text className="ml-2 font-sans-bold text-base font-bold text-text-strong">
          Card bills to pay
        </Text>
      </View>
      {bills.slice(0, MAX_SHOWN).map(bill => {
        const left =
          bill.dueDate === null ? null : daysBetween(today, bill.dueDate);
        const overdue = left !== null && left < 0;
        return (
          <TouchableOpacity
            key={`${bill.card.id}_${bill.period.end}`}
            accessibilityRole="button"
            activeOpacity={0.7}
            onPress={() =>
              router.navigate({
                pathname: '/profile/card-bill',
                params: {id: bill.card.id},
              })
            }
            className="mt-3 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text
                numberOfLines={1}
                className="font-sans-bold text-sm font-bold text-text-strong">
                {bill.card.last4
                  ? `${bill.card.name} ${bill.card.last4}`
                  : bill.card.name}
              </Text>
              <Text
                className={`font-sans text-xs ${
                  overdue ? 'text-expense-text' : 'text-text-secondary'
                }`}>
                {bill.dueDate === null
                  ? 'No due date set'
                  : overdue
                  ? `Overdue since ${formatDisplayDate(bill.dueDate)}`
                  : left === 0
                  ? 'Due today'
                  : `Due ${formatDisplayDate(bill.dueDate)}`}
              </Text>
            </View>
            <Text className="font-sans-bold text-sm font-bold text-text-strong">
              {formatCurrency(
                toMajorNumber(bill.owedMinor, bill.card.currency),
                bill.card.currency,
              )}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default CardDuesStrip;
