import {View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform, Modal, TextInput, Image, KeyboardAvoidingView} from 'react-native';
import React, {useState, useEffect, useCallback, useRef} from 'react';
import {ActivityIndicator, Card} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useFocusEffect} from '@react-navigation/native';
import moment from 'moment';
import {DatePickerModal} from 'react-native-paper-dates';
import {useCurrency} from '../utils/CurrencyUtil';
import {getCategoryIcon} from '../utils/CategoryData';
import {PRIMARY_COLOR, BACKGROUND_COLOR, INCOME_COLOR, EXPENSE_COLOR} from '../src/constants/theme';
import {formatInputAmount} from '../src/utils/formatters';
import type {TransactionDocument, UserDocument} from '../src/types';

type TimeRange = 'all' | '7days' | '30days' | '3months' | '6months' | 'year' | 'custom';

const TIME_RANGES: {key: TimeRange; label: string; icon: string}[] = [
  {key: 'all', label: 'All Time', icon: 'format-list-bulleted'},
  {key: '7days', label: 'Last 7 Days', icon: 'calendar-week'},
  {key: '30days', label: 'Last 30 Days', icon: 'calendar-month'},
  {key: '3months', label: 'Last 3 Months', icon: 'calendar-range'},
  {key: '6months', label: 'Last 6 Months', icon: 'calendar-clock'},
  {key: 'year', label: 'Last Year', icon: 'calendar'},
  {key: 'custom', label: 'Custom Range', icon: 'calendar-range'},
];

