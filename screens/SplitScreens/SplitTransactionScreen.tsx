import React, {useState, useEffect, useContext, useMemo} from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Share,
} from 'react-native';
import Card from '../../src/components/Card';
import SearchField from '../../src/components/SearchField';
import Calendar from 'lucide-react-native/icons/calendar';
import History from 'lucide-react-native/icons/history';
import ListFilter from 'lucide-react-native/icons/list-filter';
import ShareIcon from 'lucide-react-native/icons/share';
import moment from 'moment';
import DatePickerModal from '../../src/components/DatePickerModal';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {useCurrency} from '../../utils/CurrencyUtil';
import {majorOf} from '../../src/utils/amounts';
import {fromMinor} from '../../src/utils/money';
import {shareOfMinor} from '../../src/utils/splitMath';
import {AuthContext} from '../../navigation/AuthProvider';
import {useRouter} from 'expo-router';
import {useTheme, useThemedStyles, type ThemeColors} from '../../src/theme';
import {ErrorState, LoadingState} from '../../src/components/ScreenState';
import {useGroupSplits} from '../../src/data/split';

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
  colors: ThemeColors,
): string => {
  if (!currentEmail) {
    return colors.primary;
  }
  if (split.type === 'settlement' || split.isSettlement) {
    const payerEmail = split.paidBy?.email?.toLowerCase();
    const isReceiver =
      split.splitUsers?.some(u => u.email?.toLowerCase() === currentEmail) &&
      payerEmail !== currentEmail;
    if (isReceiver) {
      return colors.incomeText;
    }
    if (payerEmail === currentEmail) {
      return colors.expenseText;
    }
    return colors.primary;
  }
  const isPayer = split.paidBy?.email?.toLowerCase() === currentEmail;
  const isInSplitUsers = split.splitUsers?.some(
    u => u.email?.toLowerCase() === currentEmail,
  );
  if (isPayer && (split.splitUsers?.length ?? 0) > 1) {
    return colors.incomeText;
  }
  if (!isPayer && isInSplitUsers) {
    return colors.expenseText;
  }
  return colors.primary;
};

export interface SplitTransactionScreenProps {
  group: Group;
}

