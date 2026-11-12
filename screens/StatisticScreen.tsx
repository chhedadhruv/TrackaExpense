import {View, Text, ScrollView, TouchableOpacity} from 'react-native';
import React, {useState, useCallback, useMemo} from 'react';
import ArrowDownLeft from 'lucide-react-native/icons/arrow-down-left';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import CalendarRange from 'lucide-react-native/icons/calendar-range';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import TrendingDown from 'lucide-react-native/icons/trending-down';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import {useFocusEffect, useRouter} from 'expo-router';
import DatePickerModal from '../src/components/DatePickerModal';
import {useTransactions} from '../src/data/hooks';
import {useCurrency} from '../utils/CurrencyUtil';
import {useTheme} from '../src/theme';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../src/components/ScreenState';
import {formatDisplayDate} from '../src/utils/formatters';
import {majorOf} from '../src/utils/amounts';
import {toMajorNumber} from '../src/utils/money';
import {getConfig} from '../src/services/RemoteConfigService';
import * as AnalyticsService from '../src/services/AnalyticsService';
import type {TransactionDocument} from '../src/types';
import TrendChart from '../src/components/statistics/TrendChart';
import CategoryDonut, {
  sliceColor,
} from '../src/components/statistics/CategoryDonut';
import Heatmap from '../src/components/statistics/Heatmap';
import {
  categoryBreakdown,
  dailyHeatmap,
  dayKeyOfDate,
  filterByRange,
  largestTransactions,
  percentChange,
  previousBounds,
  rangeBounds,
  summarize,
  topMerchants,
  trendBuckets,
  type StatsKind,
  type StatsRangeKey,
} from '../src/utils/statistics';

const RANGES: {key: StatsRangeKey; label: string}[] = [
  {key: 'all', label: 'All time'},
  {key: '7days', label: '7 days'},
  {key: '30days', label: '30 days'},
  {key: '3months', label: '3 months'},
  {key: '6months', label: '6 months'},
  {key: 'year', label: 'Year'},
  {key: 'custom', label: 'Custom'},
];

const RANGE_TITLES: Record<StatsRangeKey, string> = {
  all: 'All time',
  '7days': 'Last 7 days',
  '30days': 'Last 30 days',
  '3months': 'Last 3 months',
  '6months': 'Last 6 months',
  year: 'Last year',
  custom: 'Custom range',
};

const KINDS: {key: StatsKind; label: string}[] = [
  {key: 'expense', label: 'Expense'},
  {key: 'income', label: 'Income'},
];

const isRangeKey = (value: unknown): value is StatsRangeKey =>
  RANGES.some(r => r.key === value);

// A stable empty list, so the memo below does not recompute while nothing has loaded.
const NO_TRANSACTIONS: TransactionDocument[] = [];

const StatisticScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const {currency, formatAmount} = useCurrency();
  const code = currency.code;

  // The newest transactions from the shared cache (the same set Home and the Transactions list
  // show), which live listeners keep current; this screen reads nothing from Firestore itself.
  const {data, loading, error, retry} = useTransactions();
  const allTransactions = useMemo(
    () =>
      (data ?? NO_TRANSACTIONS).slice(
        0,
        getConfig().max_transactions_displayed,
      ),
    [data],
  );
  const [today, setToday] = useState(() => dayKeyOfDate(new Date()));
  const configured = getConfig().stats_default_time_range;
  const [range, setRange] = useState<StatsRangeKey>(
    isRangeKey(configured) ? configured : 'all',
  );
  const [kind, setKind] = useState<StatsKind>('expense');
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);

  // Each time the screen is shown: "today" moves on past midnight, and the view is logged.
  useFocusEffect(
    useCallback(() => {
      setToday(dayKeyOfDate(new Date()));
      AnalyticsService.logViewStatistics({
        chart_type: kind,
        time_range: range,
      });
      // Logged when the screen comes into focus, not on every change of range or kind.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const customStartKey = customStart ? dayKeyOfDate(customStart) : null;
  const customEndKey = customEnd ? dayKeyOfDate(customEnd) : null;
  const customInvalid =
    customStartKey !== null &&
    customEndKey !== null &&
    customStartKey > customEndKey;

  const bounds = useMemo(
    () => rangeBounds(range, today, {start: customStartKey, end: customEndKey}),
    [range, today, customStartKey, customEndKey],
  );

  const stats = useMemo(() => {
    const inside = filterByRange(allTransactions, bounds);
    const summary = summarize(inside, code);
    const previous = previousBounds(bounds);
    const previousExpense = previous
      ? summarize(filterByRange(allTransactions, previous), code).expenseMinor
      : 0;
    const trend = trendBuckets(inside, code, bounds, today);
    return {
      inside,
      summary,
      expenseChange: percentChange(summary.expenseMinor, previousExpense),
      trend,
      breakdown: categoryBreakdown(inside, kind, code),
      merchants: topMerchants(inside, kind, code),
      heatmap: dailyHeatmap(inside, kind, code, bounds, today),
      largest: largestTransactions(inside, kind, code),
    };
  }, [allTransactions, bounds, code, kind, today]);

  const money = (minor: number) => formatAmount(toMajorNumber(minor, code));

  if (loading) {
    return <LoadingState message="Loading your statistics…" />;
  }

  if (error) {
    return <ErrorState title="Could not load statistics" onRetry={retry} />;
  }

  const {summary, breakdown, merchants, heatmap, largest, trend} = stats;
  const kindTotal =
    kind === 'income' ? summary.incomeMinor : summary.expenseMinor;
  const hasAny = summary.count > 0;
  const kindWord = kind === 'income' ? 'Income' : 'Spending';
  const netPositive = summary.netMinor >= 0;
  const change = stats.expenseChange;

  return (
    <View className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-5 pb-3 pt-5">
          <Text
            accessibilityRole="header"
            className="font-heading text-2xl font-bold text-text-strong">
            Statistics
          </Text>
          <Text className="mt-1 font-sans text-base text-text-secondary">
            Where your money comes and goes
          </Text>
        </View>

        <View className="pb-3">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-5">
            {RANGES.map(({key, label}) => {
              const active = range === key;
              return (
                <TouchableOpacity
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{selected: active}}
                  onPress={() => {
                    setRange(key);
                    AnalyticsService.logStatisticsTimeRangeChanged(key);
                  }}
                  className={`mr-2 rounded-full border px-4 py-2 ${
                    active
                      ? 'border-primary-fill bg-primary-fill'
                      : 'border-card-border bg-surface'
                  }`}>
                  <Text
                    className={`font-sans-bold text-[13px] ${
                      active ? 'text-on-primary' : 'text-text-secondary'
                    }`}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {range === 'custom' && (
          <View className="mx-5 mb-3 rounded-2xl border border-card-border bg-surface p-4">
            <View className="flex-row items-center">
              <TouchableOpacity
                accessibilityRole="button"
                className="flex-1 flex-row items-center rounded-xl border border-card-border bg-surface-muted p-3"
                onPress={() => setStartPickerVisible(true)}>
                <CalendarRange size={18} color={colors.primary} />
                <Text
                  className={`ml-2 font-sans text-sm ${
                    customStartKey ? 'text-text' : 'text-text-placeholder'
                  }`}>
                  {customStartKey ? formatDisplayDate(customStartKey) : 'From'}
                </Text>
              </TouchableOpacity>
              <Text className="px-2.5 font-sans text-sm text-text-secondary">
                to
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{disabled: !customStart}}
                className={`flex-1 flex-row items-center rounded-xl border border-card-border bg-surface-muted p-3 ${
                  customStart ? '' : 'opacity-50'
                }`}
                onPress={() => customStart && setEndPickerVisible(true)}>
                <CalendarRange
                  size={18}
                  color={customStart ? colors.primary : colors.textPlaceholder}
                />
                <Text
                  className={`ml-2 font-sans text-sm ${
                    customEndKey ? 'text-text' : 'text-text-placeholder'
                  }`}>
                  {customEndKey ? formatDisplayDate(customEndKey) : 'To'}
                </Text>
              </TouchableOpacity>
            </View>
            {customInvalid ? (
              <Text
                accessibilityRole="alert"
                className="mt-2.5 font-sans text-[13px] text-expense-text">
                Start date must be before end date.
              </Text>
            ) : !customStartKey || !customEndKey ? (
              <Text className="mt-2.5 text-center font-sans text-[13px] text-text-secondary">
                Pick both dates to see this range.
              </Text>
            ) : null}
          </View>
        )}

        <DatePickerModal
          visible={startPickerVisible}
          onDismiss={() => setStartPickerVisible(false)}
          date={customStart ?? new Date()}
          onConfirm={({date}) => setCustomStart(date)}
          label="Select start date"
        />
        <DatePickerModal
          visible={endPickerVisible}
          onDismiss={() => setEndPickerVisible(false)}
          date={customEnd ?? new Date()}
          onConfirm={({date}) => setCustomEnd(date)}
          label="Select end date"
        />

        {!hasAny ? (
          <View className="px-5 pb-10">
            <EmptyState
              icon={ChartColumn}
              title="Nothing to show yet"
              message={`No transactions in this period (${RANGE_TITLES[
                range
              ].toLowerCase()}). Try another range.`}
            />
          </View>
        ) : (
          <>
            {/* Overview */}
            <View className="mx-5 mb-4 rounded-[20px] border border-card-border bg-surface p-5">
              <Text className="font-sans text-[13px] text-text-secondary">
                Net, {RANGE_TITLES[range].toLowerCase()}
              </Text>
              <Text
                className={`mt-1 font-sans-bold text-[30px] font-bold ${
                  netPositive ? 'text-income' : 'text-expense'
                }`}
                accessibilityLabel={`Net ${
                  netPositive ? 'plus' : 'minus'
                } ${money(Math.abs(summary.netMinor))}`}>
                {netPositive ? '' : '-'}
                {money(Math.abs(summary.netMinor))}
              </Text>
              {change !== null && (
                <View className="mt-1.5 flex-row items-center">
                  {change > 0 ? (
                    <TrendingUp size={16} color={colors.expense} />
                  ) : (
                    <TrendingDown size={16} color={colors.income} />
                  )}
                  <Text className="ml-1.5 font-sans text-[13px] text-text-secondary">
                    Spending {change > 0 ? 'up' : change < 0 ? 'down' : 'flat'}{' '}
                    {change === 0 ? '' : `${Math.abs(change)}% `}
                    on the previous period
                  </Text>
                </View>
              )}
              <View className="mt-4 flex-row">
                <View className="mr-3 flex-1 rounded-2xl bg-income-soft p-3.5">
                  <View className="flex-row items-center">
                    <ArrowDownLeft size={16} color={colors.incomeText} />
                    <Text className="ml-1.5 font-sans text-[13px] text-text-secondary">
                      Income
                    </Text>
                  </View>
                  <Text
                    className="mt-1.5 font-sans-bold text-lg font-bold text-income-text"
                    numberOfLines={1}
                    adjustsFontSizeToFit>
                    {money(summary.incomeMinor)}
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-expense-soft p-3.5">
                  <View className="flex-row items-center">
                    <ArrowUpRight size={16} color={colors.expenseText} />
                    <Text className="ml-1.5 font-sans text-[13px] text-text-secondary">
                      Expense
                    </Text>
                  </View>
                  <Text
                    className="mt-1.5 font-sans-bold text-lg font-bold text-expense-text"
                    numberOfLines={1}
                    adjustsFontSizeToFit>
                    {money(summary.expenseMinor)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Cash flow */}
            <View className="mx-5 mb-4 rounded-[20px] border border-card-border bg-surface p-5">
              <View className="mb-3 flex-row items-center justify-between">
                <View>
                  <Text className="font-sans-bold text-lg font-bold text-text-strong">
                    Cash flow
                  </Text>
                  <Text className="mt-0.5 font-sans text-[13px] text-text-secondary">
                    By{' '}
                    {trend.interval === 'daily'
                      ? 'day'
                      : trend.interval === 'weekly'
                      ? 'week'
                      : 'month'}
                  </Text>
                </View>
                <View className="flex-row">
                  <View className="mr-3 flex-row items-center">
                    <View className="mr-1.5 h-2.5 w-2.5 rounded-full bg-income" />
                    <Text className="font-sans text-xs text-text-secondary">
                      Income
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <View className="mr-1.5 h-2.5 w-2.5 rounded-full bg-expense" />
                    <Text className="font-sans text-xs text-text-secondary">
                      Expense
                    </Text>
                  </View>
                </View>
              </View>
              {trend.buckets.length > 0 && (
                <TrendChart
                  buckets={trend.buckets}
                  interval={trend.interval}
                  currencyCode={code}
                  formatAmount={formatAmount}
                />
              )}
            </View>

            {/* Expense or income switch for everything below */}
            <View className="mx-5 mb-4 flex-row rounded-xl border border-card-border bg-surface-muted p-1">
              {KINDS.map(({key, label}) => {
                const active = kind === key;
                return (
                  <TouchableOpacity
                    key={key}
                    accessibilityRole="radio"
                    accessibilityState={{selected: active}}
                    className={`flex-1 items-center rounded-[10px] py-2.5 ${
                      active ? 'bg-primary-fill' : ''
                    }`}
                    onPress={() => setKind(key)}>
                    <Text
                      className={`font-sans-bold text-sm ${
                        active ? 'text-on-primary' : 'text-text-secondary'
                      }`}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {kindTotal <= 0 ? (
              <View className="mx-5 mb-4 rounded-[20px] border border-card-border bg-surface px-5 py-8">
                <Text className="text-center font-sans-bold text-base text-text-strong">
                  No {kind} in this period
                </Text>
                <Text className="mt-1.5 text-center font-sans text-sm text-text-secondary">
                  Try another range or switch to{' '}
                  {kind === 'income' ? 'expense' : 'income'}.
                </Text>
              </View>
            ) : (
              <>
                {/* Categories */}
                <View className="mx-5 mb-4 rounded-[20px] border border-card-border bg-surface p-5">
                  <Text className="font-sans-bold text-lg font-bold text-text-strong">
                    {kind === 'income'
                      ? 'Income by category'
                      : 'Spending by category'}
                  </Text>
                  <View className="mt-2">
                    <CategoryDonut
                      slices={breakdown.slices}
                      centerTitle={`Total ${kind}`}
                      centerValue={money(breakdown.totalMinor)}
                    />
                  </View>
                  <View className="mt-4">
                    {breakdown.slices.map((slice, index) => (
                      <View key={slice.category} className="mb-3.5">
                        <View className="flex-row items-center">
                          <View
                            className="mr-2.5 h-3 w-3 rounded-full"
                            style={{backgroundColor: sliceColor(slice, index)}}
                          />
                          <Text
                            className="flex-1 font-sans text-sm text-text"
                            numberOfLines={1}>
                            {slice.category}
                          </Text>
                          <Text className="font-sans-bold text-[13px] text-text-strong">
                            {money(slice.minor)}
                          </Text>
                          <Text className="w-12 text-right font-sans text-[13px] text-text-secondary">
                            {slice.percent}%
                          </Text>
                        </View>
                        <View className="ml-[22px] mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${slice.percent}%`,
                              backgroundColor: sliceColor(slice, index),
                            }}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Top merchants */}
                {merchants.length > 0 && (
                  <View className="mx-5 mb-4 rounded-[20px] border border-card-border bg-surface p-5">
                    <Text className="font-sans-bold text-lg font-bold text-text-strong">
                      {kind === 'income' ? 'Top sources' : 'Top merchants'}
                    </Text>
                    <Text className="mb-2 mt-0.5 font-sans text-[13px] text-text-secondary">
                      Grouped by title
                    </Text>
                    {merchants.map((m, index) => (
                      <View
                        key={m.name}
                        className={`flex-row items-center py-3 ${
                          index > 0 ? 'border-t border-divider' : ''
                        }`}>
                        <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-primary-soft">
                          <Text className="font-sans-bold text-[13px] text-primary">
                            {index + 1}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text
                            className="font-sans-bold text-[15px] text-text-strong"
                            numberOfLines={1}>
                            {m.name}
                          </Text>
                          <Text className="font-sans text-xs text-text-secondary">
                            {m.count} transaction{m.count === 1 ? '' : 's'}
                          </Text>
                        </View>
                        <Text className="font-sans-bold text-[15px] text-text-strong">
                          {money(m.minor)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Heatmap */}
                {heatmap.weeks.length > 0 && (
                  <View className="mx-5 mb-4 rounded-[20px] border border-card-border bg-surface p-5">
                    <Text className="font-sans-bold text-lg font-bold text-text-strong">
                      Daily {kind === 'income' ? 'income' : 'spending'}
                    </Text>
                    <Text className="mb-2 mt-0.5 font-sans text-[13px] text-text-secondary">
                      {kindWord} per day, up to the last 13 weeks
                    </Text>
                    <Heatmap
                      data={heatmap}
                      color={kind === 'income' ? colors.income : colors.expense}
                      currencyCode={code}
                      formatAmount={formatAmount}
                      verb={kind === 'income' ? 'Earned' : 'Spent'}
                    />
                  </View>
                )}

                {/* Largest transactions */}
                {largest.length > 0 && (
                  <View className="mx-5 mb-8 rounded-[20px] border border-card-border bg-surface p-5">
                    <Text className="font-sans-bold text-lg font-bold text-text-strong">
                      Largest {kind === 'income' ? 'income' : 'expenses'}
                    </Text>
                    {largest.map((t, index) => (
                      <TouchableOpacity
                        key={t.id}
                        accessibilityRole="button"
                        onPress={() =>
                          router.navigate(`/statistic/transaction/${t.id}`)
                        }
                        className={`flex-row items-center py-3 ${
                          index > 0 ? 'border-t border-divider' : ''
                        } ${index === 0 ? 'mt-1' : ''}`}>
                        <View className="flex-1 pr-3">
                          <Text
                            className="font-sans-bold text-[15px] text-text-strong"
                            numberOfLines={1}>
                            {t.title}
                          </Text>
                          <Text className="font-sans text-xs text-text-secondary">
                            {t.category} · {formatDisplayDate(t.date)}
                          </Text>
                        </View>
                        <Text
                          className={`font-sans-bold text-[15px] ${
                            kind === 'income' ? 'text-income' : 'text-expense'
                          }`}>
                          {kind === 'income' ? '+ ' : '- '}
                          {formatAmount(majorOf(t, code))}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default StatisticScreen;
