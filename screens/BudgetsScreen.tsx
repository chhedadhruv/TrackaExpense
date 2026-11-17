import React, {useMemo} from 'react';
import {FlatList, Text, TouchableOpacity, View} from 'react-native';
import {useRouter} from 'expo-router';
import Plus from 'lucide-react-native/icons/plus';
import PiggyBank from 'lucide-react-native/icons/piggy-bank';
import {useTransactions} from '../src/data/hooks';
import {useBudgets} from '../src/hooks/useBudgets';
import {getConfig} from '../src/services/RemoteConfigService';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../src/components/ScreenState';
import {useTheme} from '../src/theme';
import {
  budgetPeriod,
  daysLeft,
  progressOf,
  spentMinorOf,
  todayInZone,
  type BudgetDocument,
  type BudgetPeriod,
  type BudgetProgress,
} from '../src/utils/budgets';
import {toMajorNumber} from '../src/utils/money';
import {formatCurrency} from '../utils/CurrencyUtil';
import {formatDisplayDate} from '../src/utils/formatters';
import type {TransactionDocument} from '../src/types';

interface Row {
  budget: BudgetDocument;
  period: BudgetPeriod | null;
  progress: BudgetProgress;
  left: number | null;
}

const money = (minor: number, currency: string): string =>
  formatCurrency(toMajorNumber(minor, currency), currency);

const titleOf = (budget: BudgetDocument): string =>
  budget.name !== '' ? budget.name : budget.category ?? 'All spending';

const periodText = (
  budget: BudgetDocument,
  period: BudgetPeriod | null,
): string => {
  if (budget.period === 'monthly') {
    return 'Monthly';
  }
  return period
    ? `${formatDisplayDate(period.start)} to ${formatDisplayDate(period.end)}`
    : 'Custom period';
};

const BudgetCard = ({row, onPress}: {row: Row; onPress: () => void}) => {
  const {colors} = useTheme();
  const {budget, period, progress, left} = row;
  const barColor =
    progress.state === 'over'
      ? colors.expense
      : progress.state === 'warning'
      ? colors.warning
      : colors.primary;
  const remaining =
    progress.remainingMinor >= 0
      ? `${money(progress.remainingMinor, budget.currency)} left`
      : `${money(-progress.remainingMinor, budget.currency)} over`;
  const label = `${titleOf(budget)}, ${
    progress.percent
  } percent used, ${remaining}`;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
      onPress={onPress}
      className="mb-3 rounded-2xl border border-card-border bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text
          numberOfLines={1}
          className="flex-1 font-sans-bold text-base font-bold text-text-strong">
          {titleOf(budget)}
        </Text>
        {!budget.enabled ? (
          <Text className="ml-2 font-sans text-xs text-text-placeholder">
            Alerts off
          </Text>
        ) : null}
      </View>
      <Text className="mt-0.5 font-sans text-xs text-text-secondary">
        {periodText(budget, period)}
        {budget.name !== '' && budget.category ? `, ${budget.category}` : ''}
      </Text>
      <View className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
        <View
          style={{
            width: `${Math.min(100, progress.percent)}%`,
            backgroundColor: barColor,
          }}
          className="h-2 rounded-full"
        />
      </View>
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="font-sans text-sm text-text-strong">
          {money(progress.spentMinor, budget.currency)} of{' '}
          {money(progress.limitMinor, budget.currency)}
        </Text>
        <Text
          className="font-sans-bold text-sm font-bold"
          style={{color: barColor}}>
          {progress.percent}%
        </Text>
      </View>
      <Text className="mt-1 font-sans text-xs text-text-secondary">
        {remaining}
        {left !== null && left > 0
          ? `, ${left} ${left === 1 ? 'day' : 'days'} to go`
          : left === 0
          ? ', period ended'
          : ''}
      </Text>
    </TouchableOpacity>
  );
};

const BudgetsScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const budgets = useBudgets();
  const transactions = useTransactions();
  const enabled = getConfig().enable_budgets;

  const rows = useMemo<Row[]>(() => {
    const txs: readonly TransactionDocument[] = transactions.data ?? [];
    const now = new Date();
    return (budgets.data ?? []).map(budget => {
      const today = todayInZone(now, budget.timeZone);
      const period = budgetPeriod(budget, today);
      const spent = period ? spentMinorOf(budget, period, txs) : 0;
      return {
        budget,
        period,
        progress: progressOf(spent, budget.limitMinor),
        left: period ? daysLeft(period, today) : null,
      };
    });
  }, [budgets.data, transactions.data]);

  if (!enabled) {
    return (
      <EmptyState
        fill
        icon={PiggyBank}
        title="Budgets are not available yet"
        message="This feature is being rolled out. Check again soon."
      />
    );
  }
  if (budgets.loading) {
    return <LoadingState message="Loading your budgets..." />;
  }
  if (budgets.error) {
    return (
      <ErrorState
        title="Could not load your budgets"
        message="Check your connection and try again."
        onRetry={() => {
          budgets.refetch();
        }}
      />
    );
  }

  const header = (
    <View className="mb-4">
      <Text
        accessibilityRole="header"
        className="font-heading text-[28px] font-bold text-text-strong">
        Budgets
      </Text>
      <Text className="mt-1 font-sans text-base text-text-secondary">
        Set a limit and get an alert as you get close to it.
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Add budget"
        activeOpacity={0.8}
        onPress={() => router.navigate('/profile/budget')}
        className="mt-4 flex-row items-center justify-center rounded-xl bg-primary-fill py-3">
        <Plus size={20} color={colors.onPrimary} />
        <Text className="ml-2 font-sans-bold text-base font-bold text-on-primary">
          Add budget
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerClassName="p-5 pb-10"
      data={rows}
      keyExtractor={row => row.budget.id}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <EmptyState
          icon={PiggyBank}
          title="No budgets yet"
          message="Add a budget to track spending against a limit."
        />
      }
      renderItem={({item}) => (
        <BudgetCard
          row={item}
          onPress={() =>
            router.navigate({
              pathname: '/profile/budget',
              params: {id: item.budget.id},
            })
          }
        />
      )}
      onRefresh={() => {
        budgets.refetch();
      }}
      refreshing={false}
    />
  );
};

export default BudgetsScreen;
