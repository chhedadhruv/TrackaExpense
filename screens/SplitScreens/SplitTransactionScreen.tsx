import React, {useState, useEffect, useContext} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Share,
} from 'react-native';
import {Card, Searchbar, ActivityIndicator} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  collection,
  getDocs,
  getFirestore,
} from '@react-native-firebase/firestore';
import moment from 'moment';
import {DatePickerModal} from 'react-native-paper-dates';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-controller';
import {useCurrency} from '../../utils/CurrencyUtil';
import {AuthContext} from '../../navigation/AuthProvider';
import {
  PRIMARY_COLOR,
  BACKGROUND_COLOR,
  INCOME_COLOR as SUCCESS_COLOR,
  EXPENSE_COLOR,
} from '../../src/constants/theme';

interface SplitUser {
  email?: string;
  name?: string;
  percentage?: number;
}

interface SplitItem {
  id: string;
  title?: string;
  amount: number | string;
  type?: string;
  isSettlement?: boolean;
  splitType?: string;
  category?: string;
  paidBy?: {email?: string; name?: string};
  splitUsers?: SplitUser[];
  date?: {toDate: () => Date; toMillis?: () => number};
  createdAt?: {toDate: () => Date; toMillis?: () => number};
}

interface Group {
  id: string;
  name?: string;
}

type FilterType = 'all' | '7days' | '30days' | 'custom';

const getSplitCardColor = (
  split: SplitItem,
  currentEmail: string | undefined,
): string => {
  if (!currentEmail) {
    return PRIMARY_COLOR;
  }
  if (split.type === 'settlement' || split.isSettlement) {
    const payerEmail = split.paidBy?.email?.toLowerCase();
    const isReceiver =
      split.splitUsers?.some(u => u.email?.toLowerCase() === currentEmail) &&
      payerEmail !== currentEmail;
    if (isReceiver) {
      return SUCCESS_COLOR;
    }
    if (payerEmail === currentEmail) {
      return EXPENSE_COLOR;
    }
    return PRIMARY_COLOR;
  }
  const isPayer = split.paidBy?.email?.toLowerCase() === currentEmail;
  const isInSplitUsers = split.splitUsers?.some(
    u => u.email?.toLowerCase() === currentEmail,
  );
  if (isPayer && (split.splitUsers?.length ?? 0) > 1) {
    return SUCCESS_COLOR;
  }
  if (!isPayer && isInSplitUsers) {
    return EXPENSE_COLOR;
  }
  return PRIMARY_COLOR;
};

