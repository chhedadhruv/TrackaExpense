import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {ActivityIndicator} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {BarChart, PieChart} from 'react-native-gifted-charts';
import {compactAxisLabel, niceAxisMax} from '../src/utils/chartAxis';
import {useFocusEffect} from '@react-navigation/native';
import {getAuth} from '@react-native-firebase/auth';
import {
  collection,
  getDocs,
  getFirestore,
} from '@react-native-firebase/firestore';
import {reportError} from '../src/services/ErrorReporter';
import * as PerformanceService from '../src/services/PerformanceService';
import moment from 'moment';
import {DatePickerModal} from 'react-native-paper-dates';
import {useCurrency} from '../utils/CurrencyUtil';
import {getCategoryIcon} from '../utils/CategoryData';
import {useTheme} from '../src/theme';
import {formatDisplayDate} from '../src/utils/formatters';
import {majorOf, minorOf, totalMajor} from '../src/utils/amounts';
import {toMajorNumber} from '../src/utils/money';
import {getConfig} from '../src/services/RemoteConfigService';
import * as AnalyticsService from '../src/services/AnalyticsService';
import type {TransactionDocument} from '../src/types';
import type {McIconName} from '../src/types/icons';

type TimeRange =
  | 'all'
  | '7days'
  | '30days'
  | '3months'
  | '6months'
  | 'year'
  | 'custom';
type ChartBtn = 'Income' | 'Expense';

interface PieEntry {
  value: number;
  color: string;
  text: string;
  label: string;
  percent: number;
  amount: number;
}

interface BarEntry {
  value: number;
  label: string;
  frontColor: string;
  spacing: number;
  showLabel?: boolean;
}

// Slice colours for the category chart. Data colours, the same in both themes; each is mid-tone
// so it reads on the light card and on the charcoal one.
const PIE_PALETTE = [
  '#677CD2',
  '#E98852',
  '#25B07F',
  '#F6C84E',
  '#9B59B6',
  '#2E86C1',
  '#16A085',
  '#D35400',
];

const TIME_RANGES: {key: TimeRange; label: string; icon: McIconName}[] = [
  {key: 'all', label: 'All Time', icon: 'format-list-bulleted'},
  {key: '7days', label: 'Last 7 Days', icon: 'calendar-week'},
  {key: '30days', label: 'Last 30 Days', icon: 'calendar-month'},
  {key: '3months', label: 'Last 3 Months', icon: 'calendar-range'},
  {key: '6months', label: 'Last 6 Months', icon: 'calendar-clock'},
  {key: 'year', label: 'Last Year', icon: 'calendar'},
  {key: 'custom', label: 'Custom Range', icon: 'calendar-range'},
];

const Y_AXIS_SECTIONS = 3;

