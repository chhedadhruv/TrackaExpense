import React, {useState, useEffect, useCallback} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {Searchbar} from 'react-native-paper';
import ReceiptText from 'lucide-react-native/icons/receipt-text';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query as fsQuery,
} from '@react-native-firebase/firestore';
import moment from 'moment';
import {DatePickerModal} from 'react-native-paper-dates';
import {getAuth} from '@react-native-firebase/auth';
import Share from 'react-native-share';
import {File, Paths} from 'expo-file-system';
import {useCurrency} from '../utils/CurrencyUtil';
import {majorOf} from '../src/utils/amounts';
import {getCategoryIcon} from '../utils/CategoryData';
import {useTheme, useThemedStyles, type ThemeColors} from '../src/theme';
import {getConfig} from '../src/services/RemoteConfigService';
import * as AnalyticsService from '../src/services/AnalyticsService';
import type {TransactionDocument} from '../src/types';
import type {McIconName} from '../src/types/icons';
import {snackbar} from '../src/utils/snackbarStore';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../src/components/ScreenState';
import {useLoadFailure} from '../src/hooks/useLoadFailure';
import TagChips from '../src/components/TagChips';

type FilterType = 'all' | '7days' | '30days' | 'custom';

const FILTERS: FilterType[] = ['all', '7days', '30days', 'custom'];

const FILTER_ICONS: Record<FilterType, McIconName> = {
  all: 'format-list-bulleted',
  '7days': 'calendar-week',
  '30days': 'calendar-month',
  custom: 'calendar-range',
};

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  '7days': 'Last 7 Days',
  '30days': 'Last 30 Days',
  custom: 'Custom Range',
};

