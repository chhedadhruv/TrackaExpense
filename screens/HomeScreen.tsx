import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  TextInput,
  Image,
  RefreshControl,
} from 'react-native';
import React, {useState, useEffect, useCallback, useRef} from 'react';
import {ActivityIndicator, Card} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {getAuth} from '@react-native-firebase/auth';
import {
  collection,
  doc as fsDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from '@react-native-firebase/firestore';
import moment from 'moment';
import {DatePickerModal} from 'react-native-paper-dates';
import {KeyboardAvoidingModal} from '../src/components/KeyboardAvoidingModal';
import {useCurrency} from '../utils/CurrencyUtil';
import {getCategoryIcon} from '../utils/CategoryData';
import {FONT, SPACING} from '../src/constants/theme';
import {useTheme, useThemedStyles, type ThemeColors} from '../src/theme';
import {formatInputAmount} from '../src/utils/formatters';
import {majorOf, totalMajor} from '../src/utils/amounts';
import {fromMinor, tryToMinor} from '../src/utils/money';
import type {TransactionDocument, UserDocument} from '../src/types';
import type {McIconName} from '../src/types/icons';

type TimeRange =
  | 'all'
  | '7days'
  | '30days'
  | '3months'
  | '6months'
  | 'year'
  | 'custom';

const TIME_RANGES: {key: TimeRange; label: string; icon: McIconName}[] = [
  {key: 'all', label: 'All Time', icon: 'format-list-bulleted'},
  {key: '7days', label: 'Last 7 Days', icon: 'calendar-week'},
  {key: '30days', label: 'Last 30 Days', icon: 'calendar-month'},
  {key: '3months', label: 'Last 3 Months', icon: 'calendar-range'},
  {key: '6months', label: 'Last 6 Months', icon: 'calendar-clock'},
  {key: 'year', label: 'Last Year', icon: 'calendar'},
  {key: 'custom', label: 'Custom Range', icon: 'calendar-range'},
];

const RECENT_LIMIT = 5;

const HomeScreen = ({navigation}: {navigation: any}) => {
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const {currency, formatAmount} = useCurrency();
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [transactions, setTransactions] = useState<TransactionDocument[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<
    TransactionDocument[]
  >([]);
  const [userLoading, setUserLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);
  const [editBalanceVisible, setEditBalanceVisible] = useState(false);
  const [newBalanceInput, setNewBalanceInput] = useState('');
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [balanceSaved, setBalanceSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const currentUser = getAuth().currentUser!;
  const uid = currentUser.uid;
  const saveSuccessTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (saveSuccessTimeout.current) {
        clearTimeout(saveSuccessTimeout.current);
      }
    },
    [],
  );

  // Realtime listener for user data
  useEffect(() => {
    setUserLoading(true);
    const unsub = onSnapshot(
      fsDoc(getFirestore(), 'users', uid),
      doc => {
        if (doc.exists()) {
          const data = doc.data() as UserDocument;
          setUserData(data);
          setError(null);
        }
        setUserLoading(false);
      },
      _err => {
        setError(
          'Error fetching user data. Please check your connection and try again.',
        );
        setUserLoading(false);
      },
    );
    return () => unsub();
  }, [retryKey, uid]);

  // Realtime listener for transactions
  useEffect(() => {
    setTxLoading(true);
    const unsub = onSnapshot(
      query(
        collection(getFirestore(), 'users', uid, 'transactions'),
        orderBy('createdAt', 'desc'),
      ),
      snapshot => {
        const arr = snapshot.docs.map(doc => ({
          id: doc.id,
          userId: uid,
          ...doc.data(),
        })) as TransactionDocument[];
        setTransactions(arr);
        setTxLoading(false);
      },
      _err => {
        setError('Error fetching transactions. Please check your connection.');
        setTxLoading(false);
      },
    );
    return () => unsub();
  }, [retryKey, uid]);

  const filterByRange = useCallback(
    (txns: TransactionDocument[], range: TimeRange): TransactionDocument[] => {
      if (range === 'all') {
        return txns;
      }
      if (range === 'custom') {
        if (!customStartDate || !customEndDate) {
          return txns;
        }
        return txns.filter(t =>
          moment(t.date).isBetween(
            customStartDate,
            customEndDate,
            undefined,
            '[]',
          ),
        );
      }
      const cutoff = new Date();
      const shifts: Record<Exclude<TimeRange, 'all' | 'custom'>, () => void> = {
        '7days': () => cutoff.setDate(cutoff.getDate() - 7),
        '30days': () => cutoff.setDate(cutoff.getDate() - 30),
        '3months': () => cutoff.setMonth(cutoff.getMonth() - 3),
        '6months': () => cutoff.setMonth(cutoff.getMonth() - 6),
        year: () => cutoff.setFullYear(cutoff.getFullYear() - 1),
      };
      shifts[range as Exclude<TimeRange, 'all' | 'custom'>]?.();
      return txns.filter(t => new Date(t.date) >= cutoff);
    },
    [customStartDate, customEndDate],
  );

  useEffect(() => {
    setFilteredTransactions(filterByRange(transactions, timeRange));
  }, [transactions, timeRange, filterByRange]);

  useEffect(() => {
    // Summed as integer minor units so the totals are exact.
    setTotalIncome(
      totalMajor(
        filteredTransactions.filter(t => t.type === 'income'),
        currency.code,
      ),
    );
    setTotalExpense(
      totalMajor(
        filteredTransactions.filter(t => t.type === 'expense'),
        currency.code,
      ),
    );
  }, [filteredTransactions, currency.code]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleSaveBalance = async () => {
    const parsed = parseFloat(newBalanceInput);
    if (isNaN(parsed) || parsed > 999999999) {
      return;
    }
    setBalanceSaving(true);
    try {
      await updateDoc(fsDoc(getFirestore(), 'users', uid), {balance: parsed});
      setBalanceSaved(true);
      saveSuccessTimeout.current = setTimeout(() => {
        setBalanceSaved(false);
        setEditBalanceVisible(false);
      }, 800);
    } catch (err) {
    } finally {
      setBalanceSaving(false);
    }
  };

  const loading = userLoading || txLoading;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={48}
          color={colors.expense}
        />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            setRetryKey(k => k + 1);
          }}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const balance = userData?.balance ?? 0;
  const recentTransactions = filteredTransactions.slice(0, RECENT_LIMIT);
  const hasMore = filteredTransactions.length > RECENT_LIMIT;
  const customRangeIncomplete =
    timeRange === 'custom' && (!customStartDate || !customEndDate);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }>
        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroGreeting}>
                Hello, {userData?.name?.split(' ')[0] || 'User'}!
              </Text>
              <Text style={styles.heroSubGreeting}>
                Track your expenses today
              </Text>
            </View>
            {userData?.userImg ? (
              <Image
                source={{uri: userData.userImg}}
                style={styles.heroAvatar}
              />
            ) : (
              <View style={styles.heroAvatarInitials}>
                <Text style={styles.heroAvatarInitialsText}>
                  {(userData?.name || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.balanceHeroCard}>
            <Text style={styles.balanceHeroLabel}>Total Balance</Text>
            <View style={styles.balanceHeroRow}>
              <Text
                style={[
                  styles.balanceHeroAmount,
                  {color: balance >= 0 ? colors.income : colors.expense},
                ]}>
                {balance < 0
                  ? `-${formatAmount(Math.abs(balance))}`
                  : formatAmount(balance)}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setBalanceSaved(false);
                  // Round to the currency's decimals so stored float noise such as
                  // -9.994999999999997 is not shown in the field.
                  const balanceMinor = tryToMinor(balance, currency.code);
                  setNewBalanceInput(
                    balanceMinor === null
                      ? String(balance)
                      : fromMinor(balanceMinor, currency.code),
                  );
                  setEditBalanceVisible(true);
                }}
                style={styles.balanceEditBtn}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.cardSection}>
          <Card
            style={[
              styles.summaryCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 2}>
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <MaterialCommunityIcons
                    name="arrow-down-bold"
                    size={20}
                    color={colors.income}
                  />
                </View>
                <Text style={styles.cardTitle}>Total Income</Text>
              </View>
              <Text style={[styles.cardAmount, {color: colors.income}]}>
                {formatAmount(totalIncome)}
              </Text>
            </View>
          </Card>
          <Card
            style={[
              styles.summaryCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 2}>
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <MaterialCommunityIcons
                    name="arrow-up-bold"
                    size={20}
                    color={colors.expense}
                  />
                </View>
                <Text style={styles.cardTitle}>Total Expense</Text>
              </View>
              <Text style={[styles.cardAmount, {color: colors.expense}]}>
                {formatAmount(totalExpense)}
              </Text>
            </View>
          </Card>
        </View>

        {/* Time Range Filter */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}>
            {TIME_RANGES.map(({key, label, icon}) => {
              const active = timeRange === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setTimeRange(key)}
                  style={[
                    styles.filterButton,
                    active && styles.filterButtonActive,
                  ]}>
                  <MaterialCommunityIcons
                    name={icon}
                    size={16}
                    color={active ? colors.onPrimary : colors.primary}
                  />
                  <Text
                    style={
                      active
                        ? styles.filterButtonTextActive
                        : styles.filterButtonText
                    }>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {timeRange === 'custom' && (
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
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.dateInputText,
                      !customStartDate && styles.dateInputPlaceholder,
                    ]}>
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
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.dateInputText,
                      !customEndDate && styles.dateInputPlaceholder,
                    ]}>
                    {customEndDate
                      ? moment(customEndDate).format('MMM DD, YYYY')
                      : 'End Date'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            {customRangeIncomplete && (
              <Text style={styles.customRangeHint}>
                Select both dates to filter transactions
              </Text>
            )}
          </View>
        )}

        <DatePickerModal
          locale="en"
          mode="single"
          visible={startDatePickerVisible}
          onDismiss={() => setStartDatePickerVisible(false)}
          date={customStartDate ?? new Date()}
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
          date={customEndDate ?? new Date()}
          onConfirm={(params: any) => {
            setEndDatePickerVisible(false);
            setCustomEndDate(params.date);
          }}
          saveLabel="Confirm"
          label="Select end date"
          uppercase={false}
          {...(Platform.OS === 'ios' && {presentationStyle: 'pageSheet'})}
        />

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity
              style={[styles.quickActionButton, styles.addIncomeButton]}
              onPress={() => navigation.navigate('AddIncome')}>
              <MaterialCommunityIcons
                name="cash-plus"
                size={20}
                color={colors.onPrimary}
              />
              <Text style={styles.quickActionText}>Add Income</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionButton, styles.addExpenseButton]}
              onPress={() => navigation.navigate('AddExpense')}>
              <MaterialCommunityIcons
                name="cash-minus"
                size={20}
                color={colors.onPrimary}
              />
              <Text style={styles.quickActionText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.transactionsSection}>
          <View style={styles.transactionsHeader}>
            <View>
              <Text style={styles.transactionsHeaderText}>
                Recent Transactions
              </Text>
              <Text style={styles.transactionsSubHeaderText}>
                {hasMore
                  ? `${RECENT_LIMIT} of ${filteredTransactions.length}`
                  : `${filteredTransactions.length} transaction${
                      filteredTransactions.length !== 1 ? 's' : ''
                    }`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Transaction')}
              style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>See All</Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.transactionsList}>
            {recentTransactions.length > 0 ? (
              recentTransactions.map(transaction => (
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
                          name={
                            transaction.source === 'split' &&
                            transaction.category === 'Settlement'
                              ? 'handshake'
                              : transaction.source === 'split'
                              ? 'account-group'
                              : getCategoryIcon(transaction.category)
                          }
                          size={25}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.transactionsCardMeta}>
                        <Text
                          style={styles.transactionsCardTitle}
                          numberOfLines={1}>
                          {transaction.title}
                        </Text>
                        <View style={styles.transactionsCardDateAndTime}>
                          <Text style={styles.transactionsCardDate}>
                            {transaction.date}
                          </Text>
                        </View>
                        {transaction.source === 'split' && (
                          <Text style={styles.splitRoleLabel}>
                            {transaction.splitRole === 'payer'
                              ? 'Given'
                              : transaction.splitRole === 'participant'
                              ? 'Taken'
                              : 'Settled'}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.transactionsCardAmount}>
                      <Text
                        style={
                          transaction.type === 'income'
                            ? styles.amountIncome
                            : styles.amountExpense
                        }>
                        {transaction.type === 'income' ? '+ ' : '- '}
                        {formatAmount(majorOf(transaction, currency.code))}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="note-text-outline"
                  size={48}
                  color={colors.iconMuted}
                />
                {transactions.length === 0 ? (
                  <>
                    <Text style={styles.emptyStateText}>
                      No transactions yet
                    </Text>
                    <Text style={styles.emptyStateSubText}>
                      Add your first transaction to get started
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyStateText}>
                      No transactions in this time range
                    </Text>
                    <Text style={styles.emptyStateSubText}>
                      Try changing the time range above to see older
                      transactions
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Edit Balance Modal */}
      <KeyboardAvoidingModal
        visible={editBalanceVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditBalanceVisible(false)}
        overlayStyle={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit Balance</Text>
          <Text style={styles.modalSubtitle}>
            Set your current account balance
          </Text>
          <TextInput
            style={styles.modalInput}
            value={formatInputAmount(newBalanceInput)}
            onChangeText={text => setNewBalanceInput(text.replace(/,/g, ''))}
            keyboardType="numeric"
            placeholder="Enter balance"
            placeholderTextColor={colors.textPlaceholder}
            autoFocus
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setEditBalanceVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalSaveBtn,
                balanceSaved && styles.modalSaveBtnSuccess,
              ]}
              onPress={handleSaveBalance}
              disabled={balanceSaving || balanceSaved}>
              <Text style={styles.modalSaveText}>
                {balanceSaved ? 'Saved!' : balanceSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingModal>
    </View>
  );
};

export default HomeScreen;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    splitRoleLabel: {
      fontSize: 10,
      color: colors.primary,
      fontWeight: '600',
      marginTop: 1,
      fontFamily: FONT.bold,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    container: {flex: 1, backgroundColor: colors.background},
    scrollContainer: {flex: 1},
    heroSection: {
      backgroundColor: colors.primaryFill,
      paddingHorizontal: SPACING.md + 4,
      paddingTop: SPACING.md + 4,
      paddingBottom: SPACING.lg + 4,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      marginBottom: SPACING.md + 4,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md + 4,
    },
    heroGreeting: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.onPrimary,
      fontFamily: FONT.heading,
    },
    heroSubGreeting: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.75)',
      marginTop: SPACING.xs,
      fontFamily: FONT.regular,
    },
    heroAvatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.6)',
    },
    heroAvatarInitials: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.5)',
    },
    heroAvatarInitialsText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.onPrimary,
      fontFamily: FONT.bold,
    },
    balanceHeroCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: SPACING.md + 4,
      paddingVertical: SPACING.md,
    },
    balanceHeroLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontFamily: FONT.regular,
      marginBottom: SPACING.sm - 2,
    },
    balanceHeroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    balanceHeroAmount: {
      fontSize: 30,
      fontWeight: 'bold',
      fontFamily: FONT.bold,
    },
    balanceEditBtn: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 8,
      padding: SPACING.sm,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SPACING.md + 4,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: SPACING.lg,
      width: '100%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textStrong,
      fontFamily: FONT.heading,
      marginBottom: SPACING.xs,
    },
    modalSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      fontFamily: FONT.regular,
      marginBottom: SPACING.md + 4,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: SPACING.md,
      paddingVertical: 12,
      fontSize: 18,
      color: colors.textStrong,
      fontFamily: FONT.regular,
      backgroundColor: colors.surfaceMuted,
      marginBottom: SPACING.md + 4,
    },
    modalActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 12},
    modalCancelBtn: {
      paddingHorizontal: SPACING.md + 4,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    modalCancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
      fontFamily: FONT.bold,
    },
    modalSaveBtn: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.primaryFill,
    },
    modalSaveBtnSuccess: {backgroundColor: colors.incomeFill},
    modalSaveText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.onPrimary,
      fontFamily: FONT.bold,
    },
    filterSection: {
      marginHorizontal: SPACING.md + 4,
      marginBottom: SPACING.md + 4,
    },
    filterScrollView: {flexGrow: 0},
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.surface,
      marginRight: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    filterButtonActive: {
      backgroundColor: colors.primaryFill,
      borderColor: colors.primaryFill,
    },
    filterButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      marginLeft: SPACING.sm - 2,
      fontFamily: FONT.bold,
    },
    filterButtonTextActive: {
      color: colors.onPrimary,
      marginLeft: SPACING.sm - 2,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: FONT.bold,
    },
    customDateSection: {
      marginHorizontal: SPACING.md + 4,
      marginBottom: SPACING.md + 4,
      padding: SPACING.md,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    customDateTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textStrong,
      marginBottom: 12,
      fontFamily: FONT.bold,
    },
    customDateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    customRangeHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: SPACING.sm,
      textAlign: 'center',
      fontFamily: FONT.regular,
    },
    dateInput: {
      flex: 1,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    dateInputContent: {flexDirection: 'row', alignItems: 'center'},
    dateInputText: {
      fontSize: 14,
      color: colors.textStrong,
      marginLeft: SPACING.sm,
      fontFamily: FONT.regular,
      fontWeight: '500',
    },
    dateInputPlaceholder: {color: colors.textPlaceholder},
    dateSeparator: {marginHorizontal: 10},
    dateSeparatorText: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: FONT.regular,
    },
    cardSection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginHorizontal: SPACING.md + 4,
      marginBottom: SPACING.md + 4,
    },
    summaryCard: {
      width: '48%',
      borderRadius: 16,
      backgroundColor: colors.surface,
    },
    cardContent: {padding: SPACING.md},
    cardHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
    cardIcon: {
      width: 32,
      height: 32,
      borderRadius: SPACING.sm,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.sm,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      fontFamily: FONT.regular,
    },
    cardAmount: {fontSize: 20, fontWeight: 'bold', fontFamily: FONT.bold},
    quickActionsSection: {
      marginTop: SPACING.md + 4,
      paddingHorizontal: SPACING.md + 4,
    },
    quickActionsTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textStrong,
      marginBottom: 15,
      fontFamily: FONT.heading,
    },
    quickActionsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    quickActionButton: {
      flex: 0.48,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addIncomeButton: {backgroundColor: colors.incomeFill},
    addExpenseButton: {backgroundColor: colors.expenseFill},
    quickActionText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.onPrimary,
      fontFamily: FONT.bold,
      marginLeft: SPACING.sm,
    },
    transactionsSection: {marginTop: 10, paddingHorizontal: SPACING.md + 4},
    transactionsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    transactionsHeaderText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textStrong,
      fontFamily: FONT.heading,
    },
    transactionsSubHeaderText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
      fontFamily: FONT.regular,
    },
    seeAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 12,
      paddingVertical: SPACING.sm,
      borderRadius: 10,
    },
    seeAllText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      marginRight: SPACING.xs,
      fontFamily: FONT.bold,
    },
    transactionsList: {marginBottom: 30},
    transactionsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 18,
      marginVertical: SPACING.sm - 2,
      backgroundColor: colors.surface,
      borderRadius: 16,
    },
    transactionsCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    },
    transactionsCardDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    transactionsCardIcon: {
      width: 50,
      height: 50,
      borderRadius: 14,
      backgroundColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 15,
    },
    transactionsCardMeta: {flexDirection: 'column', flex: 1},
    transactionsCardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textStrong,
      fontFamily: FONT.bold,
    },
    transactionsCardDateAndTime: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACING.xs,
    },
    transactionsCardDate: {
      fontSize: 13,
      color: colors.textMuted,
      fontFamily: FONT.regular,
    },
    transactionsCardAmount: {
      flexDirection: 'column',
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    amountIncome: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.income,
      fontFamily: FONT.bold,
    },
    amountExpense: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.expense,
      fontFamily: FONT.bold,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: SPACING.md + 4,
    },
    emptyStateText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 15,
      fontFamily: FONT.bold,
    },
    emptyStateSubText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: SPACING.sm,
      fontFamily: FONT.regular,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: SPACING.md + 4,
    },
    errorText: {
      fontSize: 16,
      color: colors.expense,
      textAlign: 'center',
      fontFamily: FONT.regular,
      marginTop: 15,
      marginBottom: SPACING.md + 4,
    },
    retryButton: {
      backgroundColor: colors.primaryFill,
      paddingHorizontal: SPACING.lg,
      paddingVertical: 12,
      borderRadius: 8,
      elevation: Platform.OS === 'android' ? 0 : 2,
      shadowColor: colors.shadow,
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    retryButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      fontFamily: FONT.bold,
    },
    cardAndroid: {borderWidth: 1, borderColor: colors.cardBorder},
  });
