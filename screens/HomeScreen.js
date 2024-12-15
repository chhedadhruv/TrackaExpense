import {View, Text, ScrollView, StyleSheet} from 'react-native';
import React, {useState, useEffect, useCallback} from 'react';
import {ActivityIndicator, Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useFocusEffect} from '@react-navigation/native';

const HomeScreen = ({navigation}) => {
  const [userData, setUserData] = useState(null);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState(null);

  const currentUser = auth().currentUser;

  const getUserData = async () => {
    setLoading(true);
    try {
      const documentSnapshot = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();

      if (documentSnapshot.exists) {
        setUserData(documentSnapshot.data());
      } else {
        setError('User data not found');
      }
    } catch (error) {
      setError('Error fetching user data');
    } finally {
      setLoading(false);
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
        const createdAt = data.createdAt?.toDate
          ? data.createdAt.toDate()
          : new Date();
        return {id: document.id, ...data, createdAt};
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

  const renderTransactionDate = date => {
    return date instanceof Date ? date.toLocaleDateString() : '';
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
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.container}>
        <Card style={styles.myCard}>
          <View style={styles.cardContent}>
            <Text style={styles.TitleText}>Total Balance</Text>
            <Text style={styles.BalanceText}>
              ₹ {userData.balance ? userData.balance.toLocaleString() : 0}
            </Text>
          </View>
          <View style={styles.dataCard}>
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
        <View style={styles.transactions}>
          <View style={styles.transactionsHeader}>
            <Text style={styles.transactionsHeaderText}>Transactions</Text>
            <Text
              style={styles.transactionsHeaderSeeAll}
              onPress={toggleShowAll}>
              {showAll ? 'Hide' : 'See All'}
            </Text>
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
                              color="#CBD3EE"
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
                              color="#CBD3EE"
                            />
                          )}
                          {transaction.category === 'Entertainment' && (
                            <MaterialCommunityIcons
                              name="movie"
                              size={25}
                              color="#CBD3EE"
                            />
                          )}
                          {transaction.category === 'Food' && (
                            <MaterialCommunityIcons
                              name="food"
                              size={25}
                              color="#CBD3EE"
                            />
                          )}
                          {transaction.category === 'Health' && (
                            <MaterialCommunityIcons
                              name="hospital"
                              size={25}
                              color="#CBD3EE"
                            />
                          )}
                          {transaction.category === 'Shopping' && (
                            <MaterialCommunityIcons
                              name="cart"
                              size={25}
                              color="#CBD3EE"
                            />
                          )}
                          {transaction.category === 'Travel' && (
                            <MaterialCommunityIcons
                              name="bus"
                              size={25}
                              color="#CBD3EE"
                            />
                          )}
                          {transaction.type === 'expense' &&
                            transaction.category === 'Others' && (
                              <MaterialCommunityIcons
                                name="cash-remove"
                                size={25}
                                color="#CBD3EE"
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
                              color="#CBD3EE"
                            />
                          )}
                        </View>
                        <View style={{flexDirection: 'column', marginLeft: 5}}>
                          <Text style={styles.transactionsCardTitle}>
                            {transaction.title}
                          </Text>
                          <View style={styles.transactionsCardDateAndTime}>
                            <Text style={styles.transactionsCardDate}>
                              {renderTransactionDate(transaction.createdAt)}
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
              <Text>No transactions available.</Text>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  container: {
    paddingHorizontal: 10,
  },
  myCard: {
    margin: 5,
    padding: 20,
    backgroundColor: '#677CD2',
  },
  dataCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  cardContent: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  cardContentWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  },
  BalanceText: {
    fontSize: 26,
    fontWeight: '500',
    color: '#fff',
  },
  ValueText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
  },
  transactions: {
    marginTop: 20,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  transactionsHeaderText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A3B3E',
  },
  transactionsHeaderSeeAll: {
    fontSize: 12,
    fontWeight: '400',
    color: '#3A3B3E',
  },
  transactionsList: {
    marginTop: 10,
    marginBottom: 30,
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
});

export default HomeScreen;