const SplitTransactionScreen = ({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) => {
  const {formatAmount} = useCurrency();
  const {user} = useContext(AuthContext);
  const currentUserEmail = user?.email?.toLowerCase();
  const {group} = route.params as {group: Group};
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<SplitItem[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<SplitItem[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, transactions, customStartDate, customEndDate]);

  const fetchTransactions = async () => {
    try {
      const splitsSnapshot = await getDocs(
        collection(getFirestore(), 'groups', group.id, 'splits'),
      );
      const fetched = splitsSnapshot.docs
        .map(doc => ({id: doc.id, ...doc.data()} as SplitItem))
        .sort((a, b) => {
          const aTs = (a.date || a.createdAt)?.toMillis?.() ?? 0;
          const bTs = (b.date || b.createdAt)?.toMillis?.() ?? 0;
          return bTs - aTs;
        });
      setTransactions(fetched);
      setLoading(false);
    } catch (_) {
      setLoading(false);
    }
  };

  const filterTransactions = () => {
    let filtered = transactions;
    switch (filter) {
      case '7days':
        filtered = transactions.filter(t =>
          moment((t.date || t.createdAt)!.toDate()).isAfter(
            moment().subtract(7, 'days'),
          ),
        );
        break;
      case '30days':
        filtered = transactions.filter(t =>
          moment((t.date || t.createdAt)!.toDate()).isAfter(
            moment().subtract(30, 'days'),
          ),
        );
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          filtered = transactions.filter(t =>
            moment((t.date || t.createdAt)!.toDate()).isBetween(
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
    const filtered = transactions.filter(t => {
      const matchTitle = (t.title ?? '')
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchDate = moment((t.date || t.createdAt)!.toDate())
        .format('MMM D, YYYY')
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchCategory = t.category
        ?.toLowerCase()
        .includes(query.toLowerCase());
      const matchAmount = String(t.amount).includes(query);
      const matchPaidBy = (t.paidBy?.name ?? '')
        .toLowerCase()
        .includes(query.toLowerCase());
      return (
        matchTitle || matchDate || matchCategory || matchAmount || matchPaidBy
      );
    });
    setFilteredTransactions(filtered);
  };

  const handleExportCSV = async () => {
    if (filteredTransactions.length === 0) {
      return;
    }
    const groupName = group.name || 'Group';
    const exportDate = new Date().toLocaleDateString();
    const currentEmail = user?.email?.toLowerCase() || '';
    const header = `# ${groupName} splits export - ${exportDate}`;
    const csvHeader =
      'Title,Amount,Paid By,Category,Date,Split Type,Your Share';
    const escapeCSV = (val: unknown): string => {
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };
    const rows = filteredTransactions.map(t => {
      const date = moment((t.date || t.createdAt)!.toDate()).format(
        'YYYY-MM-DD',
      );
      const paidBy = t.paidBy?.name || t.paidBy?.email || '';
      const category = t.category || '';
      const splitType = t.splitType || 'equal';
      let yourShare = '';
      if (t.type !== 'settlement' && !t.isSettlement) {
        const isParticipant = t.splitUsers?.some(
          u => u.email?.toLowerCase() === currentEmail,
        );
        if (isParticipant) {
          if (splitType === 'percentage') {
            const entry = t.splitUsers?.find(
              u => u.email?.toLowerCase() === currentEmail,
            );
            yourShare = entry
              ? (
                  parseFloat(String(t.amount)) *
                  ((entry.percentage ?? 0) / 100)
                ).toFixed(2)
              : '';
          } else {
            yourShare = (
              parseFloat(String(t.amount)) / (t.splitUsers?.length || 1)
            ).toFixed(2);
          }
        }
      }
      return [
        escapeCSV(t.title),
        t.amount,
        escapeCSV(paidBy),
        escapeCSV(category),
        date,
        splitType,
        yourShare,
      ].join(',');
    });
    try {
      await Share.share({
        message: [header, csvHeader, ...rows].join('\n'),
        title: `${groupName} Splits`,
      });
    } catch (_) {}
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
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons
                name="history"
                size={32}
                color={PRIMARY_COLOR}
              />
              <Text style={styles.headerTitle}>All Transactions</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              View and search group transaction history
            </Text>
          </View>
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
          <Card
            style={[
              styles.filterCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 1}>
            <View style={styles.cardContent}>
              <Text style={styles.filterTitle}>Filter by Date</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScrollContainer}
                contentContainerStyle={styles.filterContainer}>
                {(['all', '7days', '30days', 'custom'] as FilterType[]).map(
                  f => (
                    <TouchableOpacity
                      key={f}
                      onPress={() => setFilter(f)}
                      style={[
                        styles.filterButton,
                        filter === f && styles.filterButtonActive,
                      ]}>
                      <Text
                        style={
                          filter === f
                            ? styles.filterButtonTextActive
                            : styles.filterButtonText
                        }>
                        {f === 'all'
                          ? 'All'
                          : f === '7days'
                          ? 'Last 7 Days'
                          : f === '30days'
                          ? 'Last 30 Days'
                          : 'Custom Range'}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
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
                        <Text
                          style={[
                            styles.dateInputText,
                            !customStartDate && styles.dateInputPlaceholder,
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
                        <Text
                          style={[
                            styles.dateInputText,
                            !customEndDate && styles.dateInputPlaceholder,
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
                    onDismiss={() => setStartDatePickerVisible(false)}
                    date={customStartDate ?? undefined}
                    onConfirm={(params: {date?: Date}) => {
                      setStartDatePickerVisible(false);
                      if (params.date) {
                        setCustomStartDate(params.date);
                      }
                    }}
                    saveLabel="Confirm"
                    label="Select start date"
                    uppercase={false}
                    {...(Platform.OS === 'ios' && {
                      presentationStyle: 'pageSheet',
                    })}
                  />
                  <DatePickerModal
                    locale="en"
                    mode="single"
                    visible={endDatePickerVisible}
                    onDismiss={() => setEndDatePickerVisible(false)}
                    date={customEndDate ?? undefined}
                    onConfirm={(params: {date?: Date}) => {
                      setEndDatePickerVisible(false);
                      if (params.date) {
                        setCustomEndDate(params.date);
                      }
                    }}
                    saveLabel="Confirm"
                    label="Select end date"
                    uppercase={false}
                    {...(Platform.OS === 'ios' && {
                      presentationStyle: 'pageSheet',
                    })}
                  />
                  <TouchableOpacity
                    style={styles.applyButton}
                    onPress={filterTransactions}>
                    <MaterialCommunityIcons
                      name="filter"
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.applyButtonText}>Apply Filter</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Card>
          <View style={styles.transactionsSection}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 15,
              }}>
              <Text style={[styles.sectionTitle, {marginBottom: 0}]}>
                Transactions
              </Text>
              {filteredTransactions.length > 0 && (
                <TouchableOpacity
                  onPress={handleExportCSV}
                  style={{padding: 4}}>
                  <MaterialCommunityIcons
                    name="export"
                    size={24}
                    color={PRIMARY_COLOR}
                  />
                </TouchableOpacity>
              )}
            </View>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map(transaction => {
                const txColor = getSplitCardColor(
                  transaction,
                  currentUserEmail,
                );
                return (
                  <Card
                    key={transaction.id}
                    style={[
                      styles.transactionsCard,
                      Platform.OS === 'android' && styles.cardAndroid,
                    ]}
                    elevation={Platform.OS === 'android' ? 0 : 1}
                    onPress={() =>
                      navigation.navigate('SplitDetail', {
                        group,
                        split: transaction,
                      })
                    }>
                    <View style={styles.transactionsCardContent}>
                      <View
                        style={[
                          styles.transactionColorBar,
                          {backgroundColor: txColor},
                        ]}
                      />
                      <View style={styles.transactionsCardDetails}>
                        <View style={styles.transactionsCardInfo}>
                          <Text style={styles.transactionsCardTitle}>
                            {transaction.title}
                          </Text>
                          <Text style={styles.transactionsCardSubtitle}>
                            Paid by{' '}
                            {transaction.paidBy?.name ||
                              transaction.paidBy?.email}
                          </Text>
                          <Text style={styles.transactionsCardDate}>
                            {moment(
                              (transaction.date ||
                                transaction.createdAt)!.toDate(),
                            ).format('MMM D, YYYY')}
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
                        style={[
                          styles.transactionsCardAmount,
                          {color: txColor},
                        ]}>
                        {formatAmount(Number(transaction.amount))}
                      </Text>
                    </View>
                  </Card>
                );
              })
            ) : (
              <Card
                style={[
                  styles.emptyStateCard,
                  Platform.OS === 'android' && styles.cardAndroid,
                ]}
                elevation={Platform.OS === 'android' ? 0 : 1}>
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons
                    name="history"
                    size={64}
                    color="#CBD3EE"
                  />
                  <Text style={styles.emptyStateText}>
                    No transactions found
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    {searchQuery
                      ? 'Try adjusting your search or filters'
                      : 'Transactions will appear here once created'}
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

export default SplitTransactionScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
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
  headerTitleRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
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
  searchContainer: {paddingHorizontal: 20, marginBottom: 20},
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cardContent: {padding: 20},
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
    elevation: Platform.OS === 'android' ? 0 : 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 1,
    borderRadius: 12,
    fontFamily: 'Lato-Regular',
    fontSize: 16,
  },
  searchInput: {color: '#000000', fontFamily: 'Lato-Regular', fontSize: 16},
  filterScrollContainer: {marginBottom: 15},
  filterContainer: {flexDirection: 'row', paddingHorizontal: 5},
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
  dateInputWrapper: {flex: 1, marginHorizontal: 5},
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
  },
  dateInputText: {fontSize: 14, color: '#2C2C2C', fontFamily: 'Lato-Regular'},
  dateInputPlaceholder: {color: '#999'},
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    elevation: Platform.OS === 'android' ? 0 : 1,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
  },
  transactionsCard: {
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
  },
  transactionsCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  transactionColorBar: {width: 4, alignSelf: 'stretch'},
  transactionsCardDetails: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  transactionsCardInfo: {flexDirection: 'column'},
  transactionsCardTitle: {fontSize: 16, fontWeight: '500', color: '#3A3B3E'},
  transactionsCardSubtitle: {fontSize: 12, color: '#959698', marginTop: 2},
  transactionsCardDate: {fontSize: 12, color: '#959698'},
  transactionsCardAmount: {
    fontSize: 16,
    fontWeight: '500',
    paddingRight: 12,
    alignSelf: 'center',
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
  transactionsSection: {paddingHorizontal: 20, paddingBottom: 30},
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 15,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  emptyStateCard: {backgroundColor: '#FFFFFF', borderRadius: 16},
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
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
});
