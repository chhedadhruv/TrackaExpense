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
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const SUCCESS_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';
const SplitTransactionScreen = ({route, navigation}) => {
  const {group} = route.params;
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
      const splitsSnapshot = await firestore()
        .collection('groups')
        .doc(group.id)
        .collection('splits')
        .orderBy('createdAt', 'desc')
        .get();
      const fetchedTransactions = splitsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTransactions(fetchedTransactions);
      setLoading(false);
    } catch (error) {
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
      const matchPaidBy = transaction.paidBy.name
        .toLowerCase()
        .includes(query.toLowerCase());
      return (
        matchTitle || matchDate || matchCategory || matchAmount || matchPaidBy
      );
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
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="history" size={32} color={PRIMARY_COLOR} />
              <Text style={styles.headerTitle}>All Transactions</Text>
            </View>
            <Text style={styles.headerSubtitle}>View and search group transaction history</Text>
          </View>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="Search transactions..."
              placeholderTextColor="#000"
              onChangeText={handleSearch}
              value={searchQuery}
              style={styles.searchBar}
              inputStyle={styles.searchInput}
              iconColor={PRIMARY_COLOR}
            />
          </View>
          {/* Filter Section */}
          <Card style={styles.filterCard}>
            <View style={styles.cardContent}>
              <Text style={styles.filterTitle}>Filter by Date</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.filterScrollContainer}
                contentContainerStyle={styles.filterContainer}>
                <TouchableOpacity
                  onPress={() => setFilter('all')}
                  style={[
                    styles.filterButton,
                    filter === 'all' && styles.filterButtonActive
                  ]}>
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
                  style={[
                    styles.filterButton,
                    filter === '7days' && styles.filterButtonActive
                  ]}>
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
                  style={[
                    styles.filterButton,
                    filter === '30days' && styles.filterButtonActive
                  ]}>
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
                  style={[
                    styles.filterButton,
                    filter === 'custom' && styles.filterButtonActive
                  ]}>
                  <Text
                    style={
                      filter === 'custom'
                        ? styles.filterButtonTextActive
                        : styles.filterButtonText
                    }>
                    Custom Range
                  </Text>
                </TouchableOpacity>
              </ScrollView>
              {filter === 'custom' && (
                <View style={styles.customDateContainer}>
                  <Text style={styles.customRangeLabel}>Select Date Range</Text>
                  <View style={styles.dateInputsRow}>
                    <View style={styles.dateInputWrapper}>
                      <Text style={styles.dateLabel}>From</Text>
                      <TouchableOpacity
                        style={styles.dateInput}
                        onPress={() => setStartDatePickerVisible(true)}>
                        <Text style={[
                          styles.dateInputText,
                          !customStartDate && styles.dateInputPlaceholder
                        ]}>
                          {customStartDate
                            ? moment(customStartDate).format('MMM DD, YYYY')
                            : 'Start Date'}
                        </Text>
                        <MaterialCommunityIcons
                          name="calendar"
                          size={20}
                          color={PRIMARY_COLOR}
                        />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.dateInputWrapper}>
                      <Text style={styles.dateLabel}>To</Text>
                      <TouchableOpacity
                        style={styles.dateInput}
                        onPress={() => setEndDatePickerVisible(true)}>
                        <Text style={[
                          styles.dateInputText,
                          !customEndDate && styles.dateInputPlaceholder
                        ]}>
                          {customEndDate
                            ? moment(customEndDate).format('MMM DD, YYYY')
                            : 'End Date'}
                        </Text>
                        <MaterialCommunityIcons
                          name="calendar"
                          size={20}
                          color={PRIMARY_COLOR}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
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
                  <TouchableOpacity
                    style={styles.applyButton}
                    onPress={filterTransactions}>
                    <MaterialCommunityIcons name="filter" size={18} color="#FFFFFF" />
                    <Text style={styles.applyButtonText}>Apply Filter</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Card>
          {/* Transactions List */}
          <View style={styles.transactionsSection}>
            <Text style={styles.sectionTitle}>Transactions</Text>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map(transaction => (
                <Card
                  key={transaction.id}
                  style={styles.transactionsCard}
                  onPress={() =>
                    navigation.navigate('SplitDetail', {group, split: transaction})
                  }>
                  <View style={styles.transactionsCardContent}>
                    <View style={styles.transactionsCardDetails}>
                      <View style={styles.transactionsCardInfo}>
                        <Text style={styles.transactionsCardTitle}>
                          {transaction.title}
                        </Text>
                        <Text style={styles.transactionsCardSubtitle}>
                          Paid by {transaction.paidBy.name || transaction.paidBy.email}
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
                    <Text style={styles.transactionsCardAmount}>
                      ₹{transaction.amount}
                    </Text>
                  </View>
                </Card>
              ))
            ) : (
              <Card style={styles.emptyStateCard}>
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="history" size={64} color="#CBD3EE" />
                  <Text style={styles.emptyStateText}>No transactions found</Text>
                  <Text style={styles.emptyStateSubtext}>
                    {searchQuery ? 'Try adjusting your search or filters' : 'Transactions will appear here once created'}
                  </Text>
                </View>
              </Card>
            )}
          </View>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollView: {
    flex: 1,
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    fontFamily: 'Kufam-SemiBoldItalic',
    marginLeft: 12,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 6,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cardContent: {
    padding: 20,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 15,
    fontFamily: 'Lato-Bold',
  },
  searchBar: {
    marginBottom: 15,
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
    fontFamily: 'Lato-Regular',
    fontSize: 16,
  },
  searchInput: {
    color: '#000000',
    fontFamily: 'Lato-Regular',
    fontSize: 16,
  },
  filterScrollContainer: {
    marginBottom: 15,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 5,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  filterButtonActive: {
    backgroundColor: PRIMARY_COLOR + '15',
    borderColor: PRIMARY_COLOR,
  },
  filterButtonText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
  },
  filterButtonTextActive: {
    color: PRIMARY_COLOR,
    fontWeight: 'bold',
    fontFamily: 'Lato-Bold',
  },
  customDateContainer: {
    marginTop: 10,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E8EBF7',
  },
  customRangeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 15,
    fontFamily: 'Lato-Bold',
  },
  dateInputsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dateInputWrapper: {
    flex: 1,
    marginHorizontal: 5,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
    fontFamily: 'Lato-Regular',
  },
  dateInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E8EBF7',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  dateInputText: {
    fontSize: 14,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  dateInputPlaceholder: {
    color: '#999',
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    elevation: 3,
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
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
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
    flexDirection: 'column',
  },
  transactionsCardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A3B3E',
  },
  transactionsCardSubtitle: {
    fontSize: 12,
    color: '#959698',
    marginTop: 2,
  },
  transactionsCardDate: {
    fontSize: 12,
    color: '#959698',
  },
  transactionsCardAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: PRIMARY_COLOR,
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
    fontFamily: 'Lato-Regular',
  },
  transactionsSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 15,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  emptyStateCard: {
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
    fontFamily: 'Lato-Bold',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
});
export default SplitTransactionScreen;
