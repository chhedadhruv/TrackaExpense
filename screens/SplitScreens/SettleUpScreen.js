import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import {Button, Card} from 'react-native-paper';
import UserAvatar from 'react-native-user-avatar';
import firestore from '@react-native-firebase/firestore';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import SplitNotificationService from '../../services/SplitNotificationService';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {useCurrency} from '../../utils/CurrencyUtil';
const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const SUCCESS_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';
const SettleUpScreen = ({route, navigation}) => {
  const {currency, formatAmount} = useCurrency();
  const {group, lendingDetails} = route.params;
  const [loading, setLoading] = useState(false);
  const [selectedLender, setSelectedLender] = useState(null);
  const [selectedBorrower, setSelectedBorrower] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
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
      const currentUser = auth().currentUser;
      const currentUserEmail = currentUser.email;
      let actorNameResolved = currentUserEmail?.split('@')[0] || 'Someone';
      try {
        const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
        const profileName = userDoc.data()?.name;
        if (profileName && profileName.toLowerCase() !== 'me') actorNameResolved = profileName;
      } catch (_) {}
      // Create settlement record
      const settlementData = {
        from: selectedBorrower,
        to: selectedLender,
        amount: settlementAmount,
        note: note.trim(),
        status: 'completed',
        createdAt: firestore.FieldValue.serverTimestamp(),
        groupId: group.id,
      };
      const settlementRef = await firestore()
        .collection('groups')
        .doc(group.id)
        .collection('settlements')
        .add(settlementData);
      // Create settlement split with special handling
      const settlementSplit = {
        title: note.trim() || 'Settlement Payment',
        amount: settlementAmount,
        category: 'Settlement',
        paidBy: selectedBorrower,
        splitUsers: [selectedLender], // Only include the lender to avoid splitting the amount
        createdAt: firestore.FieldValue.serverTimestamp(),
        type: 'settlement',
        isSettlement: true, // Add flag to identify settlement splits
        settlement: {
          from: selectedBorrower,
          to: selectedLender,
          amount: settlementAmount,
        },
      };
      const splitRef = await firestore()
        .collection('groups')
        .doc(group.id)
        .collection('splits')
        .add(settlementSplit);
      try {
        await SplitNotificationService.notifySettlementMade(
          { id: group.id, name: group.name, members: (group.members || groupMembers || []).map(m => m.email || m) },
          { id: splitRef.id, amount: settlementAmount },
          actorNameResolved
        );
      } catch (_) {}
      // Only update balance if the current user is involved (no transaction creation)
      try {
        const actorName = actorNameResolved;
        await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .collection('splitHistory')
          .add({
            type: 'settlement_create',
            groupId: group.id,
            groupName: group.name,
            splitId: splitRef.id,
            splitTitle: settlementSplit.title,
            amount: settlementAmount,
            category: 'Settlement',
            date: settlementSplit.createdAt || firestore.FieldValue.serverTimestamp(),
            paidBy: selectedBorrower,
            splitType: 'settlement',
            settlement: {
              from: selectedBorrower,
              to: selectedLender,
              amount: settlementAmount,
              note: note.trim(),
            },
            actorUid: currentUser.uid,
            actorEmail: currentUserEmail,
            actorName,
            createdAt: firestore.FieldValue.serverTimestamp(),
          });
        // Also write to group-level history so all members can see
        await firestore()
          .collection('groups')
          .doc(group.id)
          .collection('splitHistory')
          .add({
            type: 'settlement_create',
            groupId: group.id,
            groupName: group.name,
            splitId: splitRef.id,
            splitTitle: settlementSplit.title,
            amount: settlementAmount,
            category: 'Settlement',
            date: settlementSplit.createdAt || firestore.FieldValue.serverTimestamp(),
            paidBy: selectedBorrower,
            splitType: 'settlement',
            settlement: {
              from: selectedBorrower,
              to: selectedLender,
              amount: settlementAmount,
              note: note.trim(),
            },
            actorUid: currentUser.uid,
            actorEmail: currentUserEmail,
            actorName,
            createdAt: firestore.FieldValue.serverTimestamp(),
          });
      } catch (_) {}
      if (selectedBorrower.email === currentUserEmail) {
        // Update user's balance without creating a transaction
        await firestore().runTransaction(async transaction => {
          const userDoc = await transaction.get(
            firestore().collection('users').doc(currentUser.uid),
          );
          const userData = userDoc.data();
          transaction.update(userDoc.ref, {
            balance: userData.balance - settlementAmount,
          });
        });
      } else if (selectedLender.email === currentUserEmail) {
        // Update user's balance without creating a transaction
        await firestore().runTransaction(async transaction => {
          const userDoc = await transaction.get(
            firestore().collection('users').doc(currentUser.uid),
          );
          const userData = userDoc.data();
          transaction.update(userDoc.ref, {
            balance: userData.balance + settlementAmount,
          });
        });
      }
      Alert.alert('Success', 'Settlement recorded successfully');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to record settlement');
    } finally {
      setLoading(false);
    }
  };
  const renderUserSelectionCard = (
    title,
    selectedUser,
    users,
    onSelect,
    excludeUser,
  ) => (
    <Card style={styles.sectionCard} elevation={1}>
      <View style={styles.cardContent}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.userList}>
            {users
              .filter(user => user.email !== excludeUser?.email)
              .map(user => (
                <TouchableOpacity
                  key={user.email}
                  style={[
                    styles.userItem,
                    selectedUser?.email === user.email &&
                      styles.selectedUserItem,
                  ]}
                  onPress={() => {
                    // If user is already selected, unselect them; otherwise select them
                    if (selectedUser?.email === user.email) {
                      onSelect(null);
                    } else {
                      onSelect(user);
                    }
                  }}>
                  <UserAvatar
                    size={50}
                    name={user.name}
                    src={user.avatar}
                    style={styles.userAvatar}
                    bgColor={selectedUser?.email === user.email ? PRIMARY_COLOR : '#CBD3EE'}
                  />
                  <Text
                    style={[
                      styles.userName,
                      selectedUser?.email === user.email &&
                        styles.selectedUserName,
                    ]}>
                    {user.name}
                  </Text>
                  {selectedUser?.email === user.email && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color={PRIMARY_COLOR}
                      style={styles.checkIcon}
                    />
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
        <KeyboardAwareScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="handshake" size={32} color={SUCCESS_COLOR} />
              <Text style={styles.headerTitle}>Settle Up</Text>
            </View>
            <Text style={styles.headerSubtitle}>Record payments between group members</Text>
          </View>
          {/* Who paid section */}
          {renderUserSelectionCard(
            'Who paid?',
            selectedBorrower,
            group.members,
            setSelectedBorrower,
            selectedLender,
          )}
          {/* To whom section */}
          {renderUserSelectionCard(
            'To whom?',
            selectedLender,
            group.members,
            setSelectedLender,
            selectedBorrower,
          )}
          {/* Amount section */}
          <Card style={styles.sectionCard} elevation={1}>
            <View style={styles.cardContent}>
              <Text style={styles.sectionTitle}>Amount</Text>
              <TextInput
                style={styles.textInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder={`${currency.symbol}0`}
                placeholderTextColor="#999"
              />
            </View>
          </Card>
          {/* Note section */}
          <Card style={styles.sectionCard} elevation={1}>
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
          {/* Summary section */}
          {selectedLender && selectedBorrower && amount && (
            <Card style={styles.sectionCard} elevation={1}>
              <View style={styles.cardContent}>
                <Text style={styles.sectionTitle}>Summary</Text>
                <View style={styles.summaryContent}>
                  <View style={styles.summaryRow}>
                    <UserAvatar size={40} name={selectedBorrower.name} bgColor={EXPENSE_COLOR} />
                    <MaterialCommunityIcons name="arrow-right" size={24} color="#666" style={styles.arrowIcon} />
                    <UserAvatar size={40} name={selectedLender.name} bgColor={SUCCESS_COLOR} />
                  </View>
                  <Text style={styles.summaryText}>
                    {selectedBorrower.name} pays {formatAmount(amount)} to {selectedLender.name}
                  </Text>
                </View>
              </View>
            </Card>
          )}
          {/* Settle Up button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.settleButton, (!selectedLender || !selectedBorrower || !amount) && styles.disabledButton]}
              onPress={handleSettleUp}
              disabled={loading || !selectedLender || !selectedBorrower || !amount}>
              <MaterialCommunityIcons name="handshake" size={20} color="#FFFFFF" />
              <Text style={styles.settleButtonText}>
                {loading ? 'Processing...' : 'Settle Up'}
              </Text>
            </TouchableOpacity>
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
    color: SUCCESS_COLOR,
    fontFamily: 'Kufam-SemiBoldItalic',
    marginLeft: 12,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 15,
  },
  cardContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 15,
    fontFamily: 'Lato-Bold',
  },
  userList: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  userItem: {
    alignItems: 'center',
    marginRight: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    backgroundColor: '#F8F9FA',
    width: 90,
    position: 'relative',
  },
  selectedUserItem: {
    backgroundColor: PRIMARY_COLOR + '15',
    borderColor: PRIMARY_COLOR,
    borderWidth: 2,
  },
  userAvatar: {
    marginBottom: 8,
  },
  userName: {
    fontSize: 12,
    textAlign: 'center',
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
    fontWeight: '500',
  },
  selectedUserName: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  checkIcon: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 2,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  textInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  multilineInput: {
    height: 80,
    paddingTop: 12,
  },
  summaryContent: {
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  summaryText: {
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
  arrowIcon: {
    marginHorizontal: 15,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  settleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SUCCESS_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    elevation: 1,
    shadowColor: SUCCESS_COLOR,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  disabledButton: {
    backgroundColor: '#CBD3EE',
    elevation: 0,
    shadowOpacity: 0,
  },
  settleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
    fontFamily: 'Lato-Regular',
  },
});
export default SettleUpScreen;
