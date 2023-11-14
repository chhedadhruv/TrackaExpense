import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation
} from 'react-native';
import React, {useState, useEffect} from 'react';
import {Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const AddOrRemoveExpense = ({navigation}) => {
  return (
    <>
    <ScrollView>
      <View style={styles.container}>
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
      </View>
    </ScrollView>
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
