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
      console.error('Error fetching user data:', error);
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
    <ScrollView>
      <View style={styles.container}>
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
          />
        </View>

        <View style={styles.cardSection}>
          <Card style={styles.incomeCard}>
            <Card.Content>
              <View style={styles.cardContent}>
                <Text style={styles.cardText}>Total Income</Text>
                <Text style={styles.cardIncomeText}>
                  ₹ {totalIncome.toFixed(2)}
                </Text>
              </View>
            </Card.Content>
          </Card>
          <Card style={styles.expenseCard}>
            <Card.Content>
              <View style={styles.cardContent}>
                <Text style={styles.cardText}>Total Expense</Text>
                <Text style={styles.cardExpenseText}>
                  ₹ {totalExpense.toFixed(2)}
                </Text>
              </View>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.statisticSection}>
          <View style={styles.statisticHeader}>
            <Text style={styles.statisticHeaderText}>Statistics</Text>
            <Text style={styles.statisticHeaderSubText}>
              {getTimeRangeLabel()}
            </Text>
          </View>

          <BarChart
            data={barData}
            height={220}
            barWidth={15}
            spacing={2}
            roundedTop
            xAxisThickness={0}
            yAxisThickness={0}
            yAxisTextStyle={{color: 'gray'}}
            xAxisLabelTextStyle={{
              color: 'gray',
              fontSize: 11,
              textAlign: 'center',
              width: 60,
              marginTop: 15,
            }}
            noOfSections={3}
            isAnimated
            onPress={handleBarPress}
            yAxisLabelFormatter={value => `₹${value}`}
            yAxisLabelWidth={50}
            yAxisLabelPrefix={'₹'}
            width={Dimensions.get('window').width - 40}
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

        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={
              selectedBtn === 'Income'
                ? styles.selectedBtn
                : styles.notSelectedBtn
            }
            onPress={() => handleBtnPress('Income')}>
            <Text
              style={
                selectedBtn === 'Income'
                  ? styles.selectedBtnText
                  : styles.notSelectedBtnText
              }>
              Income
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={
              selectedBtn === 'Expense'
                ? styles.selectedBtn
                : styles.notSelectedBtn
            }
            onPress={() => handleBtnPress('Expense')}>
            <Text
              style={
                selectedBtn === 'Expense'
                  ? styles.selectedBtnText
                  : styles.notSelectedBtnText
              }>
              Expense
            </Text>
          </TouchableOpacity>
        </View>

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
                          size={25}
                          color="#CBD3EE"
                        />
                      </View>
                      <View style={styles.transactionsCardInfo}>
                        <Text style={styles.transactionsCardTitle}>
                          {transaction.title}
                        </Text>
                        <View style={styles.transactionsCardDateAndTime}>
                          <Text style={styles.transactionsCardDate}>
                            {transaction.date}
                          </Text>
                          <Text style={styles.transactionsCardTime}>
                            {transaction.time}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.transactionsCardAmount}>
                      <Text
                        style={
                          transaction.type === 'income'
                            ? styles.transactionsCardAmountIncomeText
                            : styles.transactionsCardAmountExpenseText
                        }>
                        {transaction.type === 'income' ? '+' : '-'} ₹
                        {transaction.amount}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
          ) : (
            <Text style={styles.noTransactionsText}>No Transactions</Text>
          )}
        </View>
      </View>
    </ScrollView>
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
    padding: 20,
  },
  timeRangeSection: {
    marginBottom: 20,
    zIndex: 1000,
  },
  timeRangePicker: {
    borderRadius: 12,
    borderColor: '#E5E5E5',
  },
  timeRangePickerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#959698',
  },
  timeRangePickerContainer: {
    marginBottom: 10,
  },
  cardSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  incomeCard: {
    width: '48%',
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E6EBFE',
  },
  expenseCard: {
    width: '48%',
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F6E5DC',
  },
  cardContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '100%',
  },
  cardText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#AAB1CF',
  },
  cardIncomeText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#677CD2',
  },
  cardExpenseText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#E98852',
  },
  statisticSection: {
    marginTop: 20,
    paddingHorizontal: 0,
    zIndex: 1,
  },
  statisticHeader: {
    flexDirection: 'column',
    marginBottom: 20,
  },
  statisticHeaderText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A3B3E',
  },
  statisticHeaderSubText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#959698',
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
    fontSize: 16,
    color: '#333',
  },
  buttonSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  notSelectedBtn: {
    width: '48%',
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  notSelectedBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#959698',
  },
  selectedBtn: {
    width: '48%',
    height: 40,
    borderRadius: 12,
    backgroundColor: '#677CD2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  transactionsList: {
    marginTop: 20,
    zIndex: 1,
  },
  transactionsCard: {
    marginVertical: 5,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  transactionsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
  },
  transactionsCardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionsCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#7A8EE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionsCardInfo: {
    marginLeft: 10,
    flex: 1,
  },
  transactionsCardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3A3B3E',
    marginBottom: 4,
  },
  transactionsCardDateAndTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionsCardDate: {
    fontSize: 12,
    fontWeight: '400',
    color: '#959698',
  },
  transactionsCardTime: {
    fontSize: 12,
    fontWeight: '400',
    color: '#959698',
    marginLeft: 10,
  },
  transactionsCardAmount: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  transactionsCardAmountIncomeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#25B07F',
  },
  transactionsCardAmountExpenseText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#F64E4E',
  },
  noTransactionsText: {
    textAlign: 'center',
    color: '#959698',
    marginTop: 20,
    fontSize: 14,
  },
});

export default StatisticScreen;
