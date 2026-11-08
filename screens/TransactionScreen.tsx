import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import {Card, Searchbar, ActivityIndicator} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query as fsQuery,
} from '@react-native-firebase/firestore';
import {reportError} from '../src/services/ErrorReporter';
import moment from 'moment';
import {DatePickerModal} from 'react-native-paper-dates';
import {getAuth} from '@react-native-firebase/auth';
import Share from 'react-native-share';
import {File, Paths} from 'expo-file-system';
import {useCurrency} from '../utils/CurrencyUtil';
import {getCategoryIcon} from '../utils/CategoryData';
import {
  PRIMARY_COLOR,
  BACKGROUND_COLOR,
  INCOME_COLOR,
  EXPENSE_COLOR,
} from '../src/constants/theme';
import {getConfig} from '../src/services/RemoteConfigService';
import * as AnalyticsService from '../src/services/AnalyticsService';
import type {TransactionDocument} from '../src/types';
import type {McIconName} from '../src/types/icons';

type FilterType = 'all' | '7days' | '30days' | 'custom';

const TransactionScreen = ({navigation}: {navigation: any}) => {
  const {formatAmount} = useCurrency();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionDocument[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<
    TransactionDocument[]
  >([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    filterTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, transactions, customStartDate, customEndDate]);

  const fetchTransactions = async () => {
    try {
      const currentUser = getAuth().currentUser!;
      const snapshot = await getDocs(
        fsQuery(
          collection(getFirestore(), 'users', currentUser.uid, 'transactions'),
          orderBy('createdAt', 'desc'),
        ),
      );
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        userId: currentUser.uid,
        ...doc.data(),
      })) as TransactionDocument[];
      setTransactions(fetched.slice(0, getConfig().max_transactions_displayed));
    } catch (e) {
      reportError(e as Error);
    } finally {
      setLoading(false);
    }
  };

  const filterTransactions = () => {
    let filtered = transactions;
    switch (filter) {
      case '7days':
        filtered = transactions.filter(t =>
          moment((t.createdAt as any).toDate()).isAfter(
            moment().subtract(7, 'days'),
          ),
        );
        break;
      case '30days':
        filtered = transactions.filter(t =>
          moment((t.createdAt as any).toDate()).isAfter(
            moment().subtract(30, 'days'),
          ),
        );
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          filtered = transactions.filter(t =>
            moment((t.createdAt as any).toDate()).isBetween(
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

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredTransactions(transactions);
      return;
    }
    const lower = query.toLowerCase();
    const filtered = transactions.filter(t => {
      const matchTitle = t.title.toLowerCase().includes(lower);
      const matchDate = moment((t.createdAt as any).toDate())
        .format('MMM D, YYYY')
        .toLowerCase()
        .includes(lower);
      const matchCategory = t.category?.toLowerCase().includes(lower);
      const matchAmount = t.amount.toString().includes(query);
      return matchTitle || matchDate || matchCategory || matchAmount;
    });
    setFilteredTransactions(filtered);
  };

  const generateCSV = (): string | undefined => {
    if (filteredTransactions.length === 0) {
      Alert.alert('No Data', 'No transactions to export');
      return;
    }
    const headers = [
      'Date',
      'Title',
      'Type',
      'Category',
      'Amount',
      'Description',
    ];
    const rows = filteredTransactions.map(t =>
      [
        moment((t.createdAt as any).toDate()).format('YYYY-MM-DD'),
        `"${t.title || ''}"`,
        t.type || '',
        t.category || '',
        t.amount || 0,
        `"${t.description || ''}"`,
      ].join(','),
    );
    return [headers.join(','), ...rows].join('\n');
  };

  const downloadCSV = async () => {
    try {
      const csvContent = generateCSV();
      if (!csvContent) {
        return;
      }
      const fileName = `transactions_${moment().format(
        'YYYY-MM-DD_HH-mm-ss',
      )}.csv`;

      const file = new File(Paths.document, fileName);
      file.create({overwrite: true});
      file.write(csvContent);
      if (!file.exists) {
        Alert.alert('Error', 'Failed to create CSV file');
        return;
      }
      try {
        await Share.open({
          title: 'Export Transactions',
          message: 'Your transaction data',
          url: file.uri,
          type: 'text/csv',
        });
      } catch (shareError: any) {
        if (
          shareError.message !== 'User did not share' &&
          shareError.message !== 'User cancelled'
        ) {
          Alert.alert('Error', 'Failed to share file');
        }
      }
    } catch (_) {
      Alert.alert('Error', 'Failed to export transactions. Please try again.');
    }
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
      <View style={styles.headerSection}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>All Transactions</Text>
            <Text style={styles.headerSubtitle}>
              {filteredTransactions.length} transaction
              {filteredTransactions.length !== 1 ? 's' : ''} found
            </Text>
          </View>
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={downloadCSV}
            disabled={filteredTransactions.length === 0}>
            <MaterialCommunityIcons
              name="download"
              size={20}
              color={filteredTransactions.length === 0 ? '#999' : PRIMARY_COLOR}
            />
            <Text
              style={[
                styles.downloadButtonText,
                filteredTransactions.length === 0 &&
                  styles.downloadButtonTextDisabled,
              ]}>
              Download CSV
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search by title, amount, or category..."
            placeholderTextColor="#000"
            onChangeText={handleSearch}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            iconColor={PRIMARY_COLOR}
          />
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Filter by period</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}>
            {(['all', '7days', '30days', 'custom'] as FilterType[]).map(f => {
              const icons: Record<FilterType, McIconName> = {
                all: 'format-list-bulleted',
                '7days': 'calendar-week',
                '30days': 'calendar-month',
                custom: 'calendar-range',
              };
              const labels: Record<FilterType, string> = {
                all: 'All',
                '7days': 'Last 7 Days',
                '30days': 'Last 30 Days',
                custom: 'Custom Range',
              };
              const active = filter === f;
              return (
                <TouchableOpacity
                  key={f}
                  onPress={() => {
                    setFilter(f);
                    AnalyticsService.logTransactionFilterChanged(f);
                  }}
                  style={[
                    styles.filterButton,
                    active && styles.filterButtonActive,
                  ]}>
                  <MaterialCommunityIcons
                    name={icons[f]}
                    size={16}
                    color={active ? '#FFFFFF' : PRIMARY_COLOR}
                  />
                  <Text
                    style={
                      active
                        ? styles.filterButtonTextActive
                        : styles.filterButtonText
                    }>
                    {labels[f]}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
              <TouchableOpacity
                style={styles.applyButton}
                onPress={filterTransactions}>
                <MaterialCommunityIcons
                  name="check"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.applyButtonText}>Apply Filter</Text>
              </TouchableOpacity>
            )}
            <DatePickerModal
              locale="en"
              mode="single"
              visible={startDatePickerVisible}
              onDismiss={() => setStartDatePickerVisible(false)}
              date={customStartDate ?? undefined}
              onConfirm={(params: any) => {
                setStartDatePickerVisible(false);
                setCustomStartDate(params.date);
              }}
              saveLabel="Confirm"
              label="Select start date"
              uppercase={false}
              {...(Platform.OS === 'ios' && {presentationStyle: 'pageSheet'})}
            />
            <DatePickerModal
              locale="en"
              mode="single"
              visible={endDatePickerVisible}
              onDismiss={() => setEndDatePickerVisible(false)}
              date={customEndDate ?? undefined}
              onConfirm={(params: any) => {
                setEndDatePickerVisible(false);
                setCustomEndDate(params.date);
              }}
              saveLabel="Confirm"
              label="Select end date"
              uppercase={false}
              {...(Platform.OS === 'ios' && {presentationStyle: 'pageSheet'})}
            />
          </View>
        )}

        <View style={styles.transactionsList}>
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map(transaction => (
              <Card
                key={transaction.id}
                style={[
                  styles.transactionsCard,
                  Platform.OS === 'android' && styles.cardAndroid,
                ]}
                elevation={Platform.OS === 'android' ? 0 : 2}
                onPress={() =>
                  navigation.navigate('TransactionDetail', {transaction})
                }>
                <View style={styles.transactionsCardContent}>
                  <View style={styles.transactionsCardDetails}>
                    <View style={styles.transactionsCardIcon}>
                      <MaterialCommunityIcons
                        name={getCategoryIcon(transaction.category)}
                        size={25}
                        color={PRIMARY_COLOR}
                      />
                    </View>
                    <View style={styles.transactionsCardInfo}>
                      <Text
                        style={styles.transactionsCardTitle}
                        numberOfLines={1}>
                        {transaction.title}
                      </Text>
                      <Text style={styles.transactionsCardDate}>
                        {moment((transaction.createdAt as any).toDate()).format(
                          'MMM D, YYYY',
                        )}
                      </Text>
                      {transaction.category ? (
                        <View style={styles.categoryTag}>
                          <Text style={styles.categoryText}>
                            {transaction.category}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Text
                    style={
                      transaction.type === 'income'
                        ? styles.amountIncome
                        : styles.amountExpense
                    }>
                    {transaction.type === 'income' ? '+ ' : '- '}
                    {formatAmount(transaction.amount)}
                  </Text>
                </View>
              </Card>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="note-text-outline"
                size={64}
                color="#CBD3EE"
              />
              <Text style={styles.emptyStateTitle}>No transactions found</Text>
              <Text style={styles.emptyStateSubtitle}>
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Transactions will appear here once you add them'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default TransactionScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTextContainer: {flex: 1},
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
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    marginLeft: 15,
  },
  downloadButtonText: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: 'Lato-Bold',
  },
  downloadButtonTextDisabled: {color: '#999'},
  scrollContainer: {flex: 1},
  searchContainer: {paddingHorizontal: 20, paddingVertical: 15},
  searchBar: {
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
    elevation: Platform.OS === 'android' ? 0 : 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderRadius: 12,
    fontSize: 16,
  },
  searchInput: {color: '#000000', fontFamily: 'Lato-Regular', fontSize: 16},
  filterSection: {paddingHorizontal: 20, marginBottom: 20},
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 12,
    fontFamily: 'Lato-Bold',
  },
  filterScrollView: {flexGrow: 0},
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
    elevation: Platform.OS === 'android' ? 0 : 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
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
  customDateSection: {paddingHorizontal: 20, marginBottom: 20},
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
    elevation: Platform.OS === 'android' ? 0 : 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  dateInputContent: {flexDirection: 'row', alignItems: 'center'},
  dateInputText: {
    fontSize: 16,
    color: '#2C2C2C',
    marginLeft: 10,
    fontFamily: 'Lato-Regular',
  },
  dateSeparator: {paddingHorizontal: 15},
  dateSeparatorText: {fontSize: 14, color: '#666', fontFamily: 'Lato-Regular'},
  applyButton: {
    backgroundColor: PRIMARY_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: Platform.OS === 'android' ? 0 : 4,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {width: 0, height: 2},
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
  transactionsList: {paddingHorizontal: 20, paddingBottom: 30},
  transactionsCard: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: Platform.OS === 'android' ? 0 : 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    padding: 15,
  },
  transactionsCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionsCardDetails: {flexDirection: 'row', flex: 1},
  transactionsCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#E8EBF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  transactionsCardInfo: {flex: 1},
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
  amountIncome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: INCOME_COLOR,
    fontFamily: 'Lato-Bold',
  },
  amountExpense: {
    fontSize: 16,
    fontWeight: 'bold',
    color: EXPENSE_COLOR,
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
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
});
