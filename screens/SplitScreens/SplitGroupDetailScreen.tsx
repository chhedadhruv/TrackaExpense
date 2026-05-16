import React, {useState, useEffect, useContext} from 'react';
import {View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform} from 'react-native';
import {ActivityIndicator, Card, Button} from 'react-native-paper';
import {useFocusEffect} from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import UserAvatar from 'react-native-user-avatar';
import firestore from '@react-native-firebase/firestore';
import moment from 'moment';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {AuthContext} from '../../navigation/AuthProvider';
import SplitNotificationService from '../../services/SplitNotificationService';
import {useCurrency} from '../../utils/CurrencyUtil';
import {PRIMARY_COLOR, BACKGROUND_COLOR, INCOME_COLOR as SUCCESS_COLOR, EXPENSE_COLOR} from '../../src/constants/theme';

interface GroupMember {
  email: string;
  name: string;
  avatar?: string | null;
  userId?: string | null;
}

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
  recurring?: {enabled?: boolean; frequency?: string};
}

interface LendingDetail {
  lender: {email: string; name: string};
  borrower: {email: string; name: string};
  amount: number;
}

interface Group {
  id: string;
  name: string;
  members?: GroupMember[];
}

const RECENT_SPLITS_LIMIT = 3;

const getSplitCardColor = (split: SplitItem, currentEmail: string | undefined): string => {
  if (!currentEmail) return PRIMARY_COLOR;
  if (split.type === 'settlement' || split.isSettlement) {
    const payerEmail = split.paidBy?.email?.toLowerCase();
    const isReceiver = split.splitUsers?.some(u => u.email?.toLowerCase() === currentEmail) && payerEmail !== currentEmail;
    if (isReceiver) return SUCCESS_COLOR;
    if (payerEmail === currentEmail) return EXPENSE_COLOR;
    return PRIMARY_COLOR;
  }
  const isPayer = split.paidBy?.email?.toLowerCase() === currentEmail;
  const isInSplitUsers = split.splitUsers?.some(u => u.email?.toLowerCase() === currentEmail);
  const payerOwedByOthers = isPayer && (split.splitUsers?.some(u => u.email?.toLowerCase() !== currentEmail) ?? false);
  if (payerOwedByOthers) return SUCCESS_COLOR;
  if (!isPayer && isInSplitUsers) return EXPENSE_COLOR;
  return PRIMARY_COLOR;
};

