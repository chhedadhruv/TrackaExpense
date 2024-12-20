import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
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
  const [selectedRange, setSelectedRange] = useState('Daily');
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(null);
  const [items, setItems] = useState([
    {label: 'Daily', value: 'Daily'},
    {label: 'Monthly', value: 'Monthly'},
    {label: 'Yearly', value: 'Yearly'},
  ]);
  const [barData, setBarData] = useState([]);
  const [selectedBtn, setSelectedBtn] = useState('Income');
  const [timeRange, setTimeRange] = useState('7days'); // New state for time range
  const [timeRangeOpen, setTimeRangeOpen] = useState(false);
  const [timeRangeItems, setTimeRangeItems] = useState([
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

  const getGroupingInterval = (range) => {
    switch (range) {
      case '7days':
        return 'daily';
      case '30days':
        return 'daily';
      case '3months':
        return 'weekly';
      case '6months':
        return 'monthly';
      case 'year':
        return 'monthly';
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
        return d.toLocaleDateString();
      case 'weekly':
        const week = Math.ceil(d.getDate() / 7);
        return `Week ${week}, ${d.toLocaleString('default', {month: 'short'})}`;
      case 'monthly':
        return d.toLocaleString('default', {month: 'short', year: 'numeric'});
      default:
        return d.toLocaleDateString();
    }
  };

  const getUser = async () => {
    const currentUser = await firestore()
      .collection('users')
      .doc(auth().currentUser.uid)
      .collection('transactions')
      .get()
      .then(querySnapshot => {
        const transactions = [];
        querySnapshot.forEach(doc => {
          transactions.push(doc.data());
        });
        setUserData({transactions});
        setLoading(false);
      });
  };

  useEffect(() => {
    getUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      getUser();
    }, []),
  );

  const handleIncome = () => {
    if (userData && userData.transactions.length > 0) {
      let totalIncome = 0;

      userData.transactions.forEach(transaction => {
        if (transaction.type === 'income') {
          totalIncome += parseFloat(transaction.amount) || 0;
        }
      });

      setTotalIncome(totalIncome);
    } else {
      console.log('No transactions');
    }
  };

  const handleExpense = () => {
    if (userData && userData.transactions.length > 0) {
      let totalExpense = 0;

      userData.transactions.forEach(transaction => {
        if (transaction.type === 'expense') {
          totalExpense += parseFloat(transaction.amount) || 0;
        }
      });

      setTotalExpense(totalExpense);
    } else {
      console.log('No transactions');
    }
  };

  useEffect(() => {
    handleIncome();
    handleExpense();
  }, [userData]);

  const handleRangeChange = item => {
    setSelectedRange(item);
    setOpen(false);
    setValue(item);
    console.log('Selected Range', item);
  };

  const handleBarData = () => {
    if (userData && userData.transactions.length > 0) {
      const filteredTransactions = filterTransactionsByTimeRange(
        userData.transactions,
        timeRange
      );
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
      Object.entries(aggregatedData).forEach(([label, values]) => {
        if (values.income > 0) {
          barData.push({
            value: values.income,
            label,
            frontColor: '#677CD2',
            spacing: 2,
          });
        }
        if (values.expense > 0) {
          barData.push({
            value: values.expense,
            label: values.income > 0 ? '' : label,
            frontColor: '#E98852',
            spacing: 15,
          });
        }
      });

      // Sort data chronologically
      barData.sort((a, b) => new Date(a.label) - new Date(b.label));
      setBarData(barData);
    }
  };

  useEffect(() => {
    handleBarData();
  }, [userData, timeRange]);

  const handleBarPress = data => {
    setSelectedBar(data);
  };

  const handleBtnPress = btn => {
    setSelectedBtn(btn);
  };

  return (
    <ScrollView>
      <View style={styles.container}>
        <View style={styles.cardSection}>
          <Card style={styles.incomeCard}>
            <Card.Content>
              <View style={styles.cardContent}>
                <Text style={styles.cardText}>Total Income</Text>
                <Text style={styles.cardIncomeText}>₹ {totalIncome}</Text>
              </View>
            </Card.Content>
          </Card>
          <Card style={styles.expenseCard}>
            <Card.Content>
              <View style={styles.cardContent}>
                <Text style={styles.cardText}>Total Expense</Text>
                <Text style={styles.cardExpenseText}>₹ {totalExpense}</Text>
              </View>
            </Card.Content>
          </Card>
        </View>
        <View style={styles.statisticSection}>
          <View style={styles.statisticHeader}>
            <Text style={styles.statisticHeaderText}>Statistic</Text>
            <Text style={styles.statisticHeaderSubText}>
              {timeRange} statistics
            </Text>
          </View>
          <View style={styles.filterSection}>
          <DropDownPicker
            open={timeRangeOpen}
            value={timeRange}
            items={timeRangeItems}
            setOpen={setTimeRangeOpen}
            setValue={setTimeRange}
            setItems={setTimeRangeItems}
            style={styles.timeRangePicker}
            textStyle={styles.timeRangePickerText}
            placeholder="Select Time Range"
            containerStyle={styles.timeRangePickerContainer}
          />
        </View>
          <BarChart
            data={barData}
            height={220}
            barWidth={20}
            spacing={30}
            roundedTop
            xAxisThickness={0}
            yAxisThickness={0}
            yAxisTextStyle={{color: 'gray'}}
            xAxisLabelTextStyle={{color: 'gray'}}
            noOfSections={3}
            isAnimated
            onPress={handleBarPress}
            yAxisLabelFormatter={value => `₹${value}`}
            yAxisLabelWidth={50}
            yAxisLabelPrefix={'₹'}
          />
          {selectedBar && (
            <View style={styles.selectedBarContainer}>
              <Text style={styles.selectedBarText}>
                {selectedBar.frontColor === '#677CD2' ? 'Income' : 'Expense'}: ₹{' '}
                {selectedBar.value}
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
          {userData && userData.transactions.length > 0 ? (
            userData.transactions.map(transaction => {
              if (selectedBtn === 'Income') {
                if (transaction.type === 'income') {
                  return (
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
                            {transaction.category === 'Bills' ? (
                              <MaterialCommunityIcons
                                name="receipt"
                                size={25}
                                color="#CBD3EE"
                                style={{
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                              />
                            ) : null}
                            {transaction.category === 'Education' ? (
                              <MaterialCommunityIcons
                                name="school"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Entertainment' ? (
                              <MaterialCommunityIcons
                                name="movie"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Food' ? (
                              <MaterialCommunityIcons
                                name="food"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Health' ? (
                              <MaterialCommunityIcons
                                name="hospital"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Shopping' ? (
                              <MaterialCommunityIcons
                                name="cart"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Travel' ? (
                              <MaterialCommunityIcons
                                name="bus"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.type === 'expense' &&
                            transaction.category === 'Others' ? (
                              <MaterialCommunityIcons
                                name="cash-remove"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Salary' ? (
                              <MaterialCommunityIcons
                                name="cash"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Bonus' ? (
                              <MaterialCommunityIcons
                                name="cash"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Gift' ? (
                              <MaterialCommunityIcons
                                name="cash"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.type === 'income' &&
                            transaction.category === 'Others' ? (
                              <MaterialCommunityIcons
                                name="cash"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                          </View>
                          <View
                            style={{
                              flexDirection: 'column',
                              marginLeft: 5,
                            }}>
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
                          <Text style={styles.transactionsCardAmountIncomeText}>
                           + ₹{transaction.amount}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  );
                }
              } else {
                if (transaction.type === 'expense') {
                  return (
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
                            {transaction.category === 'Bills' ? (
                              <MaterialCommunityIcons
                                name="receipt"
                                size={25}
                                color="#CBD3EE"
                                style={{
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                }}
                              />
                            ) : null}
                            {transaction.category === 'Education' ? (
                              <MaterialCommunityIcons
                                name="school"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Entertainment' ? (
                              <MaterialCommunityIcons
                                name="movie"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Food' ? (
                              <MaterialCommunityIcons
                                name="food"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Health' ? (
                              <MaterialCommunityIcons
                                name="hospital"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Shopping' ? (
                              <MaterialCommunityIcons
                                name="cart"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Travel' ? (
                              <MaterialCommunityIcons
                                name="bus"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.type === 'expense' &&
                            transaction.category === 'Others' ? (
                              <MaterialCommunityIcons
                                name="cash-remove"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Salary' ? (
                              <MaterialCommunityIcons
                                name="cash"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Bonus' ? (
                              <MaterialCommunityIcons
                                name="cash"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.category === 'Gift' ? (
                              <MaterialCommunityIcons
                                name="cash"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                            {transaction.type === 'income' &&
                            transaction.category === 'Others' ? (
                              <MaterialCommunityIcons
                                name="cash"
                                size={25}
                                color="#CBD3EE"
                              />
                            ) : null}
                          </View>
                          <View
                            style={{
                              flexDirection: 'column',
                              marginLeft: 5,
                            }}>
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
                            style={styles.transactionsCardAmountExpenseText}>
                            - ₹{transaction.amount}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  );
                }
              }
            })
          ) : (
            <Text>No Transactions</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  cardSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  },
  statisticHeader: {
    flexDirection: 'column',
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
  statisticChart: {
    marginTop: 20,
    backgroundColor: '#fff',
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
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  notSelectedBtn: {
    width: '48%',
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginTop: 10,
  },
  transactionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginVertical: 5,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  transactionsCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#7A8EE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  transactionsCardImage: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  transactionsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  transactionsCardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionsCardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3A3B3E',
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
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  transactionsCardAmountIncomeText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#25B07F',
  },
  transactionsCardAmountExpenseText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#F64E4E',
  },
  filterSection: {
    marginTop: 20,
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
});

export default StatisticScreen;
