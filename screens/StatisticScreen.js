import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import React, {useState, useEffect} from 'react';
import {Card, Button} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {BarChart} from 'react-native-gifted-charts';

const StatisticScreen = () => {
  const [selectedBar, setSelectedBar] = useState(null);

  const barData = [
    {
      value: 40,
      label: 'W1',
      spacing: 2,
      labelWidth: 30,
      labelTextStyle: {color: 'gray'},
      frontColor: '#677CD2',
    },
    {value: 20, frontColor: '#E98852'},
    {
      value: 50,
      label: 'W2',
      spacing: 2,
      labelWidth: 30,
      labelTextStyle: {color: 'gray'},
      frontColor: '#677CD2',
    },
    {value: 40, frontColor: '#E98852'},
    {
      value: 75,
      label: 'W3',
      spacing: 2,
      labelWidth: 30,
      labelTextStyle: {color: 'gray'},
      frontColor: '#677CD2',
    },
    {value: 25, frontColor: '#E98852'},
    {
      value: 30,
      label: 'W4',
      spacing: 2,
      labelWidth: 30,
      labelTextStyle: {color: 'gray'},
      frontColor: '#677CD2',
    },
    {value: 20, frontColor: '#E98852'},
  ];

  const handleBarPress = data => {
    // Update the state to show the selected bar value
    setSelectedBar(data);
    console.log(data);
  };

  return (
    <ScrollView>
      <View style={styles.container}>
        <View style={styles.cardSection}>
          <Card style={styles.incomeCard}>
            <Card.Content>
              <View style={styles.cardContent}>
                <Text style={styles.cardText}>Total Income</Text>
                <Text style={styles.cardIncomeText}>$ 1000</Text>
              </View>
            </Card.Content>
          </Card>
          <Card style={styles.expenseCard}>
            <Card.Content>
              <View style={styles.cardContent}>
                <Text style={styles.cardText}>Total Expense</Text>
                <Text style={styles.cardExpenseText}>$ 500</Text>
              </View>
            </Card.Content>
          </Card>
        </View>
        <View style={styles.statisticSection}>
          <View style={styles.statisticHeader}>
            <Text style={styles.statisticHeaderText}>Statistics</Text>
            <Text style={styles.statisticHeaderSubText}>Oct 01 - Oct 31</Text>
          </View>
          <View style={styles.statisticChart}>
            {/* Make a bar chart with data which will contain the total income and expense of each week, also give different color for income and expense */}
            <BarChart
              data={barData}
              height={220}
              barWidth={20}
              spacing={30}
              roundedTop
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{color: 'gray'}}
              noOfSections={3}
              isAnimated
              onPress={handleBarPress}
            />
            {selectedBar && (
              <View style={styles.selectedBarContainer}>
                <Text style={styles.selectedBarText}>
                  $ {selectedBar.value}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.buttonSection}>
          <TouchableOpacity style={styles.incomeBtn}>
            <Text style={styles.incomeBtnText}>Income</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.expenseBtn}>
            <Text style={styles.expenseBtnText}>Expense</Text>
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
                  <Text style={styles.transactionsCardTitle}>Shopping</Text>
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
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    // backgroundColor: '#FAFAFA',
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
    // justifyContent: 'center',
    // alignItems: 'center',
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
    // backgroundColor: 'rgba(255, 255, 255, 0.8)',
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
  incomeBtn: {
    width: '48%',
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  incomeBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#959698',
  },
  expenseBtn: {
    width: '48%',
    height: 40,
    borderRadius: 12,
    backgroundColor: '#677CD2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseBtnText: {
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

export default StatisticScreen;
