import {View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform} from 'react-native';
import React, {useState, useEffect, useCallback} from 'react';
import {ActivityIndicator, Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useFocusEffect} from '@react-navigation/native';
import moment from 'moment';
import {DatePickerModal} from 'react-native-paper-dates';
import {useCurrency} from '../utils/CurrencyUtil';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const INCOME_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';

const HomeScreen = ({navigation}) => {
  const {currency, formatAmount} = useCurrency();
  const [userData, setUserData] = useState(null);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('7days');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);

  const currentUser = auth().currentUser;

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

  const getUserData = async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    
    try {
      if (!currentUser || !currentUser.uid) {
        setError('No authenticated user found');
        setLoading(false);
        return;
      }

      const documentSnapshot = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();

      if (documentSnapshot.exists) {
        setUserData(documentSnapshot.data());
        setError(null);
        setLoading(false);
      } else {
        // If user data doesn't exist, wait a bit and retry (for social sign-in timing issues)
        if (retryCount < 2) {
          console.log(`User data not found, retrying... (${retryCount + 1}/2)`);
          setTimeout(() => {
            getUserData(retryCount + 1);
          }, 2000 * (retryCount + 1)); // Longer wait times
        } else {
          setError('User data not found. Please try signing in again.');
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (retryCount < 1) {
        setTimeout(() => {
          getUserData(retryCount + 1);
        }, 2000);
      } else {
        setError('Error fetching user data. Please check your connection and try again.');
        setLoading(false);
      }
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const transactionsSnapshot = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('transactions')
        .get();

      const transactionsArray = transactionsSnapshot.docs.map(document => {
        const data = document.data();
        return {
          id: document.id,
          ...data,
        };
      });

      const sortedTransactions = transactionsArray.sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      setTransactions(sortedTransactions);
    } catch (error) {
      setError('Error fetching transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleIncome = () => {
    if (filteredTransactions.length > 0) {
      const income = filteredTransactions.reduce((sum, transaction) => {
        return transaction.type === 'income'
          ? sum + (parseFloat(transaction.amount) || 0)
          : sum;
      }, 0);
      setTotalIncome(income);
    } else {
      setTotalIncome(0);
    }
  };

  const handleExpense = () => {
    if (filteredTransactions.length > 0) {
      const expense = filteredTransactions.reduce((sum, transaction) => {
        return transaction.type === 'expense'
          ? sum + (parseFloat(transaction.amount) || 0)
          : sum;
      }, 0);
      setTotalExpense(expense);
    } else {
      setTotalExpense(0);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      getUserData();
      fetchTransactions();
    }, 1000);
  }, []);

  useEffect(() => {
    if (transactions.length > 0) {
      const filtered = filterTransactionsByTimeRange(transactions, timeRange);
      setFilteredTransactions(filtered);
    }
  }, [transactions, timeRange, customStartDate, customEndDate]);

  useEffect(() => {
    handleIncome();
    handleExpense();
  }, [filteredTransactions]);

  useFocusEffect(
    useCallback(() => {
      getUserData();
      fetchTransactions();
    }, []),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      getUserData();
      fetchTransactions();
    });

    return unsubscribe;
  }, [navigation]);

  // Add real-time listener for user data changes
  useEffect(() => {
    if (!currentUser || !currentUser.uid) return;

    const unsubscribe = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            setUserData(doc.data());
            setError(null);
            setLoading(false);
          }
        },
        (error) => {
          console.error('Error listening to user data:', error);
          setError('Error fetching user data. Please check your connection and try again.');
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, [currentUser]);

  const toggleShowAll = () => {
    setShowAll(!showAll);
  };

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#677CD2" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#F64E4E" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => getUserData()}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContainer}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.greetingText}>Hello, {userData?.name || 'User'}!</Text>
          <Text style={styles.subGreetingText}>Track your expenses today</Text>
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
                {formatAmount(totalIncome)}
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
                {formatAmount(totalExpense)}
              </Text>
            </View>
          </Card>
        </View>

        {/* Quick Actions Section */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity
              style={[styles.quickActionButton, styles.addIncomeButton]}
              onPress={() => navigation.navigate('AddIncome')}>
              <MaterialCommunityIcons
                name="cash-plus"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.quickActionText}>Add Income</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.quickActionButton, styles.addExpenseButton]}
              onPress={() => navigation.navigate('AddExpense')}>
              <MaterialCommunityIcons
                name="cash-minus"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.quickActionText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transactions Section */}
        <View style={styles.transactionsSection}>
          <View style={styles.transactionsHeader}>
            <View>
              <Text style={styles.transactionsHeaderText}>Recent Transactions</Text>
              <Text style={styles.transactionsSubHeaderText}>
                {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Transaction')}
              style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>See All</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={PRIMARY_COLOR}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.transactionsList}>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map(transaction => (
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
                          {transaction.category === 'Bills' && (
                            <MaterialCommunityIcons
                              name="receipt"
                              size={25}
                              color="#677CD2"
                              style={{
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            />
                          )}
                          {transaction.category === 'Education' && (
                            <MaterialCommunityIcons
                              name="school"
                              size={25}
                              color="#677CD2"
                            />
                          )}
                          {transaction.category === 'Entertainment' && (
                            <MaterialCommunityIcons
                              name="movie"
                              size={25}
                              color="#677CD2"
                            />
                          )}
                          {transaction.category === 'Food' && (
                            <MaterialCommunityIcons
                              name="food"
                              size={25}
                              color="#677CD2"
                            />
                          )}
                          {transaction.category === 'Health' && (
                            <MaterialCommunityIcons
                              name="hospital"
                              size={25}
                              color="#677CD2"
                            />
                          )}
                          {transaction.category === 'Shopping' && (
                            <MaterialCommunityIcons
                              name="cart"
                              size={25}
                              color="#677CD2"
                            />
                          )}
                          {transaction.category === 'Travel' && (
                            <MaterialCommunityIcons
                              name="bus"
                              size={25}
                              color="#677CD2"
                            />
                          )}
                          {transaction.type === 'expense' &&
                            transaction.category === 'Others' && (
                              <MaterialCommunityIcons
                                name="cash-remove"
                                size={25}
                                color="#677CD2"
                              />
                            )}
                          {(transaction.category === 'Salary' ||
                            transaction.category === 'Bonus' ||
                            transaction.category === 'Gift' ||
                            (transaction.type === 'income' &&
                              transaction.category === 'Others')) && (
                            <MaterialCommunityIcons
                              name="cash"
                              size={25}
                              color="#677CD2"
                            />
                          )}
                        </View>
                        <View style={{flexDirection: 'column', marginLeft: 5}}>
                          <Text style={styles.transactionsCardTitle} numberOfLines={1}>
                            {transaction.title.length > 25
                              ? transaction.title.slice(0, 25) + '...'
                              : transaction.title}
                          </Text>
                          <View style={styles.transactionsCardDateAndTime}>
                            <Text style={styles.transactionsCardDate}>
                              {transaction.date}
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
                          {transaction.type === 'income' ? '+ ' : '- '}
                          {formatAmount(transaction.amount)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="receipt-text-outline" size={48} color="#CBD3EE" />
                {transactions.length === 0 ? (
                  <>
                    <Text style={styles.emptyStateText}>No transactions yet</Text>
                    <Text style={styles.emptyStateSubText}>Add your first transaction to get started</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyStateText}>No transactions in this time range</Text>
                    <Text style={styles.emptyStateSubText}>Try changing the time range above to see older transactions</Text>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND_COLOR,
  },
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
  greetingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  subGreetingText: {
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
    // elevation: 3,
    // shadowColor: '#ccc',
    // shadowOffset: {
    //   width: 0,
    //   height: 2,
    // },
    // shadowOpacity: 0.01,
    // shadowRadius: 4,
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
  quickActionsSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  quickActionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 15,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  quickActionButton: {
    flex: 0.48,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // button style (no shadows)
  },
  addIncomeButton: {
    backgroundColor: '#25B07F',
  },
  addExpenseButton: {
    backgroundColor: '#F64E4E',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Lato-Bold',
    marginLeft: 8,
  },
  transactionsSection: {
    marginTop: 10,
    paddingHorizontal: 20,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
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
    fontFamily: 'Lato-Regular',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(103, 124, 210, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginRight: 4,
    fontFamily: 'Lato-Bold',
  },
  transactionsList: {
    marginBottom: 30,
  },
  transactionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    marginVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  transactionsCardDateAndTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  transactionsCardDate: {
    fontSize: 13,
    fontWeight: '400',
    color: '#888',
    fontFamily: 'Lato-Regular',
  },
  transactionsCardTime: {
    fontSize: 13,
    fontWeight: '400',
    color: '#888',
    marginLeft: 10,
    fontFamily: 'Lato-Regular',
  },
  transactionsCardAmount: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  transactionsCardAmountIncomeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#25B07F',
    fontFamily: 'Lato-Bold',
  },
  transactionsCardAmountExpenseText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F64E4E',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND_COLOR,
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#F64E4E',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
    marginTop: 15,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
});

export default HomeScreen;
