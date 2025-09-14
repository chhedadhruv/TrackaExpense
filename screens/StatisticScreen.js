import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import React, {useState, useEffect, useCallback} from 'react';
import {Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {BarChart} from 'react-native-gifted-charts';
import {useFocusEffect} from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import DropDownPicker from 'react-native-dropdown-picker';
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
  const [timeRangeOpen, setTimeRangeOpen] = useState(false);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [selectedBtn, setSelectedBtn] = useState('Income');
  const [timeRangeItems] = useState([
    {label: 'Last 7 Days', value: '7days'},
    {label: 'Last 30 Days', value: '30days'},
    {label: 'Last 3 Months', value: '3months'},
    {label: 'Last 6 Months', value: '6months'},
    {label: 'Last Year', value: 'year'},
    {label: 'All Time', value: 'all'},
  ]);
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
  const formatDateForGrouping = (date, interval) => {
    const d = new Date(date);
    switch (interval) {
      case 'daily':
        return d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        });
      case 'weekly':
        const week = Math.ceil(d.getDate() / 7);
        return `W${week}`;
      case 'monthly':
        return d.toLocaleString('default', {month: 'short'});
      default:
        return d.toLocaleDateString();
    }
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
  }, [userData, timeRange]);
  const [barData, setBarData] = useState([]);
  const handleBarData = useCallback(() => {
    if (!filteredTransactions?.length) return;
    const interval = getGroupingInterval(timeRange);
    let aggregatedData = {};
    filteredTransactions.forEach(transaction => {
      const groupKey = formatDateForGrouping(transaction.date, interval);
      const value = parseFloat(transaction.amount) || 0;
      if (!aggregatedData[groupKey]) {
        aggregatedData[groupKey] = {income: 0, expense: 0};
      }
      if (transaction.type === 'income') {
        aggregatedData[groupKey].income += value;
      } else {
        aggregatedData[groupKey].expense += value;
      }
    });
    const barData = [];
    const entries = Object.entries(aggregatedData);
    entries.sort((a, b) => new Date(a[0]) - new Date(b[0]));
    // Take only last 6 entries to prevent overcrowding
    const lastEntries = entries.slice(-6);
    lastEntries.forEach(([label, values]) => {
      // Add placeholder bar with zero height for centered label
      barData.push({
        value: 0,
        label,
        frontColor: 'transparent',
        spacing: 2,
        showLabel: true,
      });
      // Add income bar
      if (values.income > 0) {
        barData.push({
          value: values.income,
          label: '',
          frontColor: '#677CD2',
          spacing: 2,
        });
      }
      // Add expense bar
      if (values.expense > 0) {
        barData.push({
          value: values.expense,
          label: '',
          frontColor: '#E98852',
          spacing: 30,
        });
      }
    });
    setBarData(barData);
  }, [filteredTransactions, timeRange]);
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
    const item = timeRangeItems.find(item => item.value === timeRange);
    return item ? item.label : 'Selected Period';
  };
  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContainer}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.headerText}>Statistics</Text>
          <Text style={styles.subHeaderText}>Track your financial insights</Text>
        </View>
        {/* Time Range Picker */}
        <View style={styles.timeRangeSection}>
          <DropDownPicker
            open={timeRangeOpen}
            value={timeRange}
            items={timeRangeItems}
            setOpen={setTimeRangeOpen}
            setValue={setTimeRange}
            style={styles.timeRangePicker}
            textStyle={styles.timeRangePickerText}
            placeholder="Select Time Range"
            containerStyle={styles.timeRangePickerContainer}
            dropDownContainerStyle={styles.dropDownContainer}
          />
        </View>
        {/* Summary Cards */}
        <View style={styles.cardSection}>
          <Card style={styles.incomeCard}>
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
                ₹ {totalIncome.toLocaleString()}
              </Text>
            </View>
          </Card>
          <Card style={styles.expenseCard}>
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
                ₹ {totalExpense.toLocaleString()}
              </Text>
            </View>
          </Card>
        </View>
        {/* Statistics Chart Section */}
        <Card style={styles.statisticCard}>
          <View style={styles.statisticHeader}>
            <Text style={styles.statisticHeaderText}>Financial Overview</Text>
            <Text style={styles.statisticHeaderSubText}>
              {getTimeRangeLabel()}
            </Text>
          </View>
          <View style={styles.chartContainer}>
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
                fontSize: 11,
                textAlign: 'center',
                width: 60,
                marginTop: 15,
                fontFamily: 'Lato-Regular',
              }}
              noOfSections={3}
              isAnimated
              onPress={handleBarPress}
              yAxisLabelFormatter={value => `₹${value}`}
              yAxisLabelWidth={50}
              yAxisLabelPrefix={'₹'}
              width={Dimensions.get('window').width - 80}
              xAxisLabelsHeight={40}
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
            {selectedBar && (
              <View style={styles.selectedBarContainer}>
                <Text style={styles.selectedBarText}>
                  {selectedBar.frontColor === '#677CD2' ? 'Income' : 'Expense'}: ₹{' '}
                  {selectedBar.value.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        </Card>
        {/* Filter Buttons */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedBtn === 'Income' && styles.selectedFilterButton
            ]}
            onPress={() => handleBtnPress('Income')}>
            <Text
              style={[
                styles.filterButtonText,
                selectedBtn === 'Income' && styles.selectedFilterButtonText
              ]}>
              Income
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              selectedBtn === 'Expense' && styles.selectedFilterButton
            ]}
            onPress={() => handleBtnPress('Expense')}>
            <Text
              style={[
                styles.filterButtonText,
                selectedBtn === 'Expense' && styles.selectedFilterButtonText
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
                          {transaction.type === 'income' ? '+ ₹' : '- ₹'}
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
                  No {selectedBtn.toLowerCase()} data available for the selected period
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
  timeRangeSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    zIndex: 1000,
  },
  timeRangePicker: {
    borderRadius: 16,
    borderColor: '#E8EBF7',
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  timeRangePickerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  timeRangePickerContainer: {
    marginBottom: 10,
  },
  dropDownContainer: {
    borderColor: '#E8EBF7',
    backgroundColor: '#FFFFFF',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 20,
    zIndex: 1,
  },
  incomeCard: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  expenseCard: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    zIndex: 1,
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
    zIndex: 1,
  },
  filterButton: {
    width: '48%',
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EBF7',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  selectedFilterButton: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    fontFamily: 'Lato-Bold',
  },
  selectedFilterButtonText: {
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
    zIndex: 1,
  },
  transactionsCard: {
    marginVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
});
export default StatisticScreen;