const SplitTransactionScreen = ({group}: SplitTransactionScreenProps) => {
  const {currency, formatAmount} = useCurrency();
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const {user} = useContext(AuthContext);
  const currentUserEmail = user?.email?.toLowerCase();
  // The group's splits come from the shared cache (newest first); a read-only list may show the
  // saved copy at once.
  const splits = useGroupSplits<SplitItem>(group.id);
  const transactions = useMemo(() => splits.data ?? [], [splits.data]);
  const loading = splits.loading;
  const failed = splits.error;
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
    filterTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, transactions, customStartDate, customEndDate]);

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
        // Divided in integer minor units, so everyone's shares add up to the split total.
        const myShare = shareOfMinor(t, currentEmail, currency.code);
        if (myShare !== null) {
          yourShare = fromMinor(myShare, currency.code);
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
    return <LoadingState message="Loading transactions..." />;
  }

  if (failed) {
    return (
      <ErrorState title="Could not load transactions" onRetry={splits.retry} />
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <FlatList
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          data={filteredTransactions}
          keyExtractor={(transaction, index) => transaction.id ?? String(index)}
          initialNumToRender={10}
          windowSize={7}
          renderItem={({item: transaction}) => {
            const txColor = getSplitCardColor(
              transaction,
              currentUserEmail,
              colors,
            );
            return (
              <View style={styles.transactionsRow}>
                <Card
                  style={[
                    styles.transactionsCard,
                    Platform.OS === 'android' && styles.cardAndroid,
                  ]}
                  elevation={Platform.OS === 'android' ? 0 : 1}
                  onPress={() =>
                    router.navigate({
                      pathname: '/split/group/[groupId]/split/[splitId]',
                      params: {groupId: group.id, splitId: transaction.id},
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
                      style={[styles.transactionsCardAmount, {color: txColor}]}>
                      {formatAmount(majorOf(transaction, currency.code))}
                    </Text>
                  </View>
                </Card>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.transactionsRow}>
              <Card
                style={[
                  styles.emptyStateCard,
                  Platform.OS === 'android' && styles.cardAndroid,
                ]}
                elevation={Platform.OS === 'android' ? 0 : 1}>
                <View style={styles.emptyState}>
                  <History size={64} color={colors.iconMuted} />
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
            </View>
          }
          ListFooterComponent={<View style={styles.listFooter} />}
          ListHeaderComponent={
            <>
              <View style={styles.headerSection}>
                <View style={styles.headerTitleRow}>
                  <History size={32} color={colors.primary} />
                  <Text style={styles.headerTitle}>All Transactions</Text>
                </View>
                <Text style={styles.headerSubtitle}>
                  View and search group transaction history
                </Text>
              </View>
              <View style={styles.searchContainer}>
                <SearchField
                  placeholder="Search transactions..."
                  onChangeText={handleSearch}
                  value={searchQuery}
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
                      <Text style={styles.customRangeLabel}>
                        Select Date Range
                      </Text>
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
                            <Calendar size={20} color={colors.primary} />
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
                            <Calendar size={20} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <DatePickerModal
                        visible={startDatePickerVisible}
                        onDismiss={() => setStartDatePickerVisible(false)}
                        date={customStartDate ?? undefined}
                        onConfirm={({date}) => setCustomStartDate(date)}
                        label="Select start date"
                      />
                      <DatePickerModal
                        visible={endDatePickerVisible}
                        onDismiss={() => setEndDatePickerVisible(false)}
                        date={customEndDate ?? undefined}
                        onConfirm={({date}) => setCustomEndDate(date)}
                        label="Select end date"
                      />
                      <TouchableOpacity
                        style={styles.applyButton}
                        onPress={filterTransactions}>
                        <ListFilter size={18} color={colors.onPrimary} />
                        <Text style={styles.applyButtonText}>Apply Filter</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </Card>
              <View style={styles.transactionsHeader}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, styles.sectionTitleFlush]}>
                    Transactions
                  </Text>
                  {filteredTransactions.length > 0 && (
                    <TouchableOpacity
                      onPress={handleExportCSV}
                      style={styles.exportButton}>
                      <ShareIcon size={24} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </>
          }
        />
      </View>
    </SafeAreaProvider>
  );
};

export default SplitTransactionScreen;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    scrollView: {flex: 1},
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
      color: colors.primary,
      fontFamily: 'Kufam-SemiBoldItalic',
      marginLeft: 12,
    },
    headerSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      fontFamily: 'Lato-Regular',
    },
    searchContainer: {paddingHorizontal: 20, marginBottom: 20},
    filterCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginHorizontal: 20,
      marginBottom: 20,
    },
    cardContent: {padding: 20},
    filterTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textStrong,
      marginBottom: 15,
      fontFamily: 'Lato-Bold',
    },
    filterScrollContainer: {marginBottom: 15},
    filterContainer: {flexDirection: 'row', paddingHorizontal: 5},
    filterButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginRight: 12,
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    filterButtonActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    filterButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontFamily: 'Lato-Regular',
      textAlign: 'center',
    },
    filterButtonTextActive: {
      color: colors.primary,
      fontWeight: 'bold',
      fontFamily: 'Lato-Bold',
    },
    customDateContainer: {
      marginTop: 10,
      paddingTop: 15,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    customRangeLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textStrong,
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
      color: colors.textSecondary,
      marginBottom: 8,
      fontFamily: 'Lato-Regular',
    },
    dateInput: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dateInputText: {
      fontSize: 14,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
    },
    dateInputPlaceholder: {color: colors.textPlaceholder},
    applyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryFill,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      elevation: Platform.OS === 'android' ? 0 : 1,
      shadowColor: colors.primaryFill,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.15,
      shadowRadius: 2,
    },
    applyButtonText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '600',
      marginLeft: 8,
      fontFamily: 'Lato-Bold',
    },
    transactionsCard: {
      marginBottom: 10,
      backgroundColor: colors.surface,
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
    transactionsCardTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    transactionsCardSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    transactionsCardDate: {fontSize: 12, color: colors.textMuted},
    transactionsCardAmount: {
      fontSize: 16,
      fontWeight: '500',
      paddingRight: 12,
      alignSelf: 'center',
    },
    categoryTag: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      marginTop: 5,
      alignSelf: 'flex-start',
    },
    categoryText: {
      fontSize: 12,
      color: colors.primary,
      fontFamily: 'Lato-Regular',
    },
    transactionsHeader: {paddingHorizontal: 20},
    transactionsRow: {paddingHorizontal: 20},
    listFooter: {height: 30},
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    exportButton: {padding: 4},
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textStrong,
      marginBottom: 15,
      fontFamily: 'Kufam-SemiBoldItalic',
    },
    sectionTitleFlush: {marginBottom: 0},
    emptyStateCard: {backgroundColor: colors.surface, borderRadius: 16},
    emptyState: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyStateText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 15,
      marginBottom: 5,
      fontFamily: 'Lato-Bold',
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      fontFamily: 'Lato-Regular',
    },
    cardAndroid: {borderWidth: 1, borderColor: colors.cardBorder},
  });