const TransactionScreen = ({navigation}: {navigation: any}) => {
  const {colors} = useTheme();
  const searchStyles = useThemedStyles(createSearchStyles);
  const {currency, formatAmount} = useCurrency();
  const [loading, setLoading] = useState(true);
  const {failed, succeed, fail} = useLoadFailure();
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

  const fetchTransactions = useCallback(async () => {
    try {
      const currentUser = getAuth().currentUser!;
      const snapshot = await getDocs(
        fsQuery(
          collection(getFirestore(), 'users', currentUser.uid, 'transactions'),
          orderBy('createdAt', 'desc'),
          // Same newest-first rows as reading everything and slicing, with far fewer reads.
          limit(getConfig().max_transactions_displayed),
        ),
      );
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        userId: currentUser.uid,
        ...doc.data(),
      })) as TransactionDocument[];
      setTransactions(fetched);
      succeed();
    } catch (e) {
      // A failed load must not read as "No transactions found": show the error state instead.
      fail(e);
    } finally {
      setLoading(false);
    }
  }, [succeed, fail]);

  // Refetch whenever the screen is shown again, so a delete or edit made on the detail screen
  // appears here when you come back (it used to load only once).
  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [fetchTransactions]),
  );

  useEffect(() => {
    filterTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, transactions, customStartDate, customEndDate]);

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
      snackbar.info('No transactions to export');
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
        snackbar.error('Failed to create CSV file');
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
          snackbar.error('Failed to share file');
        }
      }
    } catch (_) {
      snackbar.error('Failed to export transactions. Please try again.');
    }
  };

  if (loading) {
    return <LoadingState message="Loading transactions..." />;
  }

  if (failed) {
    return (
      <ErrorState
        title="Could not load transactions"
        onRetry={() => {
          setLoading(true);
          fetchTransactions();
        }}
      />
    );
  }

  const noResults = filteredTransactions.length === 0;

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-divider bg-surface px-5 py-5">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text
              accessibilityRole="header"
              className="mb-1 font-heading text-2xl font-bold text-text-strong">
              All Transactions
            </Text>
            <Text className="font-sans text-sm text-text-secondary">
              {filteredTransactions.length} transaction
              {filteredTransactions.length !== 1 ? 's' : ''} found
            </Text>
          </View>
          <TouchableOpacity
            className="flex-row items-center rounded-[10px] bg-primary-soft px-3 py-2"
            accessibilityRole="button"
            accessibilityLabel="Download transactions as CSV"
            accessibilityState={{disabled: noResults}}
            onPress={downloadCSV}
            disabled={noResults}>
            <MaterialCommunityIcons
              name="download"
              size={20}
              color={noResults ? colors.textPlaceholder : colors.primary}
            />
            <Text
              className={`ml-1.5 font-sans-bold text-sm ${
                noResults ? 'text-text-placeholder' : 'text-primary'
              }`}>
              Download CSV
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        data={filteredTransactions}
        keyExtractor={(transaction, index) => transaction.id ?? String(index)}
        initialNumToRender={12}
        windowSize={7}
        renderItem={({item: transaction}) => (
          <View className="px-5">
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('TransactionDetail', {transaction})
              }
              className="mb-3 flex-row items-center justify-between rounded-2xl border border-card-border bg-surface p-4 ios:shadow-md">
              <View className="flex-1 flex-row items-center">
                <View className="mr-3 h-[50px] w-[50px] items-center justify-center rounded-[14px] bg-primary-soft">
                  <MaterialCommunityIcons
                    name={getCategoryIcon(transaction.category)}
                    size={25}
                    color={colors.primary}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="mb-0.5 font-sans-bold text-base font-semibold text-text-strong"
                    numberOfLines={1}>
                    {transaction.title}
                  </Text>
                  <Text className="mb-1 font-sans text-[13px] text-text-secondary">
                    {moment((transaction.createdAt as any).toDate()).format(
                      'MMM D, YYYY',
                    )}
                  </Text>
                  {transaction.category ? (
                    <View className="self-start rounded-md bg-primary-soft px-2 py-0.5">
                      <Text className="font-sans-bold text-xs text-primary">
                        {transaction.category}
                      </Text>
                    </View>
                  ) : null}
                  <TagChips tags={transaction.tags} max={3} className="mt-1" />
                </View>
              </View>
              <Text
                className={`ml-2 font-sans-bold text-base font-bold ${
                  transaction.type === 'income' ? 'text-income' : 'text-expense'
                }`}>
                {transaction.type === 'income' ? '+ ' : '- '}
                {formatAmount(majorOf(transaction, currency.code))}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon={ReceiptText}
            title="No transactions found"
            message={
              searchQuery
                ? 'Try adjusting your search terms'
                : 'Transactions will appear here once you add them'
            }
          />
        }
        ListFooterComponent={<View className="h-[30px]" />}
        ListHeaderComponent={
          <>
            <View className="px-5 pt-5">
              <Searchbar
                placeholder="Search by title, amount, or category..."
                placeholderTextColor={colors.textPlaceholder}
                onChangeText={handleSearch}
                value={searchQuery}
                style={searchStyles.searchBar}
                inputStyle={searchStyles.searchInput}
                iconColor={colors.primary}
              />
            </View>

            <View className="px-5 pt-5">
              <Text className="mb-2.5 font-sans-bold text-base font-semibold text-text-strong">
                Filter by period
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {FILTERS.map(f => {
                  const active = filter === f;
                  return (
                    <TouchableOpacity
                      key={f}
                      accessibilityRole="button"
                      accessibilityState={{selected: active}}
                      onPress={() => {
                        setFilter(f);
                        AnalyticsService.logTransactionFilterChanged(f);
                      }}
                      className={`mr-2.5 flex-row items-center rounded-full border px-3.5 py-2 ${
                        active
                          ? 'border-primary-fill bg-primary-fill'
                          : 'border-card-border bg-surface'
                      }`}>
                      <MaterialCommunityIcons
                        name={FILTER_ICONS[f]}
                        size={16}
                        color={active ? colors.onPrimary : colors.primary}
                      />
                      <Text
                        className={`ml-1.5 font-sans-bold text-[13px] font-semibold ${
                          active ? 'text-on-primary' : 'text-primary'
                        }`}>
                        {FILTER_LABELS[f]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {filter === 'custom' && (
              <View className="mx-5 mt-5 rounded-2xl border border-card-border bg-surface p-5">
                <Text className="mb-[15px] font-sans-bold text-base font-semibold text-text-strong">
                  Select Date Range
                </Text>
                <View className="flex-row items-center">
                  <TouchableOpacity
                    className="flex-1 rounded-xl border border-card-border bg-surface-muted p-3"
                    accessibilityRole="button"
                    onPress={() => setStartDatePickerVisible(true)}>
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons
                        name="calendar-start"
                        size={20}
                        color={colors.primary}
                      />
                      <Text className="ml-2 font-sans text-sm text-text">
                        {customStartDate
                          ? moment(customStartDate).format('MMM DD, YYYY')
                          : 'Start Date'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <View className="px-2.5">
                    <Text className="font-sans text-sm text-text-secondary">
                      to
                    </Text>
                  </View>
                  <TouchableOpacity
                    className="flex-1 rounded-xl border border-card-border bg-surface-muted p-3"
                    accessibilityRole="button"
                    onPress={() => setEndDatePickerVisible(true)}>
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons
                        name="calendar-end"
                        size={20}
                        color={colors.primary}
                      />
                      <Text className="ml-2 font-sans text-sm text-text">
                        {customEndDate
                          ? moment(customEndDate).format('MMM DD, YYYY')
                          : 'End Date'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
                {customStartDate && customEndDate && (
                  <TouchableOpacity
                    className="mt-[15px] flex-row items-center justify-center rounded-xl bg-primary-fill py-3"
                    accessibilityRole="button"
                    onPress={filterTransactions}>
                    <MaterialCommunityIcons
                      name="check"
                      size={20}
                      color={colors.onPrimary}
                    />
                    <Text className="ml-2 font-sans-bold text-base font-semibold text-on-primary">
                      Apply Filter
                    </Text>
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
                  onConfirm={(params: any) => {
                    setEndDatePickerVisible(false);
                    setCustomEndDate(params.date);
                  }}
                  saveLabel="Confirm"
                  label="Select end date"
                  uppercase={false}
                  {...(Platform.OS === 'ios' && {
                    presentationStyle: 'pageSheet',
                  })}
                />
              </View>
            )}

            <View className="h-5" />
          </>
        }
      />
    </View>
  );
};

export default TransactionScreen;

// The Paper search bar takes style objects, not class names.
const createSearchStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    searchBar: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      elevation: 0,
    },
    searchInput: {
      color: colors.text,
      fontFamily: 'Lato-Regular',
      fontSize: 15,
    },
  });
