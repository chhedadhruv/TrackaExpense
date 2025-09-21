import {View, Text, ScrollView, StyleSheet, TouchableOpacity} from 'react-native';
import React, {useState, useEffect, useCallback} from 'react';
import {ActivityIndicator, Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useFocusEffect} from '@react-navigation/native';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';

const HomeScreen = ({navigation}) => {
  const [userData, setUserData] = useState(null);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState(null);

  const currentUser = auth().currentUser;

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
      } else {
        // If user data doesn't exist, wait a bit and retry (for Google Sign-In timing issues)
        if (retryCount < 3) {
          console.log(`User data not found, retrying... (${retryCount + 1}/3)`);
          setTimeout(() => {
            getUserData(retryCount + 1);
          }, 1000 * (retryCount + 1)); // Exponential backoff
        } else {
          setError('User data not found. Please try signing in again.');
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (retryCount < 2) {
        setTimeout(() => {
          getUserData(retryCount + 1);
        }, 1000 * (retryCount + 1));
      } else {
        setError('Error fetching user data. Please check your connection and try again.');
      }
    } finally {
      if (retryCount === 0) {
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
    if (transactions.length > 0) {
      const income = transactions.reduce((sum, transaction) => {
        return transaction.type === 'income'
          ? sum + (parseFloat(transaction.amount) || 0)
          : sum;
      }, 0);
      setTotalIncome(income);
    }
  };

  const handleExpense = () => {
    if (transactions.length > 0) {
      const expense = transactions.reduce((sum, transaction) => {
        return transaction.type === 'expense'
          ? sum + (parseFloat(transaction.amount) || 0)
          : sum;
      }, 0);
      setTotalExpense(expense);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      getUserData();
      fetchTransactions();
    }, 1000);
  }, []);

  useEffect(() => {
    handleIncome();
    handleExpense();
  }, [transactions]);

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

        {/* Data Card */}
        <Card style={styles.dataCard}>
          <View style={styles.dataCardRow}>
            <View style={styles.cardContentWithIcon}>
              <View style={styles.Icon}>
                <MaterialCommunityIcons
                  name="arrow-down"
                  size={25}
                  color="#CBD3EE"
                />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.TitleText}>Income</Text>
                <Text style={styles.ValueText}>
                  ₹ {totalIncome.toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={styles.cardContentWithIcon}>
              <View style={styles.Icon}>
                <MaterialCommunityIcons
                  name="arrow-up"
                  size={25}
                  color="#CBD3EE"
                />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.TitleText}>Expense</Text>
                <Text style={styles.ValueText}>
                  ₹ {totalExpense.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        </Card>
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
            {transactions.length > 0 ? (
              transactions
                .slice(0, showAll ? transactions.length : 4)
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
  dataCard: {
    marginHorizontal: 20,
    backgroundColor: PRIMARY_COLOR,
    padding: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  dataCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardContent: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  cardContentWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  Icon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: '#7A8EE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  TitleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#CED6EC',
    marginBottom: 5,
    fontFamily: 'Lato-Regular',
  },
  ValueText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Lato-Bold',
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
