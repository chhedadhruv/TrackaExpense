import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {Card, ActivityIndicator} from 'react-native-paper';
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
import {
  PRIMARY_COLOR,
  BACKGROUND_COLOR,
  INCOME_COLOR,
  EXPENSE_COLOR,
} from '../src/constants/theme';
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
          frontColor: PRIMARY_COLOR,
          spacing: 2,
        });
      }
      if (item.expense > 0) {
        built.push({
          value: toMajorNumber(item.expense, currency.code),
          label: '',
          frontColor: EXPENSE_COLOR,
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
  }, [filteredTransactions, timeRange, currency.code]);

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

  const getTimeRangeLabel = () =>
    TIME_RANGES.find(r => r.key === timeRange)?.label ?? 'Selected Period';

  if (loading) {
    return (
      <View style={[styles.container, styles.centeredState]}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading your statistics…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centeredState]}>
        <MaterialCommunityIcons
          name="cloud-off-outline"
          size={56}
          color="#CBD3EE"
        />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchTransactions}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollContainer}>
        <View style={styles.headerSection}>
          <Text style={styles.headerText}>Statistics</Text>
          <Text style={styles.subHeaderText}>
            Track your financial insights
          </Text>
        </View>

        {/* Time Range Filter */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}>
            {TIME_RANGES.map(({key, label, icon}) => {
              const active = timeRange === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    setTimeRange(key);
                    AnalyticsService.logStatisticsTimeRangeChanged(key);
                  }}
                  style={[
                    styles.filterButton,
                    active && styles.filterButtonActive,
                  ]}>
                  <MaterialCommunityIcons
                    name={icon}
                    size={16}
                    color={active ? '#FFFFFF' : PRIMARY_COLOR}
                  />
                  <Text
                    style={
                      active
                        ? styles.filterButtonTextActive
                        : styles.filterButtonText
                    }>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {timeRange === 'custom' && (
          <View style={styles.customDateSection}>
            <Text style={styles.customDateTitle}>Select Date Range</Text>
            <View style={styles.customDateContainer}>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setStartDatePickerVisible(true)}>
                <View style={styles.dateInputContent}>
                  <MaterialCommunityIcons
                    name="calendar-start"
                    size={20}
                    color={PRIMARY_COLOR}
                  />
                  <Text
                    style={[
                      styles.dateInputText,
                      !customStartDate && styles.dateInputPlaceholder,
                    ]}>
                    {customStartDate
                      ? moment(customStartDate).format('MMM DD, YYYY')
                      : 'Start Date'}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={styles.dateSeparator}>
                <Text style={styles.dateSeparatorText}>to</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.dateInput,
                  !customStartDate && styles.dateInputDisabled,
                ]}
                onPress={() =>
                  customStartDate && setEndDatePickerVisible(true)
                }>
                <View style={styles.dateInputContent}>
                  <MaterialCommunityIcons
                    name="calendar-end"
                    size={20}
                    color={customStartDate ? PRIMARY_COLOR : '#CCC'}
                  />
                  <Text
                    style={[
                      styles.dateInputText,
                      !customEndDate && styles.dateInputPlaceholder,
                    ]}>
                    {customEndDate
                      ? moment(customEndDate).format('MMM DD, YYYY')
                      : 'End Date'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            {dateRangeError && (
              <Text style={styles.dateRangeErrorText}>{dateRangeError}</Text>
            )}
            {timeRange === 'custom' &&
              (!customStartDate || !customEndDate) &&
              !dateRangeError && (
                <Text style={styles.dateRangeHintText}>
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
        <View style={styles.cardSection}>
          <Card
            style={[
              styles.summaryCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 2}>
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <MaterialCommunityIcons
                    name="arrow-down"
                    size={20}
                    color={INCOME_COLOR}
                  />
                </View>
                <Text style={styles.cardTitle}>Total Income</Text>
              </View>
              <Text style={[styles.cardAmount, {color: INCOME_COLOR}]}>
                {formatAmount(totalIncome)}
              </Text>
            </View>
          </Card>
          <Card
            style={[
              styles.summaryCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 2}>
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <MaterialCommunityIcons
                    name="arrow-up"
                    size={20}
                    color={EXPENSE_COLOR}
                  />
                </View>
                <Text style={styles.cardTitle}>Total Expense</Text>
              </View>
              <Text style={[styles.cardAmount, {color: EXPENSE_COLOR}]}>
                {formatAmount(totalExpense)}
              </Text>
            </View>
          </Card>
        </View>

        {/* Bar Chart */}
        <Card
          style={[
            styles.statisticCard,
            Platform.OS === 'android' && styles.cardAndroid,
          ]}
          elevation={Platform.OS === 'android' ? 0 : 3}>
          <View style={styles.statisticHeader}>
            <Text style={styles.statisticHeaderText}>Financial Overview</Text>
            <Text style={styles.statisticHeaderSubText}>
              {getTimeRangeLabel()}
            </Text>
          </View>
          <View style={styles.chartContainer}>
            {barData.filter(item => item.value > 0).length > 0 ? (
              <>
                <View style={styles.barLegend}>
                  <View style={styles.barLegendItem}>
                    <View
                      style={[
                        styles.barLegendDot,
                        {backgroundColor: PRIMARY_COLOR},
                      ]}
                    />
                    <Text style={styles.barLegendLabel}>Income</Text>
                  </View>
                  <View style={styles.barLegendItem}>
                    <View
                      style={[
                        styles.barLegendDot,
                        {backgroundColor: EXPENSE_COLOR},
                      ]}
                    />
                    <Text style={styles.barLegendLabel}>Expense</Text>
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
                    yAxisTextStyle={{color: '#888', fontFamily: 'Lato-Regular'}}
                    xAxisLabelTextStyle={{
                      color: '#888',
                      fontSize: 10,
                      textAlign: 'center',
                      width: 46,
                      marginTop: 10,
                      marginHorizontal: 2,
                      fontFamily: 'Lato-Regular',
                    }}
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
                    rulesColor="#ECECEC"
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
                  <View style={styles.selectedBarContainer}>
                    <Text style={styles.selectedBarText}>
                      {selectedBar.frontColor === PRIMARY_COLOR
                        ? 'Income'
                        : 'Expense'}
                      : {formatAmount(selectedBar.value)}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="chart-bar"
                  size={48}
                  color="#CBD3EE"
                />
                <Text style={styles.emptyStateText}>No data available</Text>
                <Text style={styles.emptyStateSubText}>
                  No transactions found in this time period.{'\n'}Try changing
                  the date range above.
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Category Pie with Income/Expense toggle in header */}
        <Card
          style={[
            styles.statisticCard,
            Platform.OS === 'android' && styles.cardAndroid,
          ]}
          elevation={Platform.OS === 'android' ? 0 : 3}>
          <View style={styles.pieCardHeader}>
            <View>
              <Text style={styles.statisticHeaderText}>
                {selectedBtn === 'Income'
                  ? 'Income by Category'
                  : 'Spending by Category'}
              </Text>
              <Text style={styles.statisticHeaderSubText}>
                {selectedBtn === 'Income'
                  ? 'Income distribution'
                  : 'Expenses distribution'}
              </Text>
            </View>
            <View style={styles.pieToggleRow}>
              {(['Income', 'Expense'] as ChartBtn[]).map(btn => (
                <TouchableOpacity
                  key={btn}
                  style={[
                    styles.pieToggleBtn,
                    selectedBtn === btn && styles.pieToggleBtnActive,
                  ]}
                  onPress={() => setSelectedBtn(btn)}>
                  <Text
                    style={[
                      styles.pieToggleBtnText,
                      selectedBtn === btn && styles.pieToggleBtnTextActive,
                    ]}>
                    {btn}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={[styles.chartContainer, {alignItems: 'center'}]}>
            {categoryPieData.length > 0 ? (
              <PieChart
                donut
                innerRadius={70}
                radius={100}
                focusOnPress
                showText={false}
                data={categoryPieData}
                centerLabelComponent={() => (
                  <View style={{alignItems: 'center'}}>
                    <Text
                      style={{
                        fontFamily: 'Lato-Bold',
                        fontSize: 16,
                        color: '#2C2C2C',
                      }}>
                      {formatAmount(
                        selectedBtn === 'Income' ? totalIncome : totalExpense,
                      )}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'Lato-Regular',
                        fontSize: 12,
                        color: '#666',
                      }}>
                      {selectedBtn === 'Income'
                        ? 'Total Income'
                        : 'Total Expense'}
                    </Text>
                  </View>
                )}
              />
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="chart-pie"
                  size={48}
                  color="#CBD3EE"
                />
                <Text style={styles.emptyStateText}>
                  No {selectedBtn.toLowerCase()} data available
                </Text>
                <Text style={styles.emptyStateSubText}>
                  No {selectedBtn.toLowerCase()}s found in this time period.
                  {'\n'}Try changing the date range above.
                </Text>
              </View>
            )}
            {categoryPieData.length > 0 && (
              <View style={styles.legendContainer}>
                {categoryPieData.map(item => (
                  <View key={item.label} style={styles.legendRow}>
                    <View
                      style={[styles.legendDot, {backgroundColor: item.color}]}
                    />
                    <Text style={styles.legendLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={styles.legendValue}>
                      {item.percent}% · {formatAmount(Math.round(item.amount))}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Card>

        {/* Transaction list */}
        <View style={styles.transactionsSection}>
          {(() => {
            const typeKey = selectedBtn === 'Income' ? 'income' : 'expense';
            const visible = filteredTransactions
              .filter(t => t.type === typeKey)
              .sort(
                (a, b) =>
                  new Date(b.date).getTime() - new Date(a.date).getTime(),
              );
            const shown = visible.slice(0, visibleCount);
            return (
              <>
                <Text style={styles.transactionsHeaderText}>
                  {selectedBtn} Transactions
                </Text>
                <Text style={styles.transactionsSubHeaderText}>
                  {visible.length} transaction{visible.length !== 1 ? 's' : ''}
                </Text>
                <View style={styles.transactionsList}>
                  {shown.length > 0 ? (
                    shown.map(transaction => (
                      <Card
                        key={transaction.id}
                        style={[
                          styles.transactionsCard,
                          Platform.OS === 'android' && styles.cardAndroid,
                        ]}
                        elevation={Platform.OS === 'android' ? 0 : 2}
                        onPress={() =>
                          navigation.navigate('TransactionDetail', {
                            transaction,
                          })
                        }>
                        <View style={styles.transactionsCardContent}>
                          <View style={styles.transactionsCardDetails}>
                            <View style={styles.transactionsCardIcon}>
                              <MaterialCommunityIcons
                                name={getCategoryIcon(transaction.category)}
                                size={24}
                                color={PRIMARY_COLOR}
                              />
                            </View>
                            <View style={styles.transactionsCardInfo}>
                              <Text
                                style={styles.transactionsCardTitle}
                                numberOfLines={1}
                                ellipsizeMode="tail">
                                {transaction.title}
                              </Text>
                              <Text style={styles.transactionsCardCategory}>
                                {transaction.category}
                              </Text>
                              <Text style={styles.transactionsCardDate}>
                                {formatDisplayDate(transaction.date)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.transactionsCardAmount}>
                            <Text
                              style={
                                transaction.type === 'income'
                                  ? styles.amountIncome
                                  : styles.amountExpense
                              }>
                              {transaction.type === 'income' ? '+ ' : '- '}
                              {formatAmount(
                                majorOf(transaction, currency.code),
                              )}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <MaterialCommunityIcons
                        name="chart-line"
                        size={48}
                        color="#CBD3EE"
                      />
                      <Text style={styles.emptyStateText}>
                        No {selectedBtn.toLowerCase()} transactions
                      </Text>
                      <Text style={styles.emptyStateSubText}>
                        No {selectedBtn.toLowerCase()} data available for the
                        selected period.{'\n'}Try changing the date range above.
                      </Text>
                    </View>
                  )}
                  {visible.length > visibleCount && (
                    <TouchableOpacity
                      style={styles.showMoreButton}
                      onPress={() => setVisibleCount(c => c + 10)}>
                      <Text style={styles.showMoreButtonText}>
                        Show More ({visible.length - visibleCount} remaining)
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            );
          })()}
        </View>
      </ScrollView>
    </View>
  );
};

export default StatisticScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollContainer: {flex: 1},
  centeredState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#888',
    fontFamily: 'Lato-Regular',
  },
  errorText: {
    marginTop: 16,
    fontSize: 15,
    color: '#666',
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryButtonText: {color: '#FFFFFF', fontFamily: 'Lato-Bold', fontSize: 15},
  headerSection: {paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15},
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  subHeaderText: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
    fontFamily: 'Lato-Regular',
  },
  filterSection: {marginHorizontal: 20, marginBottom: 20},
  filterScrollView: {flexGrow: 0},
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  filterButtonActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginLeft: 6,
    fontFamily: 'Lato-Bold',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  customDateSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  customDateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 12,
    fontFamily: 'Lato-Bold',
  },
  customDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInput: {
    flex: 1,
    backgroundColor: '#F4F6FA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  dateInputDisabled: {opacity: 0.5},
  dateInputContent: {flexDirection: 'row', alignItems: 'center'},
  dateInputText: {
    fontSize: 14,
    color: '#2C2C2C',
    marginLeft: 8,
    fontFamily: 'Lato-Regular',
    fontWeight: '500',
  },
  dateInputPlaceholder: {color: '#999'},
  dateSeparator: {marginHorizontal: 10},
  dateSeparatorText: {fontSize: 12, color: '#999', fontFamily: 'Lato-Regular'},
  dateRangeErrorText: {
    marginTop: 10,
    fontSize: 13,
    color: EXPENSE_COLOR,
    fontFamily: 'Lato-Regular',
  },
  dateRangeHintText: {
    marginTop: 10,
    fontSize: 13,
    color: '#999',
    fontFamily: 'Lato-Regular',
  },
  cardSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {width: '48%', borderRadius: 16, backgroundColor: '#FFFFFF'},
  cardContent: {padding: 16},
  cardHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F4F6FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    fontFamily: 'Lato-Regular',
  },
  cardAmount: {fontSize: 20, fontWeight: 'bold', fontFamily: 'Lato-Bold'},
  statisticCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  statisticHeader: {padding: 20, paddingBottom: 10},
  statisticHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  statisticHeaderSubText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontFamily: 'Lato-Regular',
  },
  chartContainer: {paddingHorizontal: 20, paddingBottom: 20},
  barLegend: {flexDirection: 'row', marginBottom: 12, gap: 16},
  barLegendItem: {flexDirection: 'row', alignItems: 'center'},
  barLegendDot: {width: 10, height: 10, borderRadius: 5, marginRight: 6},
  barLegendLabel: {fontSize: 13, color: '#666', fontFamily: 'Lato-Regular'},
  selectedBarContainer: {marginTop: 10, alignItems: 'center'},
  selectedBarText: {
    fontSize: 14,
    color: '#2C2C2C',
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  pieCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 10,
  },
  pieToggleRow: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  pieToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  pieToggleBtnActive: {backgroundColor: PRIMARY_COLOR},
  pieToggleBtnText: {fontSize: 13, fontFamily: 'Lato-Bold', color: '#666'},
  pieToggleBtnTextActive: {color: '#FFFFFF'},
  transactionsSection: {marginHorizontal: 20, marginBottom: 30},
  transactionsHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  transactionsSubHeaderText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
    marginBottom: 15,
    fontFamily: 'Lato-Regular',
  },
  transactionsList: {},
  transactionsCard: {
    marginVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  transactionsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
  },
  transactionsCardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionsCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#E8EBF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  transactionsCardInfo: {flex: 1},
  transactionsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 2,
    fontFamily: 'Lato-Bold',
  },
  transactionsCardCategory: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontFamily: 'Lato-Regular',
    marginBottom: 2,
  },
  transactionsCardDate: {
    fontSize: 13,
    color: '#888',
    fontFamily: 'Lato-Regular',
  },
  transactionsCardAmount: {alignItems: 'flex-end'},
  amountIncome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: INCOME_COLOR,
    fontFamily: 'Lato-Bold',
  },
  amountExpense: {
    fontSize: 16,
    fontWeight: 'bold',
    color: EXPENSE_COLOR,
    fontFamily: 'Lato-Bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 15,
    fontFamily: 'Lato-Bold',
  },
  emptyStateSubText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Lato-Regular',
  },
  legendContainer: {width: '100%', marginTop: 16},
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  legendDot: {width: 10, height: 10, borderRadius: 5, marginRight: 10},
  legendLabel: {
    flex: 1,
    fontSize: 14,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  legendValue: {
    fontSize: 13,
    color: '#666',
    marginLeft: 10,
    fontFamily: 'Lato-Regular',
  },
  showMoreButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EBF7',
    alignItems: 'center',
  },
  showMoreButtonText: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontFamily: 'Lato-Bold',
  },
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
});
