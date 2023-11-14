import {View, Text, ScrollView, StyleSheet} from 'react-native';
import React, {useState, useEffect, useCallback} from 'react';
import {ActivityIndicator, Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useFocusEffect} from '@react-navigation/native';

const HomeScreen = () => {
  const [userData, setUserData] = useState(null);
  const [date, setDate] = useState();
  const [income, setIncome] = useState([]);
  const [expense, setExpense] = useState([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const getUser = async () => {
    const currentUser = await firestore()
      .collection('users')
      .doc(auth().currentUser.uid)
      .get()
      .then(documentSnapshot => {
        if (documentSnapshot.exists) {
          setUserData(documentSnapshot.data());
          console.log('User Data', documentSnapshot.data());
          setLoading(false);
        }
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

  // const handleExpense = () => {
  //   if (userData && userData.transactions.length > 0) {
  //     const expense = userData.transactions.filter((item) => {
  //       return item.type === 'expense';
  //     });
  //     setExpense(expense);
  //   }
  // }

  // get expense from transactions array by querying the database
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

  const handleTransactions = () => {
    if (userData && userData.transactions.length > 0) {
      const transactions = userData.transactions.sort((a, b) => {
        return new Date(b.createdAt.toDate()) - new Date(a.createdAt.toDate());
      });
      setTransactions(transactions);
    }
  };

  useEffect(() => {
    handleIncome();
    handleExpense();
    handleTransactions();
  }, [userData]);

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

  return (
    <ScrollView>
      <View style={styles.container}>
        <Card style={styles.myCard}>
          <View style={styles.cardContent}>
            <Text style={styles.TitleText}>Total Balance</Text>
            {/* <Text style={styles.BalanceText}>₹ {userData.balance}</Text> */}
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
                {/* <Text style={styles.ValueText}>₹ {userData.income.length > 0 ? userData.income.reduce((a, b) => a + b) : 0}</Text> */}
                {/* <Text style={styles.ValueText}>₹ {income.length > 0 ? income.reduce((a, b) => a + b.amount, 0) : 0}</Text> */}
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
                {/* <Text style={styles.ValueText}>₹ {userData.expense.length > 0 ? userData.expense.reduce((a, b) => a + b) : 0}</Text> */}
                <Text style={styles.ValueText}>
                  ₹ {totalExpense.toLocaleString()}
                </Text>
                {/* <Text style={styles.ValueText}>₹ 0</Text> */}
              </View>
            </View>
          </View>
        </Card>
        <View style={styles.transactions}>
          <View style={styles.transactionsHeader}>
            <Text style={styles.transactionsHeaderText}>Transactions</Text>
            {/* <Text style={styles.transactionsHeaderSeeAll}>See All</Text> */}
            <Text
              style={styles.transactionsHeaderSeeAll}
              onPress={toggleShowAll}>
              {showAll ? 'Hide' : 'See All'}
            </Text>
          </View>
          {/* <View style={styles.transactionsList}>
            <Card style={styles.transactionsCard}>
              <View style={styles.transactionsCardContent}>
              <View style={styles.transactionsCardDetails}>
                <View style={styles.transactionsCardIcon}>
                  <MaterialCommunityIcons
                    name="food"
                    size={25}
                    color="#CBD3EE"
                  />
                </View>
                <View style={{flexDirection: 'column', marginLeft: 5}}>
                  <Text style={styles.transactionsCardTitle}>
                    Food and Drink
                  </Text>
                  <View style={styles.transactionsCardDateAndTime}>
                    <Text style={styles.transactionsCardDate}>Today</Text>
                    <Text style={styles.transactionsCardTime}>12:00 PM</Text>
                  </View>
                </View>
                </View>
                <View style={styles.transactionsCardAmount}>
                  <Text style={styles.transactionsCardAmountExpenseText}>
                    -$ 100.00
                  </Text>
                </View>
              </View>
            </Card>
            <Card style={styles.transactionsCard}>
              <View style={styles.transactionsCardContent}>
              <View style={styles.transactionsCardDetails}>
                <View style={styles.transactionsCardIcon}>
                  <MaterialCommunityIcons
                    name="food"
                    size={25}
                    color="#CBD3EE"
                  />
                </View>
                <View style={{flexDirection: 'column', marginLeft: 5}}>
                  <Text style={styles.transactionsCardTitle}>
                    Food and Drink
                  </Text>
                  <View style={styles.transactionsCardDateAndTime}>
                    <Text style={styles.transactionsCardDate}>Today</Text>
                    <Text style={styles.transactionsCardTime}>12:00 PM</Text>
                  </View>
                </View>
                </View>
                <View style={styles.transactionsCardAmount}>
                  <Text style={styles.transactionsCardAmountExpenseText}>
                    -$ 100.00
                  </Text>
                </View>
              </View>
            </Card>
            <Card style={styles.transactionsCard}>
              <View style={styles.transactionsCardContent}>
              <View style={styles.transactionsCardDetails}>
                <View style={styles.transactionsCardIcon}>
                  <MaterialCommunityIcons
                    name="cash"
                    size={25}
                    color="#CBD3EE"
                  />
                </View>
                <View style={{flexDirection: 'column', marginLeft: 5}}>
                  <Text style={styles.transactionsCardTitle}>
                    Transfer and Refund
                  </Text>
                  <View style={styles.transactionsCardDateAndTime}>
                    <Text style={styles.transactionsCardDate}>Today</Text>
                    <Text style={styles.transactionsCardTime}>12:00 PM</Text>
                  </View>
                </View>
                </View>
                <View style={styles.transactionsCardAmount}>
                  <Text style={styles.transactionsCardAmountIncomeText}>
                    +$ 100.00
                  </Text>
                </View>
              </View>
            </Card>
            <Card style={styles.transactionsCard}>
              <View style={styles.transactionsCardContent}>
              <View style={styles.transactionsCardDetails}>
                <View style={styles.transactionsCardIcon}>
                  <MaterialCommunityIcons
                    name="cart"
                    size={25}
                    color="#CBD3EE"
                  />
                </View>
                <View style={{flexDirection: 'column', marginLeft: 5}}>
                  <Text style={styles.transactionsCardTitle}>
                    Shopping
                  </Text>
                  <View style={styles.transactionsCardDateAndTime}>
                    <Text style={styles.transactionsCardDate}>Today</Text>
                    <Text style={styles.transactionsCardTime}>12:00 PM</Text>
                  </View>
                </View>
                </View>
                <View style={styles.transactionsCardAmount}>
                  <Text style={styles.transactionsCardAmountExpenseText}>
                    -$ 100.00
                  </Text>
                </View>
              </View>
            </Card>
          </View> */}
          <ScrollView>
            <View style={styles.transactionsList}>
              {transactions.length > 0 ? (
                transactions
                  .slice(0, showAll ? transactions.length : 4)
                  .map(transaction => {
                    return (
                      <Card
                        style={styles.transactionsCard}
                        key={transaction.id}>
                        <View style={styles.transactionsCardContent}>
                          <View style={styles.transactionsCardDetails}>
                            <View style={styles.transactionsCardIcon}>
                              {/* <MaterialCommunityIcons
                          name={transaction.category.icon}
                          size={25}
                          color="#CBD3EE"
                        /> */}
                              {/* <MaterialCommunityIcons
                          name={transaction.category.icon}
                          size={25}
                          color="#CBD3EE"
                        /> */}
                              {/* Add a condition to add the icon according to the category */}
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
                              {transaction.type === 'expense' && transaction.category === 'Others' ? (
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
                              {transaction.type === 'income' && transaction.category === 'Others' ? (
                                <MaterialCommunityIcons
                                  name="cash"
                                  size={25}
                                  color="#CBD3EE"
                                />
                              ) : null}
                            </View>
                            <View
                              style={{flexDirection: 'column', marginLeft: 5}}>
                              <Text style={styles.transactionsCardTitle}>
                                {transaction.category}
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
                              {parseInt(
                                transaction.amount,
                                10,
                              ).toLocaleString()}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    );
                  })
              ) : (
                <View
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                  <Text>No transactions</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </ScrollView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  container: {
    // flex: 1,
    // backgroundColor: '#FAFAFA',
    // paddingVertical: 50,
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
    // alignItems: 'center',
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
  },
  transactionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'space-between',
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
    // alignItems: 'flex-start',
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
