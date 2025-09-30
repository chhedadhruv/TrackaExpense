import {View, Text, ScrollView, StyleSheet, TouchableOpacity} from 'react-native';
import React, {useState, useEffect, useCallback} from 'react';
import {ActivityIndicator, Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useFocusEffect} from '@react-navigation/native';
import DropDownPicker from 'react-native-dropdown-picker';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const INCOME_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';

const HomeScreen = ({navigation}) => {
  const [userData, setUserData] = useState(null);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('7days');
  const [timeRangeOpen, setTimeRangeOpen] = useState(false);
  const [timeRangeItems] = useState([
    {label: 'Last 7 Days', value: '7days'},
    {label: 'Last 30 Days', value: '30days'},
    {label: 'Last 3 Months', value: '3months'},
    {label: 'Last 6 Months', value: '6months'},
    {label: 'Last Year', value: 'year'},
    {label: 'All Time', value: 'all'},
  ]);

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
  }, [transactions, timeRange]);

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
            searchable={true}
            searchPlaceholder="Search time ranges..."
            listMode="MODAL"
            modalTitle="Select Time Range"
            modalAnimationType="slide"
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
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
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
              filteredTransactions
                .slice(0, showAll ? filteredTransactions.length : 4)
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
                          {transaction.type === 'income' ? '+ ₹' : '- ₹'}
                          {parseInt(transaction.amount, 10).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="receipt-text-outline" size={48} color="#CBD3EE" />
                <Text style={styles.emptyStateText}>No transactions yet</Text>
                <Text style={styles.emptyStateSubText}>Add your first transaction to get started</Text>
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
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