const SplitGroupDetailScreen = ({route, navigation}: {route: any; navigation: any}) => {
  const {formatAmount} = useCurrency();
  const rawGroup = route.params?.group;
  const group: Group | null = rawGroup || (route.params?.groupId
    ? {id: route.params.groupId, name: decodeURIComponent(route.params.groupName || 'Split Group')}
    : null);
  const {user} = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [splits, setSplits] = useState<SplitItem[]>([]);
  const [totalSplitAmount, setTotalSplitAmount] = useState(0);
  const [detailedLendingInfo, setDetailedLendingInfo] = useState<LendingDetail[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [filteredSplits, setFilteredSplits] = useState<SplitItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  if (!group || !group.id) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Group not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  useFocusEffect(
    React.useCallback(() => {
      fetchGroupSplits();
      fetchGroupMembers();
    }, [group.id]),
  );

  const fetchGroupMembers = async () => {
    try {
      const groupDoc = await firestore().collection('groups').doc(group!.id).get();
      const membersData: string[] = groupDoc.data()?.members || [];
      const memberPromises = membersData.map(async (email: string) => {
        const snap = await firestore().collection('users').where('email', '==', email).get();
        if (!snap.empty) {
          const ud = snap.docs[0].data();
          return {email, name: ud.name || ud.displayName || email.split('@')[0], avatar: ud.avatar || null, userId: snap.docs[0].id};
        }
        return {email, name: email.split('@')[0], avatar: null, userId: null};
      });
      setGroupMembers(await Promise.all(memberPromises));
    } catch (_) {}
  };

  const fetchGroupSplits = async () => {
    try {
      setLoading(true);
      const snap = await firestore().collection('groups').doc(group!.id).collection('splits').get();
      const fetched = snap.docs
        .map(doc => ({id: doc.id, ...doc.data()} as SplitItem))
        .sort((a, b) => {
          const aTs = (a.date || a.createdAt)?.toMillis?.() ?? 0;
          const bTs = (b.date || b.createdAt)?.toMillis?.() ?? 0;
          return bTs - aTs;
        });
      setTotalSplitAmount(fetched.reduce((sum, s) => sum + parseFloat(String(s.amount)), 0));
      setSplits(fetched);
    } catch (_) {
      Alert.alert('Error', 'Failed to fetch group splits');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSplit = async (split: SplitItem) => {
    try {
      await firestore().collection('groups').doc(group!.id).collection('splits').doc(split.id).delete();
      try {
        await SplitNotificationService.notifySplitDeleted(
          split,
          {id: group!.id, name: group!.name, members: groupMembers.map(m => m.email)},
          user?.displayName || user?.email?.split('@')[0] || 'Someone',
        );
      } catch (_) {}
      fetchGroupSplits();
      Alert.alert('Success', 'Split deleted successfully');
    } catch (_) {
      Alert.alert('Error', 'Failed to delete split');
    }
  };

  const calculateNetLendingBalances = (splitsArr: SplitItem[]): LendingDetail[] => {
    const balances: Record<string, Record<string, number>> = {};
    splitsArr.forEach(split => {
      const paidByEmail = split.paidBy?.email;
      const splitUsers = split.splitUsers || [];
      const amount = parseFloat(String(split.amount));
      const perUser = amount / splitUsers.length;
      if (!paidByEmail) return;
      if (!balances[paidByEmail]) balances[paidByEmail] = {};
      splitUsers.forEach(u => {
        if (!u.email || u.email === paidByEmail) return;
        balances[paidByEmail][u.email] = (balances[paidByEmail][u.email] || 0) + perUser;
      });
    });
    const net: LendingDetail[] = [];
    Object.keys(balances).forEach(lenderEmail => {
      Object.keys(balances[lenderEmail]).forEach(borrowerEmail => {
        const lTob = balances[lenderEmail][borrowerEmail] || 0;
        const bToL = (balances[borrowerEmail]?.[lenderEmail]) || 0;
        const netAmt = lTob - bToL;
        if (netAmt !== 0) {
          const lenderName = splitsArr.find(s => s.paidBy?.email === lenderEmail)?.paidBy?.name || lenderEmail.split('@')[0];
          const borrowerName = splitsArr.find(s => s.splitUsers?.some(u => u.email === borrowerEmail))?.splitUsers?.find(u => u.email === borrowerEmail)?.name || borrowerEmail.split('@')[0];
          net.push({
            lender: {email: netAmt > 0 ? lenderEmail : borrowerEmail, name: netAmt > 0 ? lenderName : borrowerName},
            borrower: {email: netAmt > 0 ? borrowerEmail : lenderEmail, name: netAmt > 0 ? borrowerName : lenderName},
            amount: Math.abs(netAmt),
          });
        }
      });
    });
    return net.reduce<LendingDetail[]>((acc, cur) => {
      const exists = acc.find(e =>
        (e.lender.email === cur.lender.email && e.borrower.email === cur.borrower.email) ||
        (e.lender.email === cur.borrower.email && e.borrower.email === cur.lender.email),
      );
      if (!exists) acc.push(cur);
      return acc;
    }, []);
  };

  useEffect(() => {
    if (splits.length > 0) setDetailedLendingInfo(calculateNetLendingBalances(splits));
  }, [splits]);

  useEffect(() => { setFilteredSplits(splits); }, [splits]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) { setFilteredSplits(splits); return; }
    const filtered = splits.filter(split => {
      const matchTitle = (split.title ?? '').toLowerCase().includes(query.toLowerCase());
      const matchDate = moment((split.date || split.createdAt)!.toDate()).format('MMM D, YYYY').toLowerCase().includes(query.toLowerCase());
      const matchCategory = split.category?.toLowerCase().includes(query.toLowerCase());
      const matchAmount = String(split.amount).includes(query);
      const matchPaidBy = (split.paidBy?.name ?? '').toLowerCase().includes(query.toLowerCase());
      return matchTitle || matchDate || matchCategory || matchAmount || matchPaidBy;
    });
    setFilteredSplits(filtered);
  };

  const handleSettleUp = (lender?: LendingDetail['lender'], borrower?: LendingDetail['borrower'], amount?: number) => {
    navigation.navigate('SettleUp', {
      group: {...group, members: groupMembers},
      lendingDetails: detailedLendingInfo,
      preselect: lender && borrower ? {lender, borrower, amount} : undefined,
    });
  };

  const renderGroupSummaryCard = () => (
    <Card style={[styles.groupSummaryCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 2}>
      <View style={styles.cardContent}>
        <Text style={styles.titleText}>{group!.name}</Text>
        <View style={styles.groupMemberAvatars}>
          {groupMembers.slice(0, 4).map(member => (
            <View key={member.email} style={styles.memberWrapper}>
              <UserAvatar size={40} name={member.name} src={member.avatar ?? undefined} style={styles.groupMemberAvatar} />
              <Text style={styles.memberName} numberOfLines={1} ellipsizeMode="tail">{member.name}</Text>
            </View>
          ))}
          {groupMembers.length > 4 && (
            <View style={[styles.memberWrapper, styles.extraMembersAvatar]}>
              <Text style={styles.extraMembersText}>+{groupMembers.length - 4}</Text>
            </View>
          )}
        </View>
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={[styles.iconButton, styles.editButton]} onPress={() => navigation.navigate('Split', {editGroup: group})} accessibilityLabel="Edit group" accessibilityRole="button">
            <MaterialCommunityIcons name="pencil" size={24} color={PRIMARY_COLOR} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.leaveButton]}
            onPress={() => {
              Alert.alert('Leave Group', 'Are you sure you want to leave this group? You will be removed from future splits.', [
                {text: 'Cancel', style: 'cancel'},
                {text: 'Leave', style: 'destructive', onPress: async () => {
                  try {
                    const userEmail = (user?.email || '').toLowerCase();
                    if (!userEmail) { Alert.alert('Error', 'User not found'); return; }
                    await firestore().collection('groups').doc(group!.id).update({
                      members: firestore.FieldValue.arrayRemove(userEmail),
                      [`memberNames.${userEmail}`]: firestore.FieldValue.delete(),
                    });
                    Alert.alert('Left Group', 'You have left the group.');
                    navigation.goBack();
                  } catch (_) { Alert.alert('Error', 'Failed to leave group'); }
                }},
              ]);
            }}
            accessibilityLabel="Leave group" accessibilityRole="button">
            <MaterialCommunityIcons name="exit-to-app" size={24} color={EXPENSE_COLOR} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, styles.deleteButton]}
            onPress={() => {
              Alert.alert('Delete Group', 'Are you sure you want to delete this group and its splits? This cannot be undone.', [
                {text: 'Cancel', style: 'cancel'},
                {text: 'Delete', style: 'destructive', onPress: async () => {
                  try {
                    const splitsRef = firestore().collection('groups').doc(group!.id).collection('splits');
                    const snapshot = await splitsRef.get();
                    const batch = firestore().batch();
                    snapshot.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    await firestore().collection('groups').doc(group!.id).delete();
                    Alert.alert('Deleted', 'Group deleted successfully');
                    navigation.goBack();
                  } catch (_) { Alert.alert('Error', 'Failed to delete group'); }
                }},
              ]);
            }}
            accessibilityLabel="Delete group" accessibilityRole="button">
            <MaterialCommunityIcons name="delete-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  const renderStatsSummary = () => {
    const currentEmail = user?.email?.toLowerCase();
    const myShare = splits.reduce((total, split) => {
      if (split.type === 'settlement' || split.isSettlement) return total;
      const splitUsers = split.splitUsers || [];
      const isParticipant = splitUsers.some(u => u.email?.toLowerCase() === currentEmail);
      if (!isParticipant) return total;
      if (split.splitType === 'percentage') {
        const entry = splitUsers.find(u => u.email?.toLowerCase() === currentEmail);
        return total + parseFloat(String(split.amount)) * ((entry?.percentage || 0) / 100);
      }
      return total + parseFloat(String(split.amount)) / splitUsers.length;
    }, 0);
    return (
      <View style={styles.statsRow}>
        <Card style={[styles.statCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 1}>
          <View style={styles.statCardContent}>
            <View style={[styles.statIconCircle, {backgroundColor: PRIMARY_COLOR + '18'}]}>
              <MaterialCommunityIcons name="receipt" size={18} color={PRIMARY_COLOR} />
            </View>
            <Text style={styles.statCardLabel}>Total Spent</Text>
            <Text style={[styles.statCardValue, {color: PRIMARY_COLOR}]}>{formatAmount(totalSplitAmount)}</Text>
          </View>
        </Card>
        <Card style={[styles.statCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 1}>
          <View style={styles.statCardContent}>
            <View style={[styles.statIconCircle, {backgroundColor: EXPENSE_COLOR + '18'}]}>
              <MaterialCommunityIcons name="account-cash" size={18} color={EXPENSE_COLOR} />
            </View>
            <Text style={styles.statCardLabel}>Your Share</Text>
            <Text style={[styles.statCardValue, {color: EXPENSE_COLOR}]}>{formatAmount(myShare)}</Text>
          </View>
        </Card>
      </View>
    );
  };

  const renderDetailedLendingSummary = () => {
    const visibleDetails = detailedLendingInfo.filter(d => d.amount > 0.009);
    if (visibleDetails.length === 0) return null;
    const currentEmail = user?.email?.toLowerCase();
    const hasActionable = visibleDetails.some(d => currentEmail && (currentEmail === d.borrower.email?.toLowerCase() || currentEmail === d.lender.email?.toLowerCase()));
    return (
      <View style={styles.lendingSummaryContainer}>
        <Text style={styles.sectionHeaderText}>Settlement Suggestions</Text>
        {visibleDetails.map((detail, index) => {
          const payerEmail = detail.borrower.email?.toLowerCase();
          const receiverEmail = detail.lender.email?.toLowerCase();
          const viewerPays = currentEmail && currentEmail === payerEmail;
          const viewerReceives = currentEmail && currentEmail === receiverEmail;
          const amountStr = formatAmount(detail.amount);
          return (
            <Card key={index} style={[styles.lendingSummaryCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 1}>
              <View style={styles.lendingSummaryContent}>
                <View style={styles.lendingUserContainer}>
                  <UserAvatar size={40} name={detail.borrower.name} />
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#959698" style={styles.arrowIcon} />
                  <UserAvatar size={40} name={detail.lender.name} />
                </View>
                {viewerPays ? (
                  <Text style={styles.lendingDetailText}>
                    You pay {detail.lender.name} <Text style={[styles.amountStrongText, {color: EXPENSE_COLOR}]}>{amountStr}</Text>
                  </Text>
                ) : viewerReceives ? (
                  <>
                    <Text style={styles.lendingDetailText}>
                      You receive <Text style={[styles.amountStrongText, {color: SUCCESS_COLOR}]}>{amountStr}</Text> from {detail.borrower.name}
                    </Text>
                    <TouchableOpacity
                      style={styles.remindIconButton}
                      onPress={async () => {
                        try {
                          const lenderDoc = await firestore().collection('users').where('email', '==', user?.email).get();
                          const lenderName = lenderDoc.docs[0]?.data()?.name || user?.email?.split('@')[0] || 'Someone';
                          const result = await SplitNotificationService.notifyPaymentReminder(
                            group, detail.borrower, {name: lenderName, email: user?.email}, amountStr,
                          );
                          if (result?.reason === 'cooldown') {
                            Alert.alert('Already Reminded', 'You already sent a reminder in the last 24 hours.');
                          } else if (result?.success) {
                            Alert.alert('Reminder Sent', `${detail.borrower.name} has been reminded to pay you.`);
                          }
                        } catch (_) { Alert.alert('Error', 'Failed to send reminder'); }
                      }}>
                      <MaterialCommunityIcons name="bell-outline" size={18} color={PRIMARY_COLOR} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.lendingDetailText}>
                    {detail.borrower.name} pays {detail.lender.name} <Text style={styles.amountStrongText}>{amountStr}</Text>
                  </Text>
                )}
              </View>
            </Card>
          );
        })}
        {hasActionable && (
          <Button mode="contained" onPress={() => handleSettleUp()} style={styles.settleAllButton} textColor="#fff">
            Settle Up
          </Button>
        )}
      </View>
    );
  };

  const renderSplitsList = () => {
    const splitsToShow = filteredSplits.slice(0, RECENT_SPLITS_LIMIT);
    const currentEmail = user?.email?.toLowerCase();
    return (
      <View style={styles.splitsList}>
        {filteredSplits.length > 0 ? (
          <>
            {splitsToShow.map(split => {
              const splitColor = getSplitCardColor(split, currentEmail);
              return (
                <Card key={split.id} style={[styles.splitCard, Platform.OS === 'android' && styles.cardAndroid]} elevation={Platform.OS === 'android' ? 0 : 1}>
                  <TouchableOpacity style={styles.splitCardContent} onPress={() => navigation.navigate('SplitDetail', {group, split})}>
                    <View style={[styles.splitColorBar, {backgroundColor: splitColor}]} />
                    <View style={styles.splitCardDetails}>
                      <Text style={styles.splitTitle}>{split.title}</Text>
                      <Text style={styles.splitSubtitle}>Paid by {split.paidBy?.name || split.paidBy?.email}</Text>
                      <Text style={styles.splitDate}>{moment((split.date || split.createdAt)!.toDate()).format('MMM D, YYYY')}</Text>
                      {split.category && (
                        <View style={styles.categoryTag}>
                          <Text style={styles.categoryText}>{split.category}</Text>
                        </View>
                      )}
                      {split.recurring?.enabled && (
                        <View style={styles.recurringTag}>
                          <MaterialCommunityIcons name="repeat" size={11} color="#677CD2" />
                          <Text style={styles.recurringTagText}>{split.recurring.frequency === 'weekly' ? 'Weekly' : 'Monthly'}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.splitCardRight}>
                      <Text style={[styles.splitAmount, {color: splitColor}]}>{formatAmount(Number(split.amount))}</Text>
                    </View>
                  </TouchableOpacity>
                </Card>
              );
            })}
            {filteredSplits.length > RECENT_SPLITS_LIMIT && (
              <TouchableOpacity onPress={() => navigation.navigate('SplitTransaction', {group})} style={styles.showAllButton}>
                <Text style={styles.showAllText}>Show all transactions</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={PRIMARY_COLOR} />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <Text style={styles.noSplitsText}>{searchQuery ? 'No splits found matching your search' : 'No splits yet'}</Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading group details...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <KeyboardAwareScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {renderGroupSummaryCard()}
          {renderStatsSummary()}
          {renderDetailedLendingSummary()}
          <View style={styles.splitsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Recent Splits</Text>
            </View>
            {renderSplitsList()}
          </View>
        </KeyboardAwareScrollView>
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateSplit', {group})} accessibilityLabel="Add split" accessibilityRole="button">
          <MaterialCommunityIcons name="plus" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaProvider>
  );
};

export default SplitGroupDetailScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR, paddingHorizontal: 20},
  scrollView: {flex: 1},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BACKGROUND_COLOR},
  loadingText: {fontSize: 16, color: PRIMARY_COLOR, marginTop: 15, fontFamily: 'Lato-Regular'},
  splitsSection: {paddingBottom: 30},
  groupSummaryCard: {backgroundColor: PRIMARY_COLOR, padding: 20, marginTop: 20, marginBottom: 15},
  cardContent: {alignItems: 'center'},
  titleText: {fontSize: 24, color: '#fff', marginBottom: 10, fontWeight: '600'},
  balanceText: {fontSize: 22, fontWeight: '500', color: '#fff'},
  sectionHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15},
  sectionHeaderText: {fontSize: 20, fontWeight: 'bold', color: '#2C2C2C', fontFamily: 'Kufam-SemiBoldItalic'},
  splitsList: {marginBottom: 30},
  splitCard: {marginBottom: 10, backgroundColor: '#fff', overflow: 'hidden'},
  splitCardContent: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch'},
  splitColorBar: {width: 4, alignSelf: 'stretch'},
  splitCardDetails: {flex: 1, paddingVertical: 12, paddingHorizontal: 12},
  splitTitle: {fontSize: 16, fontWeight: '500', color: '#3A3B3E'},
  splitSubtitle: {fontSize: 12, color: '#959698', marginTop: 4},
  showAllButton: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginTop: 5},
  showAllText: {color: PRIMARY_COLOR, fontSize: 14, fontWeight: '500', marginRight: 5},
  splitAmount: {fontSize: 16, fontWeight: '500', color: PRIMARY_COLOR},
  noSplitsText: {textAlign: 'center', color: '#959698', marginTop: 20},
  backButton: {marginTop: 20, padding: 10, backgroundColor: PRIMARY_COLOR, borderRadius: 5},
  lendingSummaryContainer: {marginTop: 15},
  lendingSummaryCard: {marginVertical: 10, padding: 15, backgroundColor: '#fff'},
  lendingDetailText: {fontSize: 14, color: '#3A3B3E', marginBottom: 5},
  amountStrongText: {fontSize: 14, fontWeight: '700', marginLeft: 6, color: '#2C2C2C'},
  groupMemberAvatars: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10},
  groupMemberAvatar: {borderWidth: 2, borderColor: '#fff'},
  memberWrapper: {alignItems: 'center', width: 64, marginHorizontal: 4},
  memberName: {color: '#fff', fontSize: 10, marginTop: 4, maxWidth: 56, textAlign: 'center'},
  extraMembersAvatar: {backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center'},
  extraMembersText: {color: '#fff', fontSize: 12},
  splitCardRight: {flexDirection: 'row', alignItems: 'center', paddingRight: 12},
  lendingSummaryContent: {alignItems: 'center', padding: 15, position: 'relative'},
  actionButtonsRow: {flexDirection: 'row', width: '100%', justifyContent: 'center', marginTop: 10, gap: 20},
  iconButton: {width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center'},
  editButton: {backgroundColor: '#fff'},
  leaveButton: {backgroundColor: '#fff'},
  deleteButton: {backgroundColor: '#2E3E8B'},
  lendingUserContainer: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  arrowIcon: {marginHorizontal: 10},
  splitDate: {fontSize: 12, color: '#959698', marginTop: 2},
  categoryTag: {backgroundColor: PRIMARY_COLOR + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginTop: 5, alignSelf: 'flex-start'},
  categoryText: {fontSize: 12, color: PRIMARY_COLOR},
  settleAllButton: {marginTop: 10, backgroundColor: PRIMARY_COLOR},
  fab: {position: 'absolute', right: 24, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: PRIMARY_COLOR, alignItems: 'center', justifyContent: 'center', elevation: Platform.OS === 'android' ? 0 : 3, shadowColor: PRIMARY_COLOR, shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.15, shadowRadius: 3},
  remindIconButton: {position: 'absolute', top: 8, right: 8, padding: 6, borderRadius: 20, backgroundColor: '#EEF0FB'},
  recurringTag: {flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EEF0FB', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, marginTop: 4, alignSelf: 'flex-start'},
  recurringTagText: {fontSize: 11, color: '#677CD2', fontFamily: 'Lato-Regular'},
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
  statsRow: {flexDirection: 'row', marginBottom: 15, gap: 12},
  statCard: {flex: 1, borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden'},
  statCardContent: {alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10},
  statIconCircle: {width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 6},
  statCardLabel: {fontSize: 11, color: '#888', marginBottom: 3, fontFamily: 'Lato-Regular', textAlign: 'center'},
  statCardValue: {fontSize: 15, fontWeight: '700', fontFamily: 'Lato-Bold', textAlign: 'center'},
});
