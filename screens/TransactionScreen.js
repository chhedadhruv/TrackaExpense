import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {Card, Searchbar, ActivityIndicator, Button} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>All Transactions</Text>
        <Text style={styles.headerSubtitle}>
          {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search by title, amount, or category..."
            onChangeText={handleSearch}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            iconColor={PRIMARY_COLOR}
          />
        </View>
        {/* Filter Section */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Filter by period</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
            <TouchableOpacity
              onPress={() => setFilter('all')}
              style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}>
              <MaterialCommunityIcons
                name="format-list-bulleted"
                size={16}
                color={filter === 'all' ? '#FFFFFF' : PRIMARY_COLOR}
              />
              <Text style={filter === 'all' ? styles.filterButtonTextActive : styles.filterButtonText}>
                All
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setFilter('7days')}
              style={[styles.filterButton, filter === '7days' && styles.filterButtonActive]}>
              <MaterialCommunityIcons
                name="calendar-week"
                size={16}
                color={filter === '7days' ? '#FFFFFF' : PRIMARY_COLOR}
              />
              <Text style={filter === '7days' ? styles.filterButtonTextActive : styles.filterButtonText}>
                Last 7 Days
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setFilter('30days')}
              style={[styles.filterButton, filter === '30days' && styles.filterButtonActive]}>
              <MaterialCommunityIcons
                name="calendar-month"
                size={16}
                color={filter === '30days' ? '#FFFFFF' : PRIMARY_COLOR}
              />
              <Text style={filter === '30days' ? styles.filterButtonTextActive : styles.filterButtonText}>
                Last 30 Days
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setFilter('custom')}
              style={[styles.filterButton, filter === 'custom' && styles.filterButtonActive]}>
              <MaterialCommunityIcons
                name="calendar-range"
                size={16}
                color={filter === 'custom' ? '#FFFFFF' : PRIMARY_COLOR}
              />
              <Text style={filter === 'custom' ? styles.filterButtonTextActive : styles.filterButtonText}>
                Custom Range
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        {filter === 'custom' && (
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
                  <Text style={styles.dateInputText}>
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
                  <Text style={styles.dateInputText}>
                    {customEndDate
                      ? moment(customEndDate).format('MMM DD, YYYY')
                      : 'End Date'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            
            {customStartDate && customEndDate && (
              <TouchableOpacity style={styles.applyButton} onPress={filterTransactions}>
                <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
                <Text style={styles.applyButtonText}>Apply Filter</Text>
              </TouchableOpacity>
            )}
            
            <DatePickerModal
              locale="en"
              mode="single"
              visible={startDatePickerVisible}
              onDismiss={onDismissStartDatePicker}
              date={customStartDate}
              onConfirm={onConfirmStartDate}
            />
            <DatePickerModal
              locale="en"
              mode="single"
              visible={endDatePickerVisible}
              onDismiss={onDismissEndDatePicker}
              date={customEndDate}
              onConfirm={onConfirmEndDate}
            />
          </View>
        )}
        {/* Transactions List */}
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
                    <View style={styles.transactionsCardIcon}>
                      {transaction.category === 'Bills' && (
                        <MaterialCommunityIcons
                          name="receipt"
                          size={25}
                          color="#677CD2"
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
                    <View style={styles.transactionsCardInfo}>
                      <Text style={styles.transactionsCardTitle} numberOfLines={1}>
                        {transaction.title}
                      </Text>
                      <Text style={styles.transactionsCardDate}>
                        {moment(transaction.createdAt.toDate()).format('MMM D, YYYY')}
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
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="receipt-text-outline" size={64} color="#CBD3EE" />
              <Text style={styles.emptyStateTitle}>No transactions found</Text>
              <Text style={styles.emptyStateSubtitle}>
                {searchQuery ? 'Try adjusting your search terms' : 'Transactions will appear here once you add them'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND_COLOR,
  },
  loadingText: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    marginTop: 15,
    fontFamily: 'Lato-Regular',
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontFamily: 'Lato-Regular',
  },
  scrollContainer: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  searchBar: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderRadius: 12,
  },
  searchInput: {
    fontFamily: 'Lato-Regular',
    fontSize: 16,
  },
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 12,
    fontFamily: 'Lato-Bold',
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  filterButtonActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  filterButtonText: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
    fontFamily: 'Lato-Regular',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: 'Lato-Bold',
  },
  customDateSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  customDateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 15,
    fontFamily: 'Lato-Bold',
  },
  customDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  dateInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EBF7',
    borderRadius: 12,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  dateInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInputText: {
    fontSize: 16,
    color: '#2C2C2C',
    marginLeft: 10,
    fontFamily: 'Lato-Regular',
  },
  dateSeparator: {
    paddingHorizontal: 15,
  },
  dateSeparatorText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Lato-Regular',
  },
  applyButton: {
    backgroundColor: PRIMARY_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 4,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
  },
  transactionsList: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  transactionsCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    padding: 15,
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
    backgroundColor: '#E8EBF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  transactionsCardInfo: {
    flex: 1,
  },
  transactionsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  transactionsCardDate: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    fontFamily: 'Lato-Regular',
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
    fontWeight: '500',
    fontFamily: 'Lato-Regular',
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
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 20,
    marginBottom: 8,
    fontFamily: 'Lato-Bold',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Lato-Regular',
  },
});

export default TransactionScreen; 