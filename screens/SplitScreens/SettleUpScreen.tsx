import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Platform} from 'react-native';
import {Card, Switch} from 'react-native-paper';
import UserAvatar from 'react-native-user-avatar';
import firestore from '@react-native-firebase/firestore';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import crashlytics from '@react-native-firebase/crashlytics';
import * as AnalyticsService from '../../src/services/AnalyticsService';
import SplitNotificationService from '../../services/SplitNotificationService';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {useCurrency} from '../../utils/CurrencyUtil';
import {PRIMARY_COLOR, BACKGROUND_COLOR, INCOME_COLOR as SUCCESS_COLOR, EXPENSE_COLOR} from '../../src/constants/theme';
import {formatInputAmount} from '../../src/utils/formatters';

interface GroupMember {
  email: string;
  name: string;
  avatar?: string;
  userId?: string;
}

interface LendingDetail {
  borrower: {email: string; name: string};
  lender: {email: string; name: string};
  amount: number;
}

interface Group {
  id: string;
  name: string;
  members: GroupMember[];
}

const SettleUpScreen = ({route, navigation}: {route: any; navigation: any}) => {
  const {currency, formatAmount} = useCurrency();
  const {group, lendingDetails, preselect} = route.params as {
    group: Group;
    lendingDetails?: LendingDetail[];
    preselect?: {borrower: {email: string}; lender: {email: string}; amount: number};
  };
  const [loading, setLoading] = useState(false);
  const [selectedLender, setSelectedLender] = useState<GroupMember | null>(null);
  const [selectedBorrower, setSelectedBorrower] = useState<GroupMember | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [includeInTransactions, setIncludeInTransactions] = useState(true);

  useEffect(() => {
    const currentUserEmail = auth().currentUser?.email;
    const members = group.members || [];
    if (preselect) {
      setSelectedBorrower(members.find(m => m.email === preselect.borrower.email) ?? null);
      setSelectedLender(members.find(m => m.email === preselect.lender.email) ?? null);
      setAmount(preselect.amount.toString());
    } else if (lendingDetails?.length) {
      const myDebt = lendingDetails.find(d => d.borrower.email === currentUserEmail);
      if (myDebt) {
        setSelectedBorrower(members.find(m => m.email === myDebt.borrower.email) ?? null);
        setSelectedLender(members.find(m => m.email === myDebt.lender.email) ?? null);
        setAmount(myDebt.amount.toString());
      }
    }
  }, []);

  const handleSettleUp = async () => {
    if (!selectedLender || !selectedBorrower || !amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (note.trim().length > 200) {
      Alert.alert('Error', 'Note must be 200 characters or less');
      return;
    }
    const settlementAmount = parseFloat(amount);
    if (isNaN(settlementAmount) || settlementAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (settlementAmount > 999999999) {
      Alert.alert('Error', 'Amount must be less than 999,999,999');
      return;
    }
    try {
      setLoading(true);
      const currentUser = auth().currentUser!;
      const currentUserEmail = currentUser.email;
      let actorNameResolved = currentUserEmail?.split('@')[0] || 'Someone';
      try {
        const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
        const profileName = userDoc.data()?.name;
        if (profileName && profileName.toLowerCase() !== 'me') actorNameResolved = profileName;
      } catch (_) {}

      const settlementData = {
        from: selectedBorrower,
        to: selectedLender,
        amount: settlementAmount,
        note: note.trim(),
        status: 'completed',
        createdAt: firestore.FieldValue.serverTimestamp(),
        groupId: group.id,
      };
      await firestore().collection('groups').doc(group.id).collection('settlements').add(settlementData);

      const settlementSplit = {
        title: note.trim() || 'Settlement Payment',
        amount: settlementAmount,
        category: 'Settlement',
        paidBy: selectedBorrower,
        splitUsers: [selectedLender],
        date: firestore.Timestamp.now(),
        createdAt: firestore.FieldValue.serverTimestamp(),
        type: 'settlement',
        isSettlement: true,
        settlement: {from: selectedBorrower, to: selectedLender, amount: settlementAmount},
      };
      const splitRef = await firestore().collection('groups').doc(group.id).collection('splits').add(settlementSplit);

      try {
        await SplitNotificationService.notifySettlementMade(
          {id: group.id, name: group.name, members: (group.members || []).map((m: GroupMember) => m.email || m)},
          {id: splitRef.id, amount: settlementAmount},
          actorNameResolved,
        );
      } catch (_) {}

      const historyPayload = {
        type: 'settlement_create',
        groupId: group.id,
        groupName: group.name,
        splitId: splitRef.id,
        splitTitle: settlementSplit.title,
        amount: settlementAmount,
        category: 'Settlement',
        date: firestore.FieldValue.serverTimestamp(),
        paidBy: selectedBorrower,
        splitType: 'settlement',
        settlement: {from: selectedBorrower, to: selectedLender, amount: settlementAmount, note: note.trim()},
        actorUid: currentUser.uid,
        actorEmail: currentUserEmail,
        actorName: actorNameResolved,
        createdAt: firestore.FieldValue.serverTimestamp(),
      };
      try {
        await firestore().collection('users').doc(currentUser.uid).collection('splitHistory').add(historyPayload);
        await firestore().collection('groups').doc(group.id).collection('splitHistory').add(historyPayload);
      } catch (_) {}

      if (includeInTransactions) {
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const txCol = firestore().collection('users').doc(currentUser.uid).collection('transactions');
          if (selectedBorrower.email === currentUserEmail) {
            await txCol.add({
              title: note.trim() || `Settlement: ${group.name}`, type: 'expense',
              category: 'Settlement', amount: String(settlementAmount), date: todayStr,
              source: 'split', splitId: splitRef.id, groupId: group.id, groupName: group.name,
              splitRole: 'settlement_payer', createdAt: firestore.FieldValue.serverTimestamp(),
            });
          } else if (selectedLender.email === currentUserEmail) {
            await txCol.add({
              title: note.trim() || `Settlement: ${group.name}`, type: 'income',
              category: 'Settlement', amount: String(settlementAmount), date: todayStr,
              source: 'split', splitId: splitRef.id, groupId: group.id, groupName: group.name,
              splitRole: 'settlement_receiver', createdAt: firestore.FieldValue.serverTimestamp(),
            });
          }
        } catch (_) {}
      }

      if (selectedBorrower.email === currentUserEmail) {
        await firestore().runTransaction(async tx => {
          const userDoc = await tx.get(firestore().collection('users').doc(currentUser.uid));
          const userData = userDoc.data()!;
          tx.update(userDoc.ref, {balance: userData.balance - settlementAmount});
        });
      } else if (selectedLender.email === currentUserEmail) {
        await firestore().runTransaction(async tx => {
          const userDoc = await tx.get(firestore().collection('users').doc(currentUser.uid));
          const userData = userDoc.data()!;
          tx.update(userDoc.ref, {balance: userData.balance + settlementAmount});
        });
      }

      AnalyticsService.logSettleUp(AnalyticsService.getAmountRange(settlementAmount));
      Alert.alert('Success', 'Settlement recorded successfully');
      navigation.goBack();
    } catch (e) {
      crashlytics().recordError(e as Error);
      Alert.alert('Error', 'Failed to record settlement');
    } finally {
      setLoading(false);
    }
  };

  const renderUserSelectionCard = (
    title: string,
    selectedUser: GroupMember | null,
    users: GroupMember[],
    onSelect: (u: GroupMember | null) => void,
    excludeUser: GroupMember | null,
  ) => (
    <Card style={[styles.sectionCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 1}>
      <View style={styles.cardContent}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.userList}>
            {users
              .filter(u => u.email !== excludeUser?.email)
              .map(u => (
                <TouchableOpacity
                  key={u.email}
                  style={[styles.userItem, selectedUser?.email === u.email && styles.selectedUserItem]}
                  onPress={() => onSelect(selectedUser?.email === u.email ? null : u)}>
                  <UserAvatar
                    size={50}
                    name={u.name}
                    src={u.avatar}
                    style={styles.userAvatar}
                    bgColor={selectedUser?.email === u.email ? PRIMARY_COLOR : '#CBD3EE'}
                  />
                  <Text style={[styles.userName, selectedUser?.email === u.email && styles.selectedUserName]}>{u.name}</Text>
                  {selectedUser?.email === u.email && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={PRIMARY_COLOR} style={styles.checkIcon} />
                  )}
                </TouchableOpacity>
              ))}
          </View>
        </ScrollView>
      </View>
    </Card>
  );

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="handshake" size={32} color={SUCCESS_COLOR} />
              <Text style={styles.headerTitle}>Settle Up</Text>
            </View>
            <Text style={styles.headerSubtitle}>Record payments between group members</Text>
          </View>
          {(lendingDetails?.length ?? 0) > 0 && (
            <Card style={[styles.sectionCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 1}>
              <View style={styles.cardContent}>
                <Text style={styles.sectionTitle}>Suggestions</Text>
                {lendingDetails!.map((item, idx) => {
                  const currentEmail = auth().currentUser?.email;
                  const isActive = selectedBorrower?.email === item.borrower.email && selectedLender?.email === item.lender.email;
                  const isMyDebt = item.borrower.email === currentEmail;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.suggestionCard, isActive && styles.suggestionCardActive]}
                      onPress={() => {
                        const members = group.members || [];
                        setSelectedBorrower(members.find(m => m.email === item.borrower.email) ?? null);
                        setSelectedLender(members.find(m => m.email === item.lender.email) ?? null);
                        setAmount(item.amount.toString());
                      }}>
                      <View style={styles.suggestionLeft}>
                        {isMyDebt && (
                          <View style={styles.youPayBadge}>
                            <Text style={styles.youPayText}>You pay</Text>
                          </View>
                        )}
                        <Text style={[styles.suggestionText, isActive && styles.suggestionTextActive]}>
                          {item.borrower.name} → {item.lender.name}
                        </Text>
                      </View>
                      <Text style={[styles.suggestionAmount, isActive && styles.suggestionAmountActive]}>
                        {formatAmount(item.amount)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>
          )}
          {renderUserSelectionCard('Who paid?', selectedBorrower, group.members || [], setSelectedBorrower, selectedLender)}
          {renderUserSelectionCard('To whom?', selectedLender, group.members || [], setSelectedLender, selectedBorrower)}
          <Card style={[styles.sectionCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 1}>
            <View style={styles.cardContent}>
              <Text style={styles.sectionTitle}>Amount</Text>
              <TextInput
                style={styles.textInput}
                value={formatInputAmount(amount)}
                onChangeText={text => setAmount(text.replace(/,/g, ''))}
                keyboardType="numeric"
                placeholder={`${currency.symbol}0`}
                placeholderTextColor="#999"
              />
            </View>
          </Card>
          <Card style={[styles.sectionCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 1}>
            <View style={styles.cardContent}>
              <Text style={styles.sectionTitle}>Add a note (optional)</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={note}
                onChangeText={setNote}
                placeholder="Add a note for this settlement"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={200}
              />
              <Text style={styles.characterCount}>{note.length}/200</Text>
            </View>
          </Card>
          <Card style={[styles.sectionCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 1}>
            <View style={styles.cardContent}>
              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.toggleLabel}>Add to my transactions</Text>
                  <Text style={styles.toggleSubtext}>Record your share as a personal expense</Text>
                </View>
                <Switch
                  value={includeInTransactions}
                  onValueChange={setIncludeInTransactions}
                  color={PRIMARY_COLOR}
                />
              </View>
            </View>
          </Card>
          {selectedLender && selectedBorrower && amount ? (
            <Card style={[styles.sectionCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 1}>
              <View style={styles.cardContent}>
                <Text style={styles.sectionTitle}>Summary</Text>
                <View style={styles.summaryContent}>
                  <View style={styles.summaryRow}>
                    <UserAvatar size={40} name={selectedBorrower.name} bgColor={EXPENSE_COLOR} />
                    <MaterialCommunityIcons name="arrow-right" size={24} color="#666" style={styles.arrowIcon} />
                    <UserAvatar size={40} name={selectedLender.name} bgColor={SUCCESS_COLOR} />
                  </View>
                  <Text style={styles.summaryText}>
                    {selectedBorrower.name} pays {formatAmount(parseFloat(amount))} to {selectedLender.name}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.settleButton, (!selectedLender || !selectedBorrower || !amount) && styles.disabledButton]}
              onPress={handleSettleUp}
              disabled={loading || !selectedLender || !selectedBorrower || !amount}>
              <MaterialCommunityIcons name="handshake" size={20} color="#FFFFFF" />
              <Text style={styles.settleButtonText}>{loading ? 'Processing...' : 'Settle Up'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
};

export default SettleUpScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
  headerSection: {alignItems: 'center', paddingHorizontal: 20, paddingTop: 30, paddingBottom: 20},
  headerTitleRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  headerTitle: {fontSize: 28, fontWeight: 'bold', color: SUCCESS_COLOR, fontFamily: 'Kufam-SemiBoldItalic', marginLeft: 12},
  headerSubtitle: {fontSize: 16, color: '#666', textAlign: 'center', fontFamily: 'Lato-Regular'},
  sectionCard: {backgroundColor: '#FFFFFF', borderRadius: 16, marginHorizontal: 20, marginBottom: 15},
  cardContent: {padding: 20},
  sectionTitle: {fontSize: 18, fontWeight: '600', color: '#2C2C2C', marginBottom: 15, fontFamily: 'Lato-Bold'},
  userList: {flexDirection: 'row', paddingVertical: 8},
  userItem: {alignItems: 'center', marginRight: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E8EBF7', backgroundColor: '#F8F9FA', width: 90, position: 'relative'},
  selectedUserItem: {backgroundColor: PRIMARY_COLOR + '15', borderColor: PRIMARY_COLOR, borderWidth: 2},
  userAvatar: {marginBottom: 8},
  userName: {fontSize: 12, textAlign: 'center', color: '#2C2C2C', fontFamily: 'Lato-Regular', fontWeight: '500'},
  selectedUserName: {color: PRIMARY_COLOR, fontWeight: '600', fontFamily: 'Lato-Bold'},
  checkIcon: {position: 'absolute', top: -5, right: -5, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 2, elevation: Platform.OS === 'android' ? 0 : 1, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, shadowRadius: 1},
  textInput: {backgroundColor: '#F8F9FA', borderRadius: 12, borderWidth: 1, borderColor: '#E8EBF7', paddingHorizontal: 15, paddingVertical: 12, fontSize: 16, color: '#2C2C2C', fontFamily: 'Lato-Regular'},
  multilineInput: {height: 80, paddingTop: 12},
  summaryContent: {alignItems: 'center'},
  summaryRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 15},
  summaryText: {fontSize: 16, color: '#2C2C2C', fontFamily: 'Lato-Regular', textAlign: 'center', lineHeight: 24},
  arrowIcon: {marginHorizontal: 15},
  buttonContainer: {paddingHorizontal: 20, paddingBottom: 30},
  settleButton: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: SUCCESS_COLOR, paddingVertical: 15, borderRadius: 12, elevation: Platform.OS === 'android' ? 0 : 1, shadowColor: SUCCESS_COLOR, shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.15, shadowRadius: 2},
  disabledButton: {backgroundColor: '#CBD3EE', elevation: 0, shadowOpacity: 0},
  settleButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginLeft: 8, fontFamily: 'Lato-Bold'},
  characterCount: {fontSize: 12, color: '#999', marginTop: 4, textAlign: 'right', fontFamily: 'Lato-Regular'},
  suggestionCard: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8F9FA', borderRadius: 12, borderWidth: 1, borderColor: '#E8EBF7', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10},
  suggestionCardActive: {backgroundColor: PRIMARY_COLOR + '15', borderColor: PRIMARY_COLOR, borderWidth: 2},
  suggestionLeft: {flex: 1, gap: 4},
  suggestionText: {fontSize: 14, color: '#2C2C2C', fontFamily: 'Lato-Regular'},
  suggestionTextActive: {color: PRIMARY_COLOR, fontFamily: 'Lato-Bold'},
  suggestionAmount: {fontSize: 15, fontWeight: '600', color: EXPENSE_COLOR, fontFamily: 'Lato-Bold', marginLeft: 12},
  suggestionAmountActive: {color: PRIMARY_COLOR},
  youPayBadge: {alignSelf: 'flex-start', backgroundColor: EXPENSE_COLOR + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2},
  youPayText: {fontSize: 11, color: EXPENSE_COLOR, fontFamily: 'Lato-Bold', fontWeight: '700'},
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
  toggleRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  toggleLabel: {fontSize: 14, fontWeight: '600', color: '#2C2C2C', fontFamily: 'Lato-Bold'},
  toggleSubtext: {fontSize: 12, color: '#888', fontFamily: 'Lato-Regular', marginTop: 2},
});