const HomeScreen = ({navigation}: {navigation: any}) => {
  const {formatAmount} = useCurrency();
  const [userData, setUserData] = useState<UserDocument | null>(null);
  const [totalExpense, setTotalExpense] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [transactions, setTransactions] = useState<TransactionDocument[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<TransactionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);
  const [editBalanceVisible, setEditBalanceVisible] = useState(false);
  const [newBalanceInput, setNewBalanceInput] = useState('');
  const [balanceSaving, setBalanceSaving] = useState(false);

  const currentUser = auth().currentUser!;
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current); }, []);

  const filterByRange = useCallback(
    (txns: TransactionDocument[], range: TimeRange): TransactionDocument[] => {
      if (range === 'all') return txns;
      if (range === 'custom') {
        if (!customStartDate || !customEndDate) return txns;
        return txns.filter(t => moment(t.date).isBetween(customStartDate, customEndDate, undefined, '[]'));
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

  const fetchTransactions = async () => {
    try {
      const snapshot = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('transactions')
        .get();
      const arr = snapshot.docs.map(doc => ({
        id: doc.id,
        userId: currentUser.uid,
        ...doc.data(),
      })) as TransactionDocument[];
      setTransactions(arr.sort((a, b) => ((b.createdAt as any)?.seconds ?? 0) - ((a.createdAt as any)?.seconds ?? 0)));
    } catch (_) {
      setError('Error fetching transactions');
    }
  };

  const getUserData = async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    try {
      const snap = await firestore().collection('users').doc(currentUser.uid).get();
      if (snap.exists) {
        setUserData(snap.data() as UserDocument);
        setLoading(false);
      } else if (retryCount < 2) {
        retryTimeoutRef.current = setTimeout(() => getUserData(retryCount + 1), 2000 * (retryCount + 1));
      } else {
        setError('User data not found. Please try signing in again.');
        setLoading(false);
      }
    } catch (_) {
      if (retryCount < 1) {
        retryTimeoutRef.current = setTimeout(() => getUserData(retryCount + 1), 2000);
      } else {
        setError('Error fetching user data. Please check your connection and try again.');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const t = setTimeout(() => { getUserData(); fetchTransactions(); }, 1000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = firestore()
      .collection('users')
      .doc(currentUser.uid)
      .onSnapshot(
        doc => { if (doc.exists) { setUserData(doc.data() as UserDocument); setError(null); setLoading(false); } },
        _ => { setError('Error fetching user data. Please check your connection and try again.'); setLoading(false); },
      );
    return () => unsub();
  }, []);

  useFocusEffect(useCallback(() => { getUserData(); fetchTransactions(); }, []));

  useEffect(() => {
    const nav = navigation.addListener('focus', () => { getUserData(); fetchTransactions(); });
    return nav;
  }, [navigation]);

  useEffect(() => {
    const filtered = filterByRange(transactions, timeRange);
    setFilteredTransactions(filtered);
  }, [transactions, timeRange, filterByRange]);

  useEffect(() => {
    const income = filteredTransactions.reduce((sum, t) =>
      t.type === 'income' && (t as any).source !== 'split' ? sum + (parseFloat(t.amount as any) || 0) : sum, 0);
    const expense = filteredTransactions.reduce((sum, t) =>
      t.type === 'expense' && (t as any).source !== 'split' ? sum + (parseFloat(t.amount as any) || 0) : sum, 0);
    setTotalIncome(income);
    setTotalExpense(expense);
  }, [filteredTransactions]);

  const handleSaveBalance = async () => {
    const parsed = parseFloat(newBalanceInput);
    if (isNaN(parsed) || parsed > 999999999) return;
    setBalanceSaving(true);
    try {
      await firestore().collection('users').doc(currentUser.uid).update({balance: parsed});
      setEditBalanceVisible(false);
    } catch (_) {
    } finally {
      setBalanceSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={EXPENSE_COLOR} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => getUserData()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const balance = userData?.balance ?? 0;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContainer}>
        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroGreeting}>Hello, {userData?.name?.split(' ')[0] || 'User'}!</Text>
              <Text style={styles.heroSubGreeting}>Track your expenses today</Text>
            </View>
            {userData?.userImg ? (
              <Image source={{uri: userData.userImg}} style={styles.heroAvatar} />
            ) : (
              <View style={styles.heroAvatarInitials}>
                <Text style={styles.heroAvatarInitialsText}>{(userData?.name || 'U')[0].toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View style={styles.balanceHeroCard}>
            <Text style={styles.balanceHeroLabel}>Total Balance</Text>
            <View style={styles.balanceHeroRow}>
              <Text style={[styles.balanceHeroAmount, {color: balance >= 0 ? INCOME_COLOR : EXPENSE_COLOR}]}>
                {balance < 0 ? '- ' : ''}{formatAmount(Math.abs(balance))}
              </Text>
              <TouchableOpacity
                onPress={() => { setNewBalanceInput(String(balance)); setEditBalanceVisible(true); }}
                style={styles.balanceEditBtn}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <MaterialCommunityIcons name="pencil-outline" size={18} color={PRIMARY_COLOR} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.cardSection}>
          <Card style={[styles.summaryCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 2}>
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}><MaterialCommunityIcons name="arrow-down" size={20} color={INCOME_COLOR} /></View>
                <Text style={styles.cardTitle}>Total Income</Text>
              </View>
              <Text style={[styles.cardAmount, {color: INCOME_COLOR}]}>{formatAmount(totalIncome)}</Text>
            </View>
          </Card>
          <Card style={[styles.summaryCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 2}>
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}><MaterialCommunityIcons name="arrow-up" size={20} color={EXPENSE_COLOR} /></View>
                <Text style={styles.cardTitle}>Total Expense</Text>
              </View>
              <Text style={[styles.cardAmount, {color: EXPENSE_COLOR}]}>{formatAmount(totalExpense)}</Text>
            </View>
          </Card>
        </View>

        {/* Time Range Filter */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
            {TIME_RANGES.map(({key, label, icon}) => {
              const active = timeRange === key;
              return (
                <TouchableOpacity key={key} onPress={() => setTimeRange(key)} style={[styles.filterButton, active && styles.filterButtonActive]}>
                  <MaterialCommunityIcons name={icon} size={16} color={active ? '#FFFFFF' : PRIMARY_COLOR} />
                  <Text style={active ? styles.filterButtonTextActive : styles.filterButtonText}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {timeRange === 'custom' && (
          <View style={styles.customDateSection}>
            <Text style={styles.customDateTitle}>Select Date Range</Text>
            <View style={styles.customDateContainer}>
              <TouchableOpacity style={styles.dateInput} onPress={() => setStartDatePickerVisible(true)}>
                <View style={styles.dateInputContent}>
                  <MaterialCommunityIcons name="calendar-start" size={20} color={PRIMARY_COLOR} />
                  <Text style={[styles.dateInputText, !customStartDate && styles.dateInputPlaceholder]}>
                    {customStartDate ? moment(customStartDate).format('MMM DD, YYYY') : 'Start Date'}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={styles.dateSeparator}><Text style={styles.dateSeparatorText}>to</Text></View>
              <TouchableOpacity style={styles.dateInput} onPress={() => setEndDatePickerVisible(true)}>
                <View style={styles.dateInputContent}>
                  <MaterialCommunityIcons name="calendar-end" size={20} color={PRIMARY_COLOR} />
                  <Text style={[styles.dateInputText, !customEndDate && styles.dateInputPlaceholder]}>
                    {customEndDate ? moment(customEndDate).format('MMM DD, YYYY') : 'End Date'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <DatePickerModal
          locale="en" mode="single" visible={startDatePickerVisible}
          onDismiss={() => setStartDatePickerVisible(false)}
          date={customStartDate ?? new Date()}
          onConfirm={(params: any) => { setStartDatePickerVisible(false); setCustomStartDate(params.date); }}
          saveLabel="Confirm" label="Select start date" uppercase={false}
          {...(Platform.OS === 'ios' && {presentationStyle: 'pageSheet'})}
        />
        <DatePickerModal
          locale="en" mode="single" visible={endDatePickerVisible}
          onDismiss={() => setEndDatePickerVisible(false)}
          date={customEndDate ?? new Date()}
          onConfirm={(params: any) => { setEndDatePickerVisible(false); setCustomEndDate(params.date); }}
          saveLabel="Confirm" label="Select end date" uppercase={false}
          {...(Platform.OS === 'ios' && {presentationStyle: 'pageSheet'})}
        />

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity style={[styles.quickActionButton, styles.addIncomeButton]} onPress={() => navigation.navigate('AddIncome')}>
              <MaterialCommunityIcons name="cash-plus" size={20} color="#FFFFFF" />
              <Text style={styles.quickActionText}>Add Income</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickActionButton, styles.addExpenseButton]} onPress={() => navigation.navigate('AddExpense')}>
              <MaterialCommunityIcons name="cash-minus" size={20} color="#FFFFFF" />
              <Text style={styles.quickActionText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.transactionsSection}>
          <View style={styles.transactionsHeader}>
            <View>
              <Text style={styles.transactionsHeaderText}>Recent Transactions</Text>
              <Text style={styles.transactionsSubHeaderText}>
                {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Transaction')} style={styles.seeAllButton}>
              <Text style={styles.seeAllText}>See All</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={PRIMARY_COLOR} />
            </TouchableOpacity>
          </View>
          <View style={styles.transactionsList}>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map(transaction => (
                <Card
                  key={transaction.id}
                  style={[styles.transactionsCard, Platform.OS === 'android' && styles.cardAndroid]}
                  elevation={Platform.OS === 'android' ? 0 : 2}
                  onPress={() => navigation.navigate('TransactionDetail', {transaction})}>
                  <View style={styles.transactionsCardContent}>
                    <View style={styles.transactionsCardDetails}>
                      <View style={styles.transactionsCardIcon}>
                        <MaterialCommunityIcons
                          name={
                            (transaction as any).source === 'split' && transaction.category === 'Settlement'
                              ? 'handshake'
                              : (transaction as any).source === 'split'
                              ? 'account-group'
                              : getCategoryIcon(transaction.category)
                          }
                          size={25}
                          color={PRIMARY_COLOR}
                        />
                      </View>
                      <View style={{flexDirection: 'column', marginLeft: 5}}>
                        <Text style={styles.transactionsCardTitle} numberOfLines={1}>
                          {transaction.title.length > 25 ? transaction.title.slice(0, 25) + '...' : transaction.title}
                        </Text>
                        <View style={styles.transactionsCardDateAndTime}>
                          <Text style={styles.transactionsCardDate}>{transaction.date}</Text>
                        </View>
                        {(transaction as any).source === 'split' && (
                          <Text style={styles.splitRoleLabel}>
                            {(transaction as any).splitRole === 'payer' ? 'Given' : (transaction as any).splitRole === 'participant' ? 'Taken' : 'Settled'}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.transactionsCardAmount}>
                      <Text style={transaction.type === 'income' ? styles.amountIncome : styles.amountExpense}>
                        {transaction.type === 'income' ? '+ ' : '- '}{formatAmount(transaction.amount)}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="receipt-text-outline" size={48} color="#CBD3EE" />
                {transactions.length === 0 ? (
                  <>
                    <Text style={styles.emptyStateText}>No transactions yet</Text>
                    <Text style={styles.emptyStateSubText}>Add your first transaction to get started</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyStateText}>No transactions in this time range</Text>
                    <Text style={styles.emptyStateSubText}>Try changing the time range above to see older transactions</Text>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Edit Balance Modal */}
      <Modal visible={editBalanceVisible} transparent animationType="fade" onRequestClose={() => setEditBalanceVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Edit Balance</Text>
              <Text style={styles.modalSubtitle}>Set your current account balance</Text>
              <TextInput
                style={styles.modalInput}
                value={formatInputAmount(newBalanceInput)}
                onChangeText={text => setNewBalanceInput(text.replace(/,/g, ''))}
                keyboardType="numeric"
                placeholder="Enter balance"
                placeholderTextColor="#999"
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditBalanceVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveBalance} disabled={balanceSaving}>
                  <Text style={styles.modalSaveText}>{balanceSaving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  splitRoleLabel: {fontSize: 10, color: PRIMARY_COLOR, fontWeight: '600', marginTop: 1},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BACKGROUND_COLOR},
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollContainer: {flex: 1},
  heroSection: {
    backgroundColor: PRIMARY_COLOR, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28, marginBottom: 20,
  },
  heroTopRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20},
  heroGreeting: {fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', fontFamily: 'Kufam-SemiBoldItalic'},
  heroSubGreeting: {fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4, fontFamily: 'Lato-Regular'},
  heroAvatar: {width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)'},
  heroAvatarInitials: {width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)'},
  heroAvatarInitialsText: {fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', fontFamily: 'Lato-Bold'},
  balanceHeroCard: {backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16},
  balanceHeroLabel: {fontSize: 13, color: '#666', fontFamily: 'Lato-Regular', marginBottom: 6},
  balanceHeroRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  balanceHeroAmount: {fontSize: 30, fontWeight: 'bold', fontFamily: 'Lato-Bold'},
  balanceEditBtn: {backgroundColor: '#F4F6FA', borderRadius: 8, padding: 8},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20},
  modalCard: {backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%'},
  modalTitle: {fontSize: 20, fontWeight: 'bold', color: '#2C2C2C', fontFamily: 'Kufam-SemiBoldItalic', marginBottom: 4},
  modalSubtitle: {fontSize: 14, color: '#888', fontFamily: 'Lato-Regular', marginBottom: 20},
  modalInput: {borderWidth: 1, borderColor: '#E8EBF7', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 18, color: '#2C2C2C', fontFamily: 'Lato-Regular', backgroundColor: '#F4F6FA', marginBottom: 20},
  modalActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: 12},
  modalCancelBtn: {paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E8EBF7'},
  modalCancelText: {fontSize: 15, fontWeight: '600', color: '#666', fontFamily: 'Lato-Bold'},
  modalSaveBtn: {paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: PRIMARY_COLOR},
  modalSaveText: {fontSize: 15, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Lato-Bold'},
  filterSection: {marginHorizontal: 20, marginBottom: 20},
  filterScrollView: {flexGrow: 0},
  filterButton: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', marginRight: 10, borderWidth: 1, borderColor: '#E8EBF7'},
  filterButtonActive: {backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR},
  filterButtonText: {fontSize: 14, fontWeight: '600', color: PRIMARY_COLOR, marginLeft: 6, fontFamily: 'Lato-Bold'},
  filterButtonTextActive: {color: '#FFFFFF', marginLeft: 6, fontSize: 14, fontWeight: '600', fontFamily: 'Lato-Bold'},
  customDateSection: {marginHorizontal: 20, marginBottom: 20, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E8EBF7'},
  customDateTitle: {fontSize: 14, fontWeight: '600', color: '#2C2C2C', marginBottom: 12, fontFamily: 'Lato-Bold'},
  customDateContainer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  dateInput: {flex: 1, backgroundColor: '#F4F6FA', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E8EBF7'},
  dateInputContent: {flexDirection: 'row', alignItems: 'center'},
  dateInputText: {fontSize: 14, color: '#2C2C2C', marginLeft: 8, fontFamily: 'Lato-Regular', fontWeight: '500'},
  dateInputPlaceholder: {color: '#999'},
  dateSeparator: {marginHorizontal: 10},
  dateSeparatorText: {fontSize: 12, color: '#999', fontFamily: 'Lato-Regular'},
  cardSection: {flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 20},
  summaryCard: {width: '48%', borderRadius: 16, backgroundColor: '#FFFFFF'},
  cardContent: {padding: 16},
  cardHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  cardIcon: {width: 32, height: 32, borderRadius: 8, backgroundColor: '#F4F6FA', alignItems: 'center', justifyContent: 'center', marginRight: 8},
  cardTitle: {fontSize: 14, fontWeight: '500', color: '#666', fontFamily: 'Lato-Regular'},
  cardAmount: {fontSize: 20, fontWeight: 'bold', fontFamily: 'Lato-Bold'},
  quickActionsSection: {marginTop: 20, paddingHorizontal: 20},
  quickActionsTitle: {fontSize: 20, fontWeight: 'bold', color: '#2C2C2C', marginBottom: 15, fontFamily: 'Kufam-SemiBoldItalic'},
  quickActionsContainer: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10},
  quickActionButton: {flex: 0.48, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  addIncomeButton: {backgroundColor: INCOME_COLOR},
  addExpenseButton: {backgroundColor: EXPENSE_COLOR},
  quickActionText: {fontSize: 14, fontWeight: '600', color: '#FFFFFF', fontFamily: 'Lato-Bold', marginLeft: 8},
  transactionsSection: {marginTop: 10, paddingHorizontal: 20},
  transactionsHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15},
  transactionsHeaderText: {fontSize: 20, fontWeight: 'bold', color: '#2C2C2C', fontFamily: 'Kufam-SemiBoldItalic'},
  transactionsSubHeaderText: {fontSize: 14, color: '#666', marginTop: 2, fontFamily: 'Lato-Regular'},
  seeAllButton: {flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(103, 124, 210, 0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10},
  seeAllText: {fontSize: 14, fontWeight: '600', color: PRIMARY_COLOR, marginRight: 4, fontFamily: 'Lato-Bold'},
  transactionsList: {marginBottom: 30},
  transactionsCard: {flexDirection: 'row', alignItems: 'center', padding: 18, marginVertical: 6, backgroundColor: '#FFFFFF', borderRadius: 16},
  transactionsCardContent: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%'},
  transactionsCardDetails: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  transactionsCardIcon: {width: 50, height: 50, borderRadius: 14, backgroundColor: '#E8EBF7', alignItems: 'center', justifyContent: 'center', marginRight: 15},
  transactionsCardTitle: {fontSize: 16, fontWeight: '600', color: '#2C2C2C', fontFamily: 'Lato-Bold'},
  transactionsCardDateAndTime: {flexDirection: 'row', alignItems: 'center', marginTop: 4},
  transactionsCardDate: {fontSize: 13, color: '#888', fontFamily: 'Lato-Regular'},
  transactionsCardAmount: {flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center'},
  amountIncome: {fontSize: 16, fontWeight: 'bold', color: INCOME_COLOR, fontFamily: 'Lato-Bold'},
  amountExpense: {fontSize: 16, fontWeight: 'bold', color: EXPENSE_COLOR, fontFamily: 'Lato-Bold'},
  emptyState: {alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20},
  emptyStateText: {fontSize: 18, fontWeight: '600', color: '#666', marginTop: 15, fontFamily: 'Lato-Bold'},
  emptyStateSubText: {fontSize: 14, color: '#888', textAlign: 'center', marginTop: 8, fontFamily: 'Lato-Regular'},
  errorContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BACKGROUND_COLOR, paddingHorizontal: 20},
  errorText: {fontSize: 16, color: EXPENSE_COLOR, textAlign: 'center', fontFamily: 'Lato-Regular', marginTop: 15, marginBottom: 20},
  retryButton: {backgroundColor: PRIMARY_COLOR, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, elevation: Platform.OS === 'android' ? 0 : 2, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.2, shadowRadius: 2},
  retryButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: 'Lato-Bold'},
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
});
