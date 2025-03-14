import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {Card, Searchbar, ActivityIndicator, Button} from 'react-native-paper';
import firestore from '@react-native-firebase/firestore';
import moment from 'moment';
import {DatePickerModal} from 'react-native-paper-dates';
import auth from '@react-native-firebase/auth';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';

const TransactionScreen = ({navigation}) => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [filter, transactions, customStartDate, customEndDate]);

  const fetchTransactions = async () => {
    try {
      const currentUser = auth().currentUser;
      const transactionsSnapshot = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('transactions')
        .orderBy('createdAt', 'desc')
        .get();

      const fetchedTransactions = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      setTransactions(fetchedTransactions);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setLoading(false);
    }
  };

  const filterTransactions = () => {
    let filtered = transactions;

    switch (filter) {
      case '7days':
        filtered = transactions.filter(transaction =>
          moment(transaction.createdAt.toDate()).isAfter(
            moment().subtract(7, 'days'),
          ),
        );
        break;
      case '30days':
        filtered = transactions.filter(transaction =>
          moment(transaction.createdAt.toDate()).isAfter(
            moment().subtract(30, 'days'),
          ),
        );
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          filtered = transactions.filter(transaction =>
            moment(transaction.createdAt.toDate()).isBetween(
              customStartDate,
              customEndDate,
              undefined,
              '[]',
            ),
          );
        }
        break;
      default:
        break;
    }

    setFilteredTransactions(filtered);
  };

  const handleSearch = query => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredTransactions(transactions);
      return;
    }

    const searchTerms = query.toLowerCase().trim().split(' ');
    const filtered = transactions.filter(transaction => {
      const matchTitle = transaction.title
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchDate = moment(transaction.createdAt.toDate())
        .format('MMM D, YYYY')
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchCategory = transaction.category
        ?.toLowerCase()
        .includes(query.toLowerCase());
      const matchAmount = transaction.amount.toString().includes(query);

      return matchTitle || matchDate || matchCategory || matchAmount;
    });

    setFilteredTransactions(filtered);
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
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Searchbar
        placeholder="Search transactions..."
        onChangeText={handleSearch}
        value={searchQuery}
        style={styles.searchBar}
      />
      <View style={styles.filterContainer}>
        <TouchableOpacity
          onPress={() => setFilter('all')}
          style={styles.filterButton}>
          <Text
            style={
              filter === 'all'
                ? styles.filterButtonTextActive
                : styles.filterButtonText
            }>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilter('7days')}
          style={styles.filterButton}>
          <Text
            style={
              filter === '7days'
                ? styles.filterButtonTextActive
                : styles.filterButtonText
            }>
            Last 7 Days
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilter('30days')}
          style={styles.filterButton}>
          <Text
            style={
              filter === '30days'
                ? styles.filterButtonTextActive
                : styles.filterButtonText
            }>
            Last 30 Days
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilter('custom')}
          style={styles.filterButton}>
          <Text
            style={
              filter === 'custom'
                ? styles.filterButtonTextActive
                : styles.filterButtonText
            }>
            Custom Range
          </Text>
        </TouchableOpacity>
      </View>
      {filter === 'custom' && (
        <View style={styles.customDateContainer}>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setStartDatePickerVisible(true)}>
            <Text>
              {customStartDate
                ? moment(customStartDate).format('YYYY-MM-DD')
                : 'Start Date'}
            </Text>
            <MaterialCommunityIcons
              name="calendar"
              size={24}
              color={PRIMARY_COLOR}
            />
          </TouchableOpacity>
          <DatePickerModal
            locale="en"
            mode="single"
            visible={startDatePickerVisible}
            onDismiss={onDismissStartDatePicker}
            date={customStartDate}
            onConfirm={onConfirmStartDate}
          />
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setEndDatePickerVisible(true)}>
            <Text>
              {customEndDate
                ? moment(customEndDate).format('YYYY-MM-DD')
                : 'End Date'}
            </Text>
            <MaterialCommunityIcons
              name="calendar"
              size={24}
              color={PRIMARY_COLOR}
            />
          </TouchableOpacity>
          <DatePickerModal
            locale="en"
            mode="single"
            visible={endDatePickerVisible}
            onDismiss={onDismissEndDatePicker}
            date={customEndDate}
            onConfirm={onConfirmEndDate}
          />
          <Button
            mode="contained"
            onPress={filterTransactions}
            style={styles.applyButton}>
            Apply
          </Button>
        </View>
      )}
      <View style={styles.transactionsList}>
        {filteredTransactions.length > 0 ? (
          filteredTransactions.map(transaction => (
            <Card
              key={transaction.id}
              style={styles.transactionsCard}
              onPress={() =>
                navigation.navigate('TransactionDetail', {transaction})
              }>
              <View style={styles.transactionsCardContent}>
                <View style={styles.transactionsCardDetails}>
                  <View style={styles.transactionsCardInfo}>
                    <Text style={styles.transactionsCardTitle} numberOfLines={1}>
                      {transaction.title}
                    </Text>
                    <Text style={styles.transactionsCardDate}>
                      {moment(transaction.createdAt.toDate()).format(
                        'MMM D, YYYY',
                      )}
                    </Text>
                    {transaction.category && (
                      <View style={styles.categoryTag}>
                        <Text style={styles.categoryText}>
                          {transaction.category}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
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
            </Card>
          ))
        ) : (
          <Text style={styles.noTransactionsText}>No Transactions</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    padding: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  searchBar: {
    marginBottom: 15,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  filterButton: {
    padding: 10,
  },
  filterButtonText: {
    color: '#959698',
  },
  filterButtonTextActive: {
    color: PRIMARY_COLOR,
    fontWeight: 'bold',
  },
  customDateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  dateInput: {
    flex: 1,
    marginHorizontal: 5,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  applyButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  transactionsList: {
    marginBottom: 30,
  },
  transactionsCard: {
    marginBottom: 10,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  transactionsCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionsCardDetails: {
    flexDirection: 'row',
    flex: 1,
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
  transactionsCardInfo: {
    flex: 1,
  },
  transactionsCardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A3B3E',
  },
  transactionsCardDate: {
    fontSize: 12,
    color: '#959698',
    marginTop: 2,
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
  noTransactionsText: {
    textAlign: 'center',
    color: '#959698',
    marginTop: 20,
    fontSize: 14,
  },
  categoryTag: {
    backgroundColor: PRIMARY_COLOR + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: PRIMARY_COLOR,
  },
});

export default TransactionScreen; 