import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation
} from 'react-native';
import React, {useState, useEffect, useCallback} from 'react';
import {Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

const AddOrRemoveExpense = ({navigation}) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [formattedDate, setFormattedDate] = useState('');

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

  useFocusEffect(
    useCallback(() => {
      getUser();
    }, []),
  );

  const toggleShowAll = () => {
    setShowAll(!showAll);
  };

  return (
    <>
    {/* <ScrollView style={{flex: 1}}> */}
      {/* <View style={styles.container}>
        <View style={styles.lastAdded}>
          <Text style={styles.lastAddedText}>Last Added</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.transactionsList}>
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
          </View>
      </View> */}
      <View style={styles.container}>
        <View style={styles.lastAdded}>
          <Text style={styles.lastAddedText}>Last Added</Text>
          <TouchableOpacity onPress={toggleShowAll}>
            <Text style={styles.seeAllText}>{showAll ? 'See Less' : 'See All'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
            style={styles.transactionsList}
            showsVerticalScrollIndicator={false} // Hide vertical scrollbar
          >
          {userData ? (
            <>
            {userData.transactions.length > 0 ? (
              <>
              {/* {userData.transactions.slice(0, showAll ? userData.transactions.length : 3).map((item, index) => ( */}
              {userData.transactions
              .sort((a, b) => b.createdAt - a.createdAt)
              .slice(0, showAll ? userData.transactions.length : 5)
              .map((item, index) => (
                <Card style={styles.transactionsCard} key={index} onPress={() =>
                  navigation.navigate('TransactionDetail', {
                    transaction: item,
                  })
                }>
                  <View style={styles.transactionsCardContent}>
                  <View style={styles.transactionsCardDetails}>
                    <View style={styles.transactionsCardIcon}>
                    {item.category === 'Bills' ? (
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
                              {item.category === 'Education' ? (
                                <MaterialCommunityIcons
                                  name="school"
                                  size={25}
                                  color="#CBD3EE"
                                />
                              ) : null}
                              {item.category === 'Entertainment' ? (
                                <MaterialCommunityIcons
                                  name="movie"
                                  size={25}
                                  color="#CBD3EE"
                                />
                              ) : null}
                              {item.category === 'Food' ? (
                                <MaterialCommunityIcons
                                  name="food"
                                  size={25}
                                  color="#CBD3EE"
                                />
                              ) : null}
                              {item.category === 'Health' ? (
                                <MaterialCommunityIcons
                                  name="hospital"
                                  size={25}
                                  color="#CBD3EE"
                                />
                              ) : null}
                              {item.category === 'Shopping' ? (
                                <MaterialCommunityIcons
                                  name="cart"
                                  size={25}
                                  color="#CBD3EE"
                                />
                              ) : null}
                              {item.category === 'Travel' ? (
                                <MaterialCommunityIcons
                                  name="bus"
                                  size={25}
                                  color="#CBD3EE"
                                />
                              ) : null}
                              {item.type === 'expense' && item.category === 'Others' ? (
                                <MaterialCommunityIcons
                                  name="cash-remove"
                                  size={25}
                                  color="#CBD3EE"
                                />
                              ) : null}
                              {item.category === 'Salary' ? (
                                <MaterialCommunityIcons
                                  name="cash"
                                  size={25}
                                  color="#CBD3EE"
                                />
                              ) : null}
                              {item.category === 'Bonus' ? (
                                <MaterialCommunityIcons
                                  name="cash"
                                  size={25}
                                  color="#CBD3EE"
                                />
                              ) : null}
                              {item.category === 'Gift' ? (
                                <MaterialCommunityIcons
                                  name="cash"
                                  size={25}
                                  color="#CBD3EE"
                                />
                              ) : null}
                              {item.type === 'income' && item.category === 'Others' ? (
                                <MaterialCommunityIcons
                                  name="cash"
                                  size={25}
                                  color="#CBD3EE"
                                />
                              ) : null}
                    </View>
                    <View style={{flexDirection: 'column', marginLeft: 5}}>
                      <Text style={styles.transactionsCardTitle}>
                        {item.title}
                      </Text>
                      <View style={styles.transactionsCardDateAndTime}>
                        <Text style={styles.transactionsCardDate}>{item.date}</Text>
                        <Text style={styles.transactionsCardTime}>{item.time}</Text>
                      </View>
                    </View>
                    </View>
                    <View style={styles.transactionsCardAmount}>
                      {/* <Text style={item.type === 'Income' ? styles.transactionsCardAmountIncomeText : styles.transactionsCardAmountExpenseText}>
                        {item.type === 'Income' ? '+$ ' : '-$ '}{item.amount}
                      </Text> */}
                      <Text style={item.type === 'income' ? styles.transactionsCardAmountIncomeText : styles.transactionsCardAmountExpenseText}>
                        {item.type === 'income' ? '+ ₹' : '- ₹'}{item.amount}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
              </>
            ) : (
              <View style={{alignItems: 'center', justifyContent: 'center', marginTop: 20}}>
                <Text style={{fontSize: 16, fontWeight: '500', color: '#3A3B3E'}}>No Transactions</Text>
              </View>
            )}
            </>
          ) : (
            <View style={{alignItems: 'center', justifyContent: 'center', marginTop: 20}}>
              <Text style={{fontSize: 16, fontWeight: '500', color: '#3A3B3E'}}>No Transactions</Text>
            </View>
          )}
          </ScrollView>
      </View>
    {/* </ScrollView> */}
     <View style={styles.buttonContainer}>
     <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('AddIncome')}>
       <Text style={styles.buttonText}>Add Income</Text>
     </TouchableOpacity>
     <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('AddExpense')}>
       <Text style={styles.buttonText}>Add Expense</Text>
     </TouchableOpacity>
   </View>
   </>
  )
}

export default AddOrRemoveExpense;

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    padding: 10,
    // backgroundColor: '#fff',
  },
  lastAdded: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  lastAddedText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A3B3E',
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#3A3B3E',
  },
  transactionsList: {
    marginTop: 10,
    marginBottom: 100,
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
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 15,
    backgroundColor: '#fff',
    position: 'absolute',
    bottom: 0,
    width: '100%',
  },
  // incomeButton: {
  //   width: '48%',
  //   height: 45,
  //   borderRadius: 24,
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   borderWidth: 1,
  //   borderColor: '#677CD2',
  // },
  // buttonIncomeText: {
  //   fontSize: 12,
  //   fontWeight: '600',
  //   color: '#677CD2',
  //   textTransform: 'uppercase',
  // },
  button: {
    width: '48%',
    height: 45,
    borderRadius: 24,
    backgroundColor: '#677CD2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
});
