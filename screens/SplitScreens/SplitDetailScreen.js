import React from 'react';
import {View, ScrollView, StyleSheet, TouchableOpacity, Alert} from 'react-native';
import {Text, Card} from 'react-native-paper';
import UserAvatar from 'react-native-user-avatar';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {useFocusEffect} from '@react-navigation/native';
import SplitNotificationService from '../../services/SplitNotificationService';
const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const SUCCESS_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';
const SplitDetailScreen = ({route, navigation}) => {
  const {split: initialSplit, group, transaction} = route.params;
  const currentUser = auth().currentUser;
  const [split, setSplit] = React.useState(initialSplit);
  const [loading, setLoading] = React.useState(false);
  const isSettlement = split.type === 'settlement';
  const [menuVisible, setMenuVisible] = React.useState(false);
  // Fetch the latest split data from Firestore
  const fetchSplitData = React.useCallback(async () => {
    try {
      setLoading(true);
      const splitDoc = await firestore()
        .collection('groups')
        .doc(group.id)
        .collection('splits')
        .doc(initialSplit.id)
        .get();
      
      if (splitDoc.exists) {
        setSplit({id: splitDoc.id, ...splitDoc.data()});
      }
    } catch (error) {
      console.error('Failed to fetch split data:', error);
    } finally {
      setLoading(false);
    }
  }, [group.id, initialSplit.id]);

  // Refetch split data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchSplitData();
    }, [fetchSplitData])
  );

  const confirmAndDelete = () => {
    Alert.alert(
      'Delete Split',
      'Are you sure you want to delete this split?',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete', style: 'destructive', onPress: handleDeleteSplit},
      ],
      {cancelable: true},
    );
  };
  const handleDeleteSplit = async () => {
    try {
      await firestore()
        .collection('groups')
        .doc(group.id)
        .collection('splits')
        .doc(split.id)
        .delete();
      
      let actorName = currentUser?.email?.split('@')[0] || 'Someone';
      try {
        const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
        const profileName = userDoc.data()?.name;
        if (profileName && profileName.toLowerCase() !== 'me') actorName = profileName;
      } catch (_) {}
      
      try {
        await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .collection('splitHistory')
          .add({
            type: 'delete',
            groupId: group.id,
            groupName: group.name,
            splitId: split.id,
            splitTitle: split.title,
            amount: split.amount,
            category: split.category || null,
            date: split.date || split.createdAt || null,
            paidBy: split.paidBy || null,
            splitType: split.type === 'settlement' ? 'settlement' : (split.splitType || (split.splitUsers?.some(u => u.percentage) ? 'percentage' : 'equal')),
            settlement: split.type === 'settlement' ? (split.settlement || {
              from: split.paidBy,
              to: split.splitUsers?.[0],
              amount: split.amount,
            }) : undefined,
            actorUid: currentUser?.uid || null,
            actorEmail: currentUser?.email || null,
            actorName,
            createdAt: firestore.FieldValue.serverTimestamp(),
          });
        // Also write to group-level history so all members can see
        await firestore()
          .collection('groups')
          .doc(group.id)
          .collection('splitHistory')
          .add({
            type: 'delete',
            groupId: group.id,
            groupName: group.name,
            splitId: split.id,
            splitTitle: split.title,
            amount: split.amount,
            category: split.category || null,
            date: split.date || split.createdAt || null,
            paidBy: split.paidBy || null,
            splitType: split.type === 'settlement' ? 'settlement' : (split.splitType || (split.splitUsers?.some(u => u.percentage) ? 'percentage' : 'equal')),
            settlement: split.type === 'settlement' ? (split.settlement || {
              from: split.paidBy,
              to: split.splitUsers?.[0],
              amount: split.amount,
            }) : undefined,
            actorUid: currentUser?.uid || null,
            actorEmail: currentUser?.email || null,
            actorName,
            createdAt: firestore.FieldValue.serverTimestamp(),
          });
      } catch (_) {}
      
      // Send notification to group members
      try {
        // Fetch group data to get members list
        const groupDoc = await firestore().collection('groups').doc(group.id).get();
        const groupData = groupDoc.data();
        
        if (groupData && groupData.members) {
          await SplitNotificationService.notifySplitDeleted(
            split,
            { 
              id: group.id, 
              name: group.name || groupData.name, 
              members: groupData.members 
            },
            actorName
          );
        }
      } catch (error) {
        console.error('Failed to send split deleted notification:', error);
      }
      
      setMenuVisible(false);
      Alert.alert('Deleted', 'Split deleted successfully');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete split');
    }
  };
  const formatDate = timestamp => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date
      .toLocaleDateString('en-GB', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
      })
      .split('/')
      .join('-');
  };
  const renderSplitUserDetails = () => {
    if (isSettlement) {
      return (
        <>
          {/* Person who paid (Borrower) */}
          <View style={styles.transactionsCard}>
            <UserAvatar
              size={50}
              name={split.paidBy.name}
              style={styles.transactionsCardImage}
            />
            <View style={styles.transactionsCardContent}>
              <View>
                <Text style={styles.transactionsCardTitle}>
                  {split.paidBy.name}
                  {split.paidBy.email === currentUser?.email ? ' (You)' : ''}
                </Text>
                <Text style={styles.roleText}>Paid</Text>
                <Text style={[styles.splitAmount, styles.negativeAmount]}>
                  -₹{parseFloat(split.amount).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
          {/* Person who received (Lender) */}
          <View style={styles.transactionsCard}>
            <UserAvatar
              size={50}
              name={split.splitUsers[0].name}
              style={styles.transactionsCardImage}
            />
            <View style={styles.transactionsCardContent}>
              <View>
                <Text style={styles.transactionsCardTitle}>
                  {split.splitUsers[0].name}
                  {split.splitUsers[0].email === currentUser?.email
                    ? ' (You)'
                    : ''}
                </Text>
                <Text style={styles.roleText}>Received</Text>
                <Text style={[styles.splitAmount, styles.positiveAmount]}>
                  +₹{parseFloat(split.amount).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </>
      );
    }
    return split.splitUsers.map(user => {
      const isCurrentUser = user.email === currentUser?.email;
      const splitAmount =
        split.splitType === 'percentage'
          ? `₹${(split.amount * (user.percentage / 100)).toFixed(2)}`
          : `₹${(split.amount / split.splitUsers.length).toFixed(2)}`;
      return (
        <View key={user.email} style={styles.transactionsCard}>
          <UserAvatar
            size={50}
            name={user.name}
            style={styles.transactionsCardImage}
          />
          <View style={styles.transactionsCardContent}>
            <View>
              <Text style={styles.transactionsCardTitle}>
                {user.name}
                {isCurrentUser ? ' (You)' : ''}
              </Text>
              <Text style={styles.splitAmount}>{splitAmount}</Text>
              {split.splitType === 'percentage' && (
                <Text style={styles.percentageText}>
                  {user.percentage}% Split
                </Text>
              )}
            </View>
          </View>
        </View>
      );
    });
  };
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
              <MaterialCommunityIcons 
                name={isSettlement ? 'bank-transfer' : 'cash-multiple'} 
                size={32} 
                color={PRIMARY_COLOR} 
              />
              <Text style={styles.headerTitle}>
                {isSettlement ? 'Settlement Details' : 'Split Details'}
              </Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {isSettlement ? 'Payment settlement information' : 'Expense split breakdown'}
            </Text>
          </View>
          {/* Summary Card */}
          <Card style={styles.summaryCard} elevation={4}>
            <View style={styles.cardContent}>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryIcon}>
                  <MaterialCommunityIcons
                    name={isSettlement ? 'bank-transfer' : 'cash-multiple'}
                    color="#fff"
                    size={24}
                  />
                </View>
                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryTitle}>
                    {isSettlement ? 'Settlement' : split.title}
                  </Text>
                  <Text style={styles.summaryAmount}>
                    ₹{parseFloat(split.amount).toLocaleString()}
                  </Text>
                </View>
              </View>
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(split.date || split.createdAt)}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>
                    {isSettlement ? 'Settlement' : split.category || 'Expense'}
                  </Text>
                </View>
                {!isSettlement && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Split Type</Text>
                    <Text style={styles.detailValue}>
                      {split.splitType === 'percentage' ? 'Percentage' : 'Equal'}
                    </Text>
                  </View>
                )}
                {!isSettlement && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Paid By</Text>
                    <Text style={styles.detailValue}>
                      {split.paidBy.name || split.paidBy.email}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Card>
          {/* Split Breakdown Section */}
          <View style={styles.breakdownSection}>
            <Text style={styles.sectionTitle}>
              {isSettlement ? 'Settlement Details' : 'Split Breakdown'}
            </Text>
            {renderSplitUserDetails()}
          </View>
          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('CreateSplit', {group, split})}>
              <MaterialCommunityIcons name="pencil" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={confirmAndDelete}>
              <MaterialCommunityIcons name="trash-can" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Delete</Text>
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
  summaryCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cardContent: {
    padding: 25,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    width: '48%',
    marginBottom: 15,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'Lato-Regular',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  breakdownSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginBottom: 15,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  myCard: {
    margin: 5,
    padding: 20,
    backgroundColor: '#677CD2',
    borderRadius: 12,
  },
  dataCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  cardContent: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  cardContentWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  Icon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: '#7A8EE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  settlementIcon: {
    backgroundColor: '#5D72C4',
  },
  TitleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#CED6EC',
    marginBottom: 5,
  },
  BalanceText: {
    fontSize: 26,
    fontWeight: '500',
    color: '#fff',
  },
  ValueText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#3A3B3E',
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 10,
  },
  transactionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginVertical: 8,
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
  },
  transactionsCardImage: {
    borderRadius: 10,
  },
  transactionsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    marginLeft: 10,
  },
  transactionsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  splitAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginTop: 4,
    fontFamily: 'Lato-Bold',
  },
  positiveAmount: {
    color: '#25B07F',
  },
  negativeAmount: {
    color: '#F64E4E',
  },
  percentageText: {
    fontSize: 12,
    color: '#959698',
    marginTop: 2,
  },
  roleText: {
    fontSize: 12,
    color: '#959698',
    marginTop: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 15,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
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
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EXPENSE_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    elevation: 3,
    shadowColor: EXPENSE_COLOR,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  amount: {
    fontSize: 20,
    color: '#677CD2',
    marginBottom: 10,
  },
  date: {
    fontSize: 16,
    color: '#959698',
    marginBottom: 10,
  },
  paidBy: {
    fontSize: 16,
    color: '#3A3B3E',
  },
});
export default SplitDetailScreen;
