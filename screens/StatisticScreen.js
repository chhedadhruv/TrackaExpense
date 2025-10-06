import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {BarChart, PieChart} from 'react-native-gifted-charts';
import {useFocusEffect} from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import moment from 'moment';
import {DatePickerModal} from 'react-native-paper-dates';
const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const INCOME_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';
const StatisticScreen = ({navigation}) => {
  const [selectedBar, setSelectedBar] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [timeRange, setTimeRange] = useState('7days');
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [selectedBtn, setSelectedBtn] = useState('Income');
  const [categoryPieData, setCategoryPieData] = useState([]);
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);
  const filterTransactionsByTimeRange = (transactions, range) => {
    const now = new Date();
    const cutoffDate = new Date();
    switch (range) {
      case '7days':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '30days':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '3months':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case '6months':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          return transactions.filter(t => {
            const transactionDate = moment(t.date);
            return transactionDate.isBetween(customStartDate, customEndDate, undefined, '[]');
          });
        }
        return transactions;
      case 'all':
        return transactions;
      default:
        cutoffDate.setDate(now.getDate() - 7);
    }
    return transactions.filter(t => new Date(t.date) >= cutoffDate);
  };
  const getGroupingInterval = range => {
    switch (range) {
      case '7days':
      case '30days':
        return 'daily';
      case '3months':
        return 'weekly';
      case '6months':
      case 'year':
      case 'all':
        return 'monthly';
      default:
        return 'daily';
    }
  };
  const getGroupingKeyAndLabel = (date, interval) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    if (interval === 'daily') {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const label = d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
      return {key, label, ts: new Date(year, month, day).getTime()};
    }
    if (interval === 'weekly') {
      const firstOfMonth = new Date(year, month, 1);
      const week = Math.ceil(day / 7);
      const ts = new Date(year, month, (week - 1) * 7 + 1).getTime();
      return {key: `${year}-${month}-W${week}`, label: `W${week}`, ts};
    }
    // monthly
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', {month: 'short'});
    return {key, label, ts: new Date(year, month, 1).getTime()};
  };
  const getUser = async () => {
    try {
      const querySnapshot = await firestore()
        .collection('users')
        .doc(auth().currentUser.uid)
        .collection('transactions')
        .get();
      const transactions = [];
      querySnapshot.forEach(doc => {
        transactions.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      setUserData({transactions});
      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };
  useEffect(() => {
    getUser();
  }, []);
  useFocusEffect(
    useCallback(() => {
      getUser();
    }, []),
  );
  useEffect(() => {
    if (userData?.transactions) {
      const filtered = filterTransactionsByTimeRange(
        userData.transactions,
        timeRange,
      );
      setFilteredTransactions(filtered);
      // Calculate totals based on filtered transactions
      let income = 0;
      let expense = 0;
      filtered.forEach(transaction => {
        if (transaction.type === 'income') {
          income += parseFloat(transaction.amount) || 0;
        } else {
          expense += parseFloat(transaction.amount) || 0;
        }
      });
      setTotalIncome(income);
      setTotalExpense(expense);
    }
  }, [userData, timeRange, customStartDate, customEndDate]);
  
  const onDismissStartDatePicker = () => {
    setStartDatePickerVisible(false);
  };
  
  const onConfirmStartDate = params => {
    setStartDatePickerVisible(false);
    setCustomStartDate(params.date);
  };
  
  const onDismissEndDatePicker = () => {
    setEndDatePickerVisible(false);
  };
  
  const onConfirmEndDate = params => {
    setEndDatePickerVisible(false);
    setCustomEndDate(params.date);
  };
  const [barData, setBarData] = useState([]);
  const chartWidth = useMemo(() => {
    const baseWidth = Dimensions.get('window').width - 80;
    const labelGroups = barData.filter(item => item.showLabel).length;
    const groupWidth = 70; // space for label + bars
    const computed = Math.max(baseWidth, labelGroups * groupWidth);
    return computed;
  }, [barData]);
  const handleBarData = useCallback(() => {
    if (!filteredTransactions?.length) return;
    const interval = getGroupingInterval(timeRange);
    const aggregatedMap = new Map();
    filteredTransactions.forEach(transaction => {
      const {key, label, ts} = getGroupingKeyAndLabel(transaction.date, interval);
      const value = parseFloat(transaction.amount) || 0;
      if (!aggregatedMap.has(key)) {
        aggregatedMap.set(key, {label, ts, income: 0, expense: 0});
      }
      const entry = aggregatedMap.get(key);
      if (transaction.type === 'income') {
        entry.income += value;
      } else {
        entry.expense += value;
      }
      aggregatedMap.set(key, entry);
    });
    const sorted = Array.from(aggregatedMap.values()).sort((a, b) => a.ts - b.ts);
    const last = sorted.slice(-8); // limit labels to reduce overlap
    const built = [];
    const groupGap = 10;
    last.forEach((item, index) => {
      const showLabel = index % 2 === 0; // show every other label
      built.push({
        value: 0,
        label: item.label,
        frontColor: 'transparent',
        spacing: 2,
        showLabel,
      });
      if (item.income > 0) {
        built.push({value: item.income, label: '', frontColor: '#677CD2', spacing: 2});
      }
      if (item.expense > 0) {
        built.push({value: item.expense, label: '', frontColor: '#E98852', spacing: 2});
      }
      // add an invisible spacer bar to create margin between label groups
      built.push({value: 0, label: '', frontColor: 'transparent', spacing: groupGap, showLabel: false});
    });
    setBarData(built);
  }, [filteredTransactions, timeRange]);
  // Build category pie data (Income/Expense based on selection)
  useEffect(() => {
    if (!filteredTransactions?.length) {
      setCategoryPieData([]);
      return;
    }
    const typeKey = selectedBtn === 'Income' ? 'income' : 'expense';
    const tx = filteredTransactions.filter(t => t.type === typeKey);
    const total = tx.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    if (total <= 0) {
      setCategoryPieData([]);
      return;
    }
    const byCategory = tx.reduce((acc, t) => {
      const key = t.category || 'Others';
      acc[key] = (acc[key] || 0) + (parseFloat(t.amount) || 0);
      return acc;
    }, {});
    const palette = ['#677CD2', '#E98852', '#25B07F', '#F6C84E', '#9B59B6', '#2E86C1', '#16A085', '#D35400'];
    const entries = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const pie = entries.map(([label, amountValue], idx) => {
      const percentage = Math.round((amountValue / total) * 100);
      const color = palette[idx % palette.length];
      // Show label on slice only for larger portions (>= 10%) to avoid clutter
      return {
        value: percentage,
        color,
        text: percentage >= 10 ? `${label}` : '',
        label,
        percent: percentage,
        amount: amountValue,
      };
    });
    setCategoryPieData(pie);
  }, [filteredTransactions, selectedBtn]);
  useEffect(() => {
    handleBarData();
  }, [filteredTransactions, handleBarData]);
  const handleBarPress = data => {
    setSelectedBar(data);
  };
  const handleBtnPress = btn => {
    setSelectedBtn(btn);
  };
  const getTimeRangeLabel = () => {
    const labels = {
      'all': 'All Time',
      '7days': 'Last 7 Days',
      '30days': 'Last 30 Days',
      '3months': 'Last 3 Months',
      '6months': 'Last 6 Months',
      'year': 'Last Year',
      'custom': 'Custom Range',
    };
    return labels[timeRange] || 'Selected Period';
  };
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContainer}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.headerText}>Statistics</Text>
          <Text style={styles.subHeaderText}>Track your financial insights</Text>
        </View>
        {/* Time Range Filter Section */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
            <TouchableOpacity
              onPress={() => setTimeRange('all')}
              style={[styles.filterButton, timeRange === 'all' && styles.filterButtonActive]}>
              <MaterialCommunityIcons
                name="format-list-bulleted"
                size={16}
                color={timeRange === 'all' ? '#FFFFFF' : PRIMARY_COLOR}
              />
              <Text style={timeRange === 'all' ? styles.filterButtonTextActive : styles.filterButtonText}>
                All Time
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTimeRange('7days')}
              style={[styles.filterButton, timeRange === '7days' && styles.filterButtonActive]}>
              <MaterialCommunityIcons
                name="calendar-week"
                size={16}
                color={timeRange === '7days' ? '#FFFFFF' : PRIMARY_COLOR}
              />
              <Text style={timeRange === '7days' ? styles.filterButtonTextActive : styles.filterButtonText}>
                Last 7 Days
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTimeRange('30days')}
              style={[styles.filterButton, timeRange === '30days' && styles.filterButtonActive]}>
              <MaterialCommunityIcons
                name="calendar-month"
                size={16}
                color={timeRange === '30days' ? '#FFFFFF' : PRIMARY_COLOR}
              />
              <Text style={timeRange === '30days' ? styles.filterButtonTextActive : styles.filterButtonText}>
                Last 30 Days
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTimeRange('3months')}
              style={[styles.filterButton, timeRange === '3months' && styles.filterButtonActive]}>
              <MaterialCommunityIcons
                name="calendar-range"
                size={16}
                color={timeRange === '3months' ? '#FFFFFF' : PRIMARY_COLOR}
              />
              <Text style={timeRange === '3months' ? styles.filterButtonTextActive : styles.filterButtonText}>
                Last 3 Months
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTimeRange('6months')}
              style={[styles.filterButton, timeRange === '6months' && styles.filterButtonActive]}>
              <MaterialCommunityIcons
                name="calendar-clock"
                size={16}
                color={timeRange === '6months' ? '#FFFFFF' : PRIMARY_COLOR}
              />
              <Text style={timeRange === '6months' ? styles.filterButtonTextActive : styles.filterButtonText}>
                Last 6 Months
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTimeRange('year')}
              style={[styles.filterButton, timeRange === 'year' && styles.filterButtonActive]}>
              <MaterialCommunityIcons
                name="calendar"
                size={16}
                color={timeRange === 'year' ? '#FFFFFF' : PRIMARY_COLOR}
              />
              <Text style={timeRange === 'year' ? styles.filterButtonTextActive : styles.filterButtonText}>
                Last Year
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTimeRange('custom')}
              style={[styles.filterButton, timeRange === 'custom' && styles.filterButtonActive]}>
              <MaterialCommunityIcons
                name="calendar-range"
                size={16}
                color={timeRange === 'custom' ? '#FFFFFF' : PRIMARY_COLOR}
              />
              <Text style={timeRange === 'custom' ? styles.filterButtonTextActive : styles.filterButtonText}>
                Custom Range
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        {/* Custom Date Range Section */}
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
                  <Text style={[styles.dateInputText, !customStartDate && styles.dateInputPlaceholder]}>
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
                style={styles.dateInput}
                onPress={() => setEndDatePickerVisible(true)}>
                <View style={styles.dateInputContent}>
                  <MaterialCommunityIcons
                    name="calendar-end"
                    size={20}
                    color={PRIMARY_COLOR}
                  />
                  <Text style={[styles.dateInputText, !customEndDate && styles.dateInputPlaceholder]}>
                    {customEndDate
                      ? moment(customEndDate).format('MMM DD, YYYY')
                      : 'End Date'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <DatePickerModal
          locale="en"
          mode="single"
          visible={startDatePickerVisible}
          onDismiss={onDismissStartDatePicker}
          date={customStartDate || new Date()}
          onConfirm={onConfirmStartDate}
          saveLabel="Confirm"
          label="Select start date"
          uppercase={false}
          {...(Platform.OS === 'ios' && { presentationStyle: 'pageSheet' })}
        />
        <DatePickerModal
          locale="en"
          mode="single"
          visible={endDatePickerVisible}
          onDismiss={onDismissEndDatePicker}
          date={customEndDate || new Date()}
          onConfirm={onConfirmEndDate}
          saveLabel="Confirm"
          label="Select end date"
          uppercase={false}
          {...(Platform.OS === 'ios' && { presentationStyle: 'pageSheet' })}
        />
        {/* Summary Cards */}
        <View style={styles.cardSection}>
          <Card style={styles.incomeCard} elevation={2}>
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
              <Text style={styles.cardIncomeAmount}>
                ₹{totalIncome.toLocaleString()}
              </Text>
            </View>
          </Card>
          <Card style={styles.expenseCard} elevation={2}>
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
              <Text style={styles.cardExpenseAmount}>
                ₹{totalExpense.toLocaleString()}
              </Text>
            </View>
          </Card>
        </View>
        {/* Statistics Chart Section */}
        <Card style={styles.statisticCard} elevation={3}>
          <View style={styles.statisticHeader}>
            <Text style={styles.statisticHeaderText}>Financial Overview</Text>
            <Text style={styles.statisticHeaderSubText}>
              {getTimeRangeLabel()}
            </Text>
          </View>
          <View style={styles.chartContainer}>
            {barData.filter(item => item.value > 0).length > 0 ? (
              <>
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
                    noOfSections={3}
                    isAnimated
                    onPress={handleBarPress}
                    yAxisLabelFormatter={value => `₹${value}`}
                    yAxisLabelWidth={50}
                    yAxisLabelPrefix={'₹'}
                    width={chartWidth}
                    xAxisLabelsHeight={32}
                    horizontalRulesStyle={{color: '#ECECEC'}}
                    rulesColor="#ECECEC"
                    maxValue={
                      Math.max(
                        ...barData
                          .filter(item => item.value > 0)
                          .map(item => item.value),
                      ) * 1.1
                    }
                    initialSpacing={20}
                    endSpacing={20}
                    hideRules={true}
                    barBorderRadius={4}
                    showFractionalValue={false}
                    hideDataPoints={true}
                  />
                </ScrollView>
                {selectedBar && (
                  <View style={styles.selectedBarContainer}>
                    <Text style={styles.selectedBarText}>
                      {selectedBar.frontColor === '#677CD2' ? 'Income' : 'Expense'}: ₹{' '}
                      {selectedBar.value.toFixed(2)}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="chart-bar" size={48} color="#CBD3EE" />
                <Text style={styles.emptyStateText}>No data available</Text>
                <Text style={styles.emptyStateSubText}>
                  No transactions found in this time period.{'\n'}Try changing the date range above.
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Category Breakdown Pie */
        }
        <Card style={styles.statisticCard} elevation={3}>
          <View style={styles.statisticHeader}>
            <Text style={styles.statisticHeaderText}>
              {selectedBtn === 'Income' ? 'Income by Category' : 'Spending by Category'}
            </Text>
            <Text style={styles.statisticHeaderSubText}>
              {selectedBtn === 'Income' ? 'Income distribution' : 'Expenses distribution'}
            </Text>
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
                    <Text style={{fontFamily: 'Lato-Bold', fontSize: 16, color: '#2C2C2C'}}>₹{(selectedBtn === 'Income' ? totalIncome : totalExpense).toLocaleString()}</Text>
                    <Text style={{fontFamily: 'Lato-Regular', fontSize: 12, color: '#666'}}>
                      {selectedBtn === 'Income' ? 'Total Income' : 'Total Expense'}
                    </Text>
                  </View>
                )}
              />
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="chart-pie" size={48} color="#CBD3EE" />
                <Text style={styles.emptyStateText}>No {selectedBtn.toLowerCase()} data available</Text>
                <Text style={styles.emptyStateSubText}>
                  No {selectedBtn.toLowerCase()}s found in this time period.{'\n'}Try changing the date range above.
                </Text>
              </View>
            )}
            {categoryPieData.length > 0 && (
              <View style={styles.legendContainer}>
                {categoryPieData.map(item => (
                  <View key={item.label} style={styles.legendRow}>
                    <View style={[styles.legendDot, {backgroundColor: item.color}]} />
                    <Text style={styles.legendLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text style={styles.legendValue}>
                      {item.percent}% · ₹{Math.round(item.amount).toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Card>
        {/* Income/Expense Filter Buttons */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[
              styles.incomeExpenseButton,
              selectedBtn === 'Income' && styles.selectedIncomeExpenseButton
            ]}
            onPress={() => handleBtnPress('Income')}>
            <Text
              style={[
                styles.incomeExpenseButtonText,
                selectedBtn === 'Income' && styles.selectedIncomeExpenseButtonText
              ]}>
              Income
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.incomeExpenseButton,
              selectedBtn === 'Expense' && styles.selectedIncomeExpenseButton
            ]}
            onPress={() => handleBtnPress('Expense')}>
            <Text
              style={[
                styles.incomeExpenseButtonText,
                selectedBtn === 'Expense' && styles.selectedIncomeExpenseButtonText
              ]}>
              Expense
            </Text>
          </TouchableOpacity>
        </View>
        {/* Transactions List */}
        <View style={styles.transactionsSection}>
          <Text style={styles.transactionsHeaderText}>
            {selectedBtn} Transactions
          </Text>
          <Text style={styles.transactionsSubHeaderText}>
            {filteredTransactions.filter(
              transaction =>
                (selectedBtn === 'Income' && transaction.type === 'income') ||
                (selectedBtn === 'Expense' && transaction.type === 'expense'),
            ).length} transaction{filteredTransactions.filter(
              transaction =>
                (selectedBtn === 'Income' && transaction.type === 'income') ||
                (selectedBtn === 'Expense' && transaction.type === 'expense'),
            ).length !== 1 ? 's' : ''}
          </Text>
          <View style={styles.transactionsList}>
            {filteredTransactions.length > 0 ? (
              filteredTransactions
                .filter(
                  transaction =>
                    (selectedBtn === 'Income' && transaction.type === 'income') ||
                    (selectedBtn === 'Expense' && transaction.type === 'expense'),
                )
                .map(transaction => (
                  <Card
                    style={styles.transactionsCard}
                    key={transaction.id}
                    elevation={2}
                    onPress={() =>
                      navigation.navigate('TransactionDetail', {
                        transaction,
                      })
                    }>
                    <View style={styles.transactionsCardContent}>
                      <View style={styles.transactionsCardDetails}>
                        <View style={styles.transactionsCardIcon}>
                          <MaterialCommunityIcons
                            name={getCategoryIcon(
                              transaction.category,
                              transaction.type,
                            )}
                            size={24}
                            color={PRIMARY_COLOR}
                          />
                        </View>
                        <View style={styles.transactionsCardInfo}>
                          <Text style={styles.transactionsCardTitle} numberOfLines={1}>
                            {transaction.title.length > 25
                              ? transaction.title.slice(0, 25) + '...'
                              : transaction.title}
                          </Text>
                          <Text style={styles.transactionsCardDate}>
                            {transaction.date}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.transactionsCardAmount}>
                        <Text
                          style={
                            transaction.type === 'income'
                              ? styles.transactionsCardAmountIncomeText
                              : styles.transactionsCardAmountExpenseText
                          }>
                          {transaction.type === 'income' ? '+₹' : '-₹'}
                          {parseInt(transaction.amount, 10).toLocaleString()}
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
                <Text style={styles.emptyStateText}>No {selectedBtn.toLowerCase()} transactions</Text>
                <Text style={styles.emptyStateSubText}>
                  No {selectedBtn.toLowerCase()} data available for the selected period.{'\n'}Try changing the date range above.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
// Helper function to get the appropriate icon for each category
const getCategoryIcon = (category, type) => {
  const iconMap = {
    Bills: 'receipt',
    Education: 'school',
    Entertainment: 'movie',
    Food: 'food',
    Health: 'hospital',
    Shopping: 'cart',
    Travel: 'bus',
    Salary: 'cash',
    Bonus: 'cash',
    Gift: 'gift',
    Others: type === 'income' ? 'cash' : 'cash-remove',
  };
  return iconMap[category] || (type === 'income' ? 'cash' : 'cash-remove');
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollContainer: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
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
  filterSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  filterScrollView: {
    flexGrow: 0,
  },
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
  dateInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInputText: {
    fontSize: 14,
    color: '#2C2C2C',
    marginLeft: 8,
    fontFamily: 'Lato-Regular',
    fontWeight: '500',
  },
  dateInputPlaceholder: {
    color: '#999',
  },
  dateSeparator: {
    marginHorizontal: 10,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'Lato-Regular',
  },
  cardSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  incomeCard: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  expenseCard: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
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
  cardIncomeAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: INCOME_COLOR,
    fontFamily: 'Lato-Bold',
  },
  cardExpenseAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: EXPENSE_COLOR,
    fontFamily: 'Lato-Bold',
  },
  statisticCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  statisticHeader: {
    padding: 20,
    paddingBottom: 10,
  },
  statisticHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  statisticHeaderSubText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
    marginTop: 4,
    fontFamily: 'Lato-Regular',
  },
  chartContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  selectedBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  selectedBarText: {
    fontSize: 14,
    color: '#2C2C2C',
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  buttonSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  incomeExpenseButton: {
    width: '48%',
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  selectedIncomeExpenseButton: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  incomeExpenseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    fontFamily: 'Lato-Bold',
  },
  selectedIncomeExpenseButtonText: {
    color: '#FFFFFF',
  },
  transactionsSection: {
    marginHorizontal: 20,
    marginBottom: 30,
  },
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
  transactionsList: {
  },
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
  transactionsCardInfo: {
    flex: 1,
  },
  transactionsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 4,
    fontFamily: 'Lato-Bold',
  },
  transactionsCardDate: {
    fontSize: 13,
    fontWeight: '400',
    color: '#888',
    fontFamily: 'Lato-Regular',
  },
  transactionsCardAmount: {
    alignItems: 'flex-end',
  },
  transactionsCardAmountIncomeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: INCOME_COLOR,
    fontFamily: 'Lato-Bold',
  },
  transactionsCardAmountExpenseText: {
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
  legendContainer: {
    width: '100%',
    marginTop: 16,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
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
});
export default StatisticScreen;