const StatisticScreen = ({navigation}: {navigation: any}) => {
  const {colors} = useTheme();
  const {currency, formatAmount} = useCurrency();
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedBar, setSelectedBar] = useState<BarEntry | null>(null);
  const [allTransactions, setAllTransactions] = useState<TransactionDocument[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [timeRange, setTimeRange] = useState<TimeRange>(
    (getConfig().stats_default_time_range as TimeRange) || 'all',
  );
  const [filteredTransactions, setFilteredTransactions] = useState<
    TransactionDocument[]
  >([]);
  const [selectedBtn, setSelectedBtn] = useState<ChartBtn>('Income');
  const [categoryPieData, setCategoryPieData] = useState<PieEntry[]>([]);
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);
  const [barData, setBarData] = useState<BarEntry[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);

  const fetchTransactions = async () => {
    try {
      setError(null);
      setLoading(true);
      const stopTrace = await PerformanceService.traceCalculateStatistics();
      const snapshot = await getDocs(
        collection(
          getFirestore(),
          'users',
          getAuth().currentUser!.uid,
          'transactions',
        ),
      );
      const txns = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as unknown as TransactionDocument[];
      setAllTransactions(txns.slice(0, getConfig().max_transactions_displayed));
      AnalyticsService.logViewStatistics({
        chart_type: selectedBtn.toLowerCase(),
        time_range: timeRange,
      });
      await stopTrace?.();
    } catch (e) {
      reportError(e as Error);
      setError('Failed to load transactions. Tap to retry.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const filterTransactionsByTimeRange = useCallback(
    (txns: TransactionDocument[], range: TimeRange): TransactionDocument[] => {
      if (range === 'all') {
        return txns;
      }
      if (range === 'custom') {
        if (!customStartDate || !customEndDate) {
          return [];
        }
        if (customStartDate > customEndDate) {
          return [];
        }
        return txns.filter(t =>
          moment(t.date).isBetween(
            customStartDate,
            customEndDate,
            undefined,
            '[]',
          ),
        );
      }
      const cutoff = new Date();
      const shifts: Record<Exclude<TimeRange, 'all' | 'custom'>, () => void> = {
        '7days': () => cutoff.setDate(cutoff.getDate() - 7),
        '30days': () => cutoff.setDate(cutoff.getDate() - 30),
        '3months': () => cutoff.setMonth(cutoff.getMonth() - 3),
        '6months': () => cutoff.setMonth(cutoff.getMonth() - 6),
        year: () => cutoff.setFullYear(cutoff.getFullYear() - 1),
      };
      shifts[range as Exclude<TimeRange, 'all' | 'custom'>]?.();
      return txns.filter(t => new Date(t.date) >= cutoff);
    },
    [customStartDate, customEndDate],
  );

  useEffect(() => {
    const filtered = filterTransactionsByTimeRange(allTransactions, timeRange);
    setFilteredTransactions(filtered);
    // Summed as integer minor units so the totals are exact.
    setTotalIncome(
      totalMajor(
        filtered.filter(t => t.type === 'income'),
        currency.code,
      ),
    );
    setTotalExpense(
      totalMajor(
        filtered.filter(t => t.type !== 'income'),
        currency.code,
      ),
    );
  }, [
    allTransactions,
    timeRange,
    filterTransactionsByTimeRange,
    currency.code,
  ]);

  useEffect(() => {
    if (
      timeRange === 'custom' &&
      customStartDate &&
      customEndDate &&
      customStartDate > customEndDate
    ) {
      setDateRangeError('Start date must be before end date.');
    } else {
      setDateRangeError(null);
    }
  }, [customStartDate, customEndDate, timeRange]);

  useEffect(() => {
    setVisibleCount(10);
  }, [selectedBtn, timeRange]);

  const handleBarTap = useCallback((data: any) => {
    if (tooltipTimer.current) {
      clearTimeout(tooltipTimer.current);
    }
    setSelectedBar(data);
    tooltipTimer.current = setTimeout(() => setSelectedBar(null), 3000);
  }, []);

  const getGroupingInterval = (
    range: TimeRange,
  ): 'daily' | 'weekly' | 'monthly' => {
    if (range === '7days' || range === '30days') {
      return 'daily';
    }
    if (range === '3months') {
      return 'weekly';
    }
    return 'monthly';
  };

  const getGroupingKeyAndLabel = (
    date: string,
    interval: 'daily' | 'weekly' | 'monthly',
  ) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    if (interval === 'daily') {
      return {
        key: `${year}-${String(month + 1).padStart(2, '0')}-${String(
          day,
        ).padStart(2, '0')}`,
        label: d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        ts: new Date(year, month, day).getTime(),
      };
    }
    if (interval === 'weekly') {
      const week = Math.ceil(day / 7);
      return {
        key: `${year}-${month}-W${week}`,
        label: `W${week}`,
        ts: new Date(year, month, (week - 1) * 7 + 1).getTime(),
      };
    }
    return {
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: d.toLocaleString('default', {month: 'short'}),
      ts: new Date(year, month, 1).getTime(),
    };
  };

  const handleBarData = useCallback(() => {
    if (!filteredTransactions.length) {
      setBarData([]);
      return;
    }
    const interval = getGroupingInterval(timeRange);
    const aggregatedMap = new Map<
      string,
      {label: string; ts: number; income: number; expense: number}
    >();
    filteredTransactions.forEach(t => {
      const {key, label, ts} = getGroupingKeyAndLabel(t.date, interval);
      // Accumulated as integer minor units; converted to major units when the bars are built.
      const value = minorOf(t, currency.code) ?? 0;
      if (!aggregatedMap.has(key)) {
        aggregatedMap.set(key, {label, ts, income: 0, expense: 0});
      }
      const entry = aggregatedMap.get(key)!;
      if (t.type === 'income') {
        entry.income += value;
      } else {
        entry.expense += value;
      }
    });
    const sorted = Array.from(aggregatedMap.values())
      .sort((a, b) => a.ts - b.ts)
      .slice(-8);
    const built: BarEntry[] = [];
    sorted.forEach((item, index) => {
      built.push({
        value: 0,
        label: item.label,
        frontColor: 'transparent',
        spacing: 2,
        showLabel: index % 2 === 0,
      });
      if (item.income > 0) {
        built.push({
          value: toMajorNumber(item.income, currency.code),
          label: '',
          frontColor: colors.primary,
          spacing: 2,
        });
      }
      if (item.expense > 0) {
        built.push({
          value: toMajorNumber(item.expense, currency.code),
          label: '',
          frontColor: colors.expense,
          spacing: 2,
        });
      }
      built.push({
        value: 0,
        label: '',
        frontColor: 'transparent',
        spacing: 10,
        showLabel: false,
      });
    });
    setBarData(built);
  }, [
    filteredTransactions,
    timeRange,
    currency.code,
    colors.primary,
    colors.expense,
  ]);

  useEffect(() => {
    handleBarData();
  }, [handleBarData]);

  useEffect(() => {
    if (!filteredTransactions.length) {
      setCategoryPieData([]);
      return;
    }
    const typeKey = selectedBtn === 'Income' ? 'income' : 'expense';
    const tx = filteredTransactions.filter(t => t.type === typeKey);
    // Integer minor units, converted to major units for display below.
    const total = tx.reduce(
      (sum, t) => sum + (minorOf(t, currency.code) ?? 0),
      0,
    );
    if (total <= 0) {
      setCategoryPieData([]);
      return;
    }
    const byCategory: Record<string, number> = {};
    tx.forEach(t => {
      const k = t.category || 'Others';
      byCategory[k] = (byCategory[k] || 0) + (minorOf(t, currency.code) ?? 0);
    });
    const entries = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    setCategoryPieData(
      entries.map(([label, amountMinor], idx) => {
        const amountValue = toMajorNumber(amountMinor, currency.code);
        const percentage = Math.round((amountMinor / total) * 100);
        return {
          value: percentage,
          color: PIE_PALETTE[idx % PIE_PALETTE.length],
          text: percentage >= 10 ? label : '',
          label,
          percent: percentage,
          amount: amountValue,
        };
      }),
    );
  }, [filteredTransactions, selectedBtn, currency.code]);

  const chartWidth = useMemo(() => {
    const base = Dimensions.get('window').width - 80;
    const groups = barData.filter(item => item.showLabel).length;
    return Math.max(base, groups * 70);
  }, [barData]);

  // The chart library takes style objects for its axis labels, so they follow the theme here.
  const axisTextStyles = useMemo(
    () => ({
      y: {color: colors.textMuted, fontFamily: 'Lato-Regular'},
      x: {
        color: colors.textMuted,
        fontSize: 10,
        textAlign: 'center' as const,
        width: 46,
        marginTop: 10,
        marginHorizontal: 2,
        fontFamily: 'Lato-Regular',
      },
    }),
    [colors.textMuted],
  );

  const getTimeRangeLabel = () =>
    TIME_RANGES.find(r => r.key === timeRange)?.label ?? 'Selected Period';

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-[15px] font-sans text-base text-primary">
          Loading your statistics…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-5">
        <MaterialCommunityIcons
          name="cloud-off-outline"
          size={56}
          color={colors.iconMuted}
        />
        <Text
          accessibilityRole="alert"
          className="my-4 text-center font-sans text-base text-expense-text">
          {error}
        </Text>
        <TouchableOpacity
          className="rounded-xl bg-primary-fill px-6 py-3"
          accessibilityRole="button"
          onPress={fetchTransactions}>
          <Text className="font-sans-bold text-base font-semibold text-on-primary">
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const typeKey = selectedBtn === 'Income' ? 'income' : 'expense';
  const visibleTransactions = filteredTransactions
    .filter(t => t.type === typeKey)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const shownTransactions = visibleTransactions.slice(0, visibleCount);
  const hasBars = barData.filter(item => item.value > 0).length > 0;

  return (
    <View className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-5 pb-[15px] pt-5">
          <Text
            accessibilityRole="header"
            className="font-heading text-2xl font-bold text-text-strong">
            Statistics
          </Text>
          <Text className="mt-1 font-sans text-base text-text-secondary">
            Track your financial insights
          </Text>
        </View>

        {/* Time Range Filter */}
        <View className="px-5 pb-[15px]">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {TIME_RANGES.map(({key, label, icon}) => {
              const active = timeRange === key;
              return (
                <TouchableOpacity
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{selected: active}}
                  onPress={() => {
                    setTimeRange(key);
                    AnalyticsService.logStatisticsTimeRangeChanged(key);
                  }}
                  className={`mr-2.5 flex-row items-center rounded-full border px-3.5 py-2 ${
                    active
                      ? 'border-primary-fill bg-primary-fill'
                      : 'border-card-border bg-surface'
                  }`}>
                  <MaterialCommunityIcons
                    name={icon}
                    size={16}
                    color={active ? colors.onPrimary : colors.primary}
                  />
                  <Text
                    className={`ml-1.5 font-sans-bold text-[13px] font-semibold ${
                      active ? 'text-on-primary' : 'text-primary'
                    }`}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {timeRange === 'custom' && (
          <View className="mx-5 mb-[15px] rounded-2xl border border-card-border bg-surface p-5">
            <Text className="mb-[15px] font-sans-bold text-base font-semibold text-text-strong">
              Select Date Range
            </Text>
            <View className="flex-row items-center">
              <TouchableOpacity
                className="flex-1 rounded-xl border border-card-border bg-surface-muted p-3"
                accessibilityRole="button"
                onPress={() => setStartDatePickerVisible(true)}>
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name="calendar-start"
                    size={20}
                    color={colors.primary}
                  />
                  <Text
                    className={`ml-2 font-sans text-sm ${
                      customStartDate ? 'text-text' : 'text-text-placeholder'
                    }`}>
                    {customStartDate
                      ? moment(customStartDate).format('MMM DD, YYYY')
                      : 'Start Date'}
                  </Text>
                </View>
              </TouchableOpacity>
              <View className="px-2.5">
                <Text className="font-sans text-sm text-text-secondary">
                  to
                </Text>
              </View>
              <TouchableOpacity
                className={`flex-1 rounded-xl border border-card-border bg-surface-muted p-3 ${
                  customStartDate ? '' : 'opacity-50'
                }`}
                accessibilityRole="button"
                accessibilityState={{disabled: !customStartDate}}
                onPress={() =>
                  customStartDate && setEndDatePickerVisible(true)
                }>
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name="calendar-end"
                    size={20}
                    color={
                      customStartDate ? colors.primary : colors.textPlaceholder
                    }
                  />
                  <Text
                    className={`ml-2 font-sans text-sm ${
                      customEndDate ? 'text-text' : 'text-text-placeholder'
                    }`}>
                    {customEndDate
                      ? moment(customEndDate).format('MMM DD, YYYY')
                      : 'End Date'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            {dateRangeError && (
              <Text
                accessibilityRole="alert"
                className="mt-2.5 font-sans text-[13px] text-expense-text">
                {dateRangeError}
              </Text>
            )}
            {timeRange === 'custom' &&
              (!customStartDate || !customEndDate) &&
              !dateRangeError && (
                <Text className="mt-2.5 text-center font-sans text-[13px] text-text-secondary">
                  Select both dates to filter transactions.
                </Text>
              )}
          </View>
        )}

        <DatePickerModal
          locale="en"
          mode="single"
          visible={startDatePickerVisible}
          onDismiss={() => setStartDatePickerVisible(false)}
          date={customStartDate ?? new Date()}
          onConfirm={(params: any) => {
            setStartDatePickerVisible(false);
            setCustomStartDate(params.date);
          }}
          saveLabel="Confirm"
          label="Select start date"
          uppercase={false}
          {...(Platform.OS === 'ios' && {presentationStyle: 'pageSheet'})}
        />
        <DatePickerModal
          locale="en"
          mode="single"
          visible={endDatePickerVisible}
          onDismiss={() => setEndDatePickerVisible(false)}
          date={customEndDate ?? new Date()}
          onConfirm={(params: any) => {
            setEndDatePickerVisible(false);
            setCustomEndDate(params.date);
          }}
          saveLabel="Confirm"
          label="Select end date"
          uppercase={false}
          {...(Platform.OS === 'ios' && {presentationStyle: 'pageSheet'})}
        />

        {/* Summary Cards */}
        <View className="mb-5 flex-row justify-between px-5">
          <View className="w-[48%] rounded-2xl border border-card-border bg-surface p-4 ios:shadow-md">
            <View className="mb-2.5 flex-row items-center">
              <View className="mr-2 h-8 w-8 items-center justify-center rounded-lg bg-surface-muted">
                <MaterialCommunityIcons
                  name="arrow-down"
                  size={20}
                  color={colors.income}
                />
              </View>
              <Text className="font-sans text-sm text-text-secondary">
                Total Income
              </Text>
            </View>
            <Text className="font-sans-bold text-[22px] font-bold text-income">
              {formatAmount(totalIncome)}
            </Text>
          </View>
          <View className="w-[48%] rounded-2xl border border-card-border bg-surface p-4 ios:shadow-md">
            <View className="mb-2.5 flex-row items-center">
              <View className="mr-2 h-8 w-8 items-center justify-center rounded-lg bg-surface-muted">
                <MaterialCommunityIcons
                  name="arrow-up"
                  size={20}
                  color={colors.expense}
                />
              </View>
              <Text className="font-sans text-sm text-text-secondary">
                Total Expense
              </Text>
            </View>
            <Text className="font-sans-bold text-[22px] font-bold text-expense">
              {formatAmount(totalExpense)}
            </Text>
          </View>
        </View>

        {/* Bar Chart */}
        <View className="mx-5 mb-5 rounded-[20px] border border-card-border bg-surface ios:shadow-lg">
          <View className="px-5 pb-2.5 pt-5">
            <Text className="font-sans-bold text-lg font-bold text-text-strong">
              Financial Overview
            </Text>
            <Text className="mt-0.5 font-sans text-[13px] text-text-secondary">
              {getTimeRangeLabel()}
            </Text>
          </View>
          <View className="px-5 pb-5">
            {hasBars ? (
              <>
                <View className="mb-2.5 flex-row justify-center">
                  <View className="mx-2.5 flex-row items-center">
                    <View className="mr-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                    <Text className="font-sans text-xs text-text-secondary">
                      Income
                    </Text>
                  </View>
                  <View className="mx-2.5 flex-row items-center">
                    <View className="mr-1.5 h-2.5 w-2.5 rounded-full bg-expense" />
                    <Text className="font-sans text-xs text-text-secondary">
                      Expense
                    </Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <BarChart
                    data={barData}
                    height={220}
                    barWidth={15}
                    spacing={2}
                    roundedTop
                    xAxisThickness={0}
                    yAxisThickness={0}
                    yAxisTextStyle={axisTextStyles.y}
                    xAxisLabelTextStyle={axisTextStyles.x}
                    noOfSections={Y_AXIS_SECTIONS}
                    showFractionalValues
                    isAnimated
                    onPress={handleBarTap}
                    yAxisLabelWidth={56}
                    formatYLabel={label =>
                      compactAxisLabel(Number(label), currency.symbol)
                    }
                    width={chartWidth}
                    xAxisLabelsHeight={32}
                    rulesColor={colors.divider}
                    maxValue={niceAxisMax(
                      Math.max(0, ...barData.map(i => i.value)),
                      Y_AXIS_SECTIONS,
                    )}
                    initialSpacing={20}
                    endSpacing={20}
                    hideRules
                    barBorderRadius={4}
                  />
                </ScrollView>
                {selectedBar && (
                  <View className="mt-2.5 self-center rounded-lg bg-primary-soft px-3.5 py-2">
                    <Text className="font-sans-bold text-sm text-text-strong">
                      {selectedBar.frontColor === colors.primary
                        ? 'Income'
                        : 'Expense'}
                      : {formatAmount(selectedBar.value)}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View className="items-center px-5 py-10">
                <MaterialCommunityIcons
                  name="chart-bar"
                  size={48}
                  color={colors.iconMuted}
                />
                <Text className="mt-3 font-sans-bold text-base font-semibold text-text-strong">
                  No data available
                </Text>
                <Text className="mt-1.5 text-center font-sans text-sm text-text-secondary">
                  No transactions found in this time period.{'\n'}Try changing
                  the date range above.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Category Pie with Income/Expense toggle in header */}
        <View className="mx-5 mb-5 rounded-[20px] border border-card-border bg-surface ios:shadow-lg">
          <View className="flex-row items-center justify-between px-5 pb-2.5 pt-5">
            <View className="flex-1">
              <Text className="font-sans-bold text-lg font-bold text-text-strong">
                {selectedBtn === 'Income'
                  ? 'Income by Category'
                  : 'Spending by Category'}
              </Text>
              <Text className="mt-0.5 font-sans text-[13px] text-text-secondary">
                {selectedBtn === 'Income'
                  ? 'Income distribution'
                  : 'Expenses distribution'}
              </Text>
            </View>
            <View className="ml-2.5 flex-row rounded-[10px] bg-surface-muted p-[3px]">
              {(['Income', 'Expense'] as ChartBtn[]).map(btn => {
                const active = selectedBtn === btn;
                return (
                  <TouchableOpacity
                    key={btn}
                    accessibilityRole="radio"
                    accessibilityState={{selected: active}}
                    className={`rounded-lg px-3 py-1.5 ${
                      active ? 'bg-primary-fill' : ''
                    }`}
                    onPress={() => setSelectedBtn(btn)}>
                    <Text
                      className={`font-sans-bold text-xs font-semibold ${
                        active ? 'text-on-primary' : 'text-text-secondary'
                      }`}>
                      {btn}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View className="items-center px-5 pb-5">
            {categoryPieData.length > 0 ? (
              <PieChart
                donut
                innerRadius={70}
                radius={100}
                innerCircleColor={colors.surface}
                focusOnPress
                showText={false}
                data={categoryPieData}
                centerLabelComponent={() => (
                  <View className="items-center">
                    <Text className="font-sans-bold text-base text-text-strong">
                      {formatAmount(
                        selectedBtn === 'Income' ? totalIncome : totalExpense,
                      )}
                    </Text>
                    <Text className="font-sans text-xs text-text-secondary">
                      {selectedBtn === 'Income'
                        ? 'Total Income'
                        : 'Total Expense'}
                    </Text>
                  </View>
                )}
              />
            ) : (
              <View className="items-center px-5 py-10">
                <MaterialCommunityIcons
                  name="chart-pie"
                  size={48}
                  color={colors.iconMuted}
                />
                <Text className="mt-3 font-sans-bold text-base font-semibold text-text-strong">
                  No {selectedBtn.toLowerCase()} data available
                </Text>
                <Text className="mt-1.5 text-center font-sans text-sm text-text-secondary">
                  No {selectedBtn.toLowerCase()}s found in this time period.
                  {'\n'}Try changing the date range above.
                </Text>
              </View>
            )}
            {categoryPieData.length > 0 && (
              <View className="mt-5 w-full">
                {categoryPieData.map(item => (
                  <View
                    key={item.label}
                    className="mb-2.5 flex-row items-center">
                    <View
                      className="mr-2.5 h-3 w-3 rounded-full"
                      style={{backgroundColor: item.color}}
                    />
                    <Text
                      className="flex-1 font-sans text-sm text-text"
                      numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text className="font-sans-bold text-[13px] text-text-secondary">
                      {item.percent}% · {formatAmount(Math.round(item.amount))}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Transaction list */}
        <View className="px-5 pb-[30px]">
          <Text
            accessibilityRole="header"
            className="font-sans-bold text-lg font-bold text-text-strong">
            {selectedBtn} Transactions
          </Text>
          <Text className="mb-[15px] mt-0.5 font-sans text-[13px] text-text-secondary">
            {visibleTransactions.length} transaction
            {visibleTransactions.length !== 1 ? 's' : ''}
          </Text>
          <View>
            {shownTransactions.length > 0 ? (
              shownTransactions.map(transaction => (
                <TouchableOpacity
                  key={transaction.id}
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate('TransactionDetail', {transaction})
                  }
                  className="mb-3 flex-row items-center justify-between rounded-2xl border border-card-border bg-surface p-4 ios:shadow-md">
                  <View className="flex-1 flex-row items-center">
                    <View className="mr-3 h-[50px] w-[50px] items-center justify-center rounded-[14px] bg-primary-soft">
                      <MaterialCommunityIcons
                        name={getCategoryIcon(transaction.category)}
                        size={24}
                        color={colors.primary}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className="mb-0.5 font-sans-bold text-base font-semibold text-text-strong"
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {transaction.title}
                      </Text>
                      <Text className="mb-0.5 font-sans text-[13px] text-primary">
                        {transaction.category}
                      </Text>
                      <Text className="font-sans text-xs text-text-secondary">
                        {formatDisplayDate(transaction.date)}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className={`ml-2 font-sans-bold text-base font-bold ${
                      transaction.type === 'income'
                        ? 'text-income'
                        : 'text-expense'
                    }`}>
                    {transaction.type === 'income' ? '+ ' : '- '}
                    {formatAmount(majorOf(transaction, currency.code))}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <View className="items-center px-5 py-10">
                <MaterialCommunityIcons
                  name="chart-line"
                  size={48}
                  color={colors.iconMuted}
                />
                <Text className="mt-3 font-sans-bold text-base font-semibold text-text-strong">
                  No {selectedBtn.toLowerCase()} transactions
                </Text>
                <Text className="mt-1.5 text-center font-sans text-sm text-text-secondary">
                  No {selectedBtn.toLowerCase()} data available for the selected
                  period.{'\n'}Try changing the date range above.
                </Text>
              </View>
            )}
            {visibleTransactions.length > visibleCount && (
              <TouchableOpacity
                className="mt-1 items-center rounded-xl border border-primary-fill bg-surface py-3"
                accessibilityRole="button"
                onPress={() => setVisibleCount(c => c + 10)}>
                <Text className="font-sans-bold text-sm font-semibold text-primary">
                  Show More ({visibleTransactions.length - visibleCount}{' '}
                  remaining)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default StatisticScreen;
