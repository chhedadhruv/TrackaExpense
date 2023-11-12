import {View, Text, ScrollView, StyleSheet } from 'react-native';
import React, {useState, useEffect} from 'react';
import {Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const HomeScreen = () => {
  return (
    <ScrollView>
      <View style={styles.container}>
        {/* balance card which will contain total balance, income and expense such that all of them are in 1 column and balance is below total balance text and income and expense are in one row with their icon and their values below their text */}
        <Card style={styles.myCard}>
          <View style={styles.cardContent}>
            <Text style={styles.TitleText}>Total Balance</Text>
            <Text style={styles.BalanceText}>$ 4,000.00</Text>
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
                <Text style={styles.ValueText}>$ 2,000.00</Text>
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
                <Text style={styles.ValueText}>$ 1,000.00</Text>
              </View>
            </View>
          </View>
        </Card>
        {/* end of balance card */}
        {/* start of transactions list which will contain all transactions in a list with a see all button */}
        <View style={styles.transactions}>
          <View style={styles.transactionsHeader}>
            <Text style={styles.transactionsHeaderText}>Transactions</Text>
            <Text style={styles.transactionsHeaderSeeAll}>See All</Text>
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
      </View>
    </ScrollView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
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
