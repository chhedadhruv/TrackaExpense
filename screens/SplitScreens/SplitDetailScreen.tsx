import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
  Linking,
} from 'react-native';
import {Text, Card} from 'react-native-paper';
import UserAvatar from 'react-native-user-avatar';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {getAuth} from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  where,
} from '@react-native-firebase/firestore';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {useFocusEffect} from '@react-navigation/native';
import SplitNotificationService from '../../services/SplitNotificationService';
import {useCurrency} from '../../utils/CurrencyUtil';
import {
  PRIMARY_COLOR,
  BACKGROUND_COLOR,
  EXPENSE_COLOR,
} from '../../src/constants/theme';

const SUCCESS_COLOR = '#25B07F';

interface SplitUser {
  email: string;
  name: string;
  userId?: string;
  percentage?: number;
}

interface SplitData {
  id: string;
  title?: string;
  amount: number;
  type?: string;
  splitType?: string;
  category?: string;
  notes?: string;
  imageUrl?: string;
  paidBy: {email: string; name: string; userId?: string};
  splitUsers: SplitUser[];
  date?: {toDate: () => Date};
  createdAt?: {toDate: () => Date};
  settlement?: {from?: object; to?: object; amount?: number};
  recurring?: {enabled?: boolean; frequency?: string};
}

interface Group {
  id: string;
  name: string;
  members?: string[];
}

const SplitDetailScreen = ({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) => {
  const {formatAmount} = useCurrency();
  const {split: initialSplit, group} = route.params as {
    split: SplitData;
    group: Group;
    transaction?: object;
  };
  const currentUser = getAuth().currentUser;
  const [split, setSplit] = React.useState<SplitData>(initialSplit);
  const [, setLoading] = React.useState(false);
  const [, setMenuVisible] = React.useState(false);
  const isSettlement = split.type === 'settlement';

  const fetchSplitData = React.useCallback(async () => {
    try {
      setLoading(true);
      const splitDoc = await getDoc(
        doc(getFirestore(), 'groups', group.id, 'splits', initialSplit.id),
      );
      if (splitDoc.exists) {
        setSplit({id: splitDoc.id, ...splitDoc.data()} as SplitData);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [group.id, initialSplit.id]);

  useFocusEffect(
    React.useCallback(() => {
      fetchSplitData();
    }, [fetchSplitData]),
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
      await deleteDoc(
        doc(getFirestore(), 'groups', group.id, 'splits', split.id),
      );

      let actorName = currentUser?.email?.split('@')[0] || 'Someone';
      try {
        const userDoc = await getDoc(
          doc(getFirestore(), 'users', currentUser!.uid),
        );
        const profileName = userDoc.data()?.name;
        if (profileName && profileName.toLowerCase() !== 'me') {
          actorName = profileName;
        }
      } catch (_) {}

      const historyPayload = {
        type: 'delete',
        groupId: group.id,
        groupName: group.name,
        splitId: split.id,
        splitTitle: split.title,
        amount: split.amount,
        category: split.category || null,
        date: split.date || split.createdAt || null,
        paidBy: split.paidBy || null,
        splitType:
          split.type === 'settlement'
            ? 'settlement'
            : split.splitType ||
              (split.splitUsers?.some(u => u.percentage)
                ? 'percentage'
                : 'equal'),
        settlement:
          split.type === 'settlement'
            ? split.settlement || {
                from: split.paidBy,
                to: split.splitUsers?.[0],
                amount: split.amount,
              }
            : undefined,
        actorUid: currentUser?.uid || null,
        actorEmail: currentUser?.email || null,
        actorName,
        createdAt: serverTimestamp(),
      };

      try {
        await addDoc(
          collection(getFirestore(), 'users', currentUser!.uid, 'splitHistory'),
          historyPayload,
        );
        await addDoc(
          collection(getFirestore(), 'groups', group.id, 'splitHistory'),
          historyPayload,
        );
      } catch (_) {}

      try {
        const groupDoc = await getDoc(doc(getFirestore(), 'groups', group.id));
        const groupData = groupDoc.data();
        if (groupData?.members) {
          await SplitNotificationService.notifySplitDeleted(
            {id: split.id, title: split.title ?? '', amount: split.amount},
            {
              id: group.id,
              name: group.name || groupData.name,
              members: groupData.members,
            },
            actorName,
          );
        }
      } catch (_) {}

      try {
        const txSnap = await getDocs(
          query(
            collection(
              getFirestore(),
              'users',
              currentUser!.uid,
              'transactions',
            ),
            where('splitId', '==', split.id),
          ),
        );
        if (!txSnap.empty) {
          await deleteDoc(txSnap.docs[0].ref);
        }
      } catch (_) {}

      setMenuVisible(false);
      Alert.alert('Deleted', 'Split deleted successfully');
      navigation.goBack();
    } catch (_) {
      Alert.alert('Error', 'Failed to delete split');
    }
  };

  const formatDate = (timestamp: {toDate: () => Date} | undefined): string => {
    if (!timestamp) {
      return '';
    }
    return timestamp
      .toDate()
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
                  -{formatAmount(split.amount)}
                </Text>
              </View>
            </View>
          </View>
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
                  +{formatAmount(split.amount)}
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
          ? formatAmount(split.amount * ((user.percentage ?? 0) / 100))
          : formatAmount(split.amount / split.splitUsers.length);
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
              {isSettlement
                ? 'Payment settlement information'
                : 'Expense split breakdown'}
            </Text>
          </View>
          <Card
            style={[
              styles.summaryCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 2}>
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
                    {formatAmount(split.amount)}
                  </Text>
                  {split.recurring?.enabled ? (
                    <View style={styles.recurringBadge}>
                      <MaterialCommunityIcons
                        name="repeat"
                        size={12}
                        color="#677CD2"
                      />
                      <Text style={styles.recurringBadgeText}>
                        {split.recurring.frequency === 'weekly'
                          ? 'Weekly'
                          : 'Monthly'}{' '}
                        recurring
                      </Text>
                    </View>
                  ) : null}
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
                      {split.splitType === 'percentage'
                        ? 'Percentage'
                        : 'Equal'}
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
                {!isSettlement && split.notes ? (
                  <View style={[styles.detailItem, {width: '100%'}]}>
                    <Text style={styles.detailLabel}>Notes</Text>
                    <Text
                      style={[
                        styles.detailValue,
                        {
                          fontFamily: 'Lato-Regular',
                          fontSize: 14,
                          fontWeight: '400',
                        },
                      ]}>
                      {split.notes}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Card>
          <View style={styles.breakdownSection}>
            <Text style={styles.sectionTitle}>
              {isSettlement ? 'Settlement Details' : 'Split Breakdown'}
            </Text>
            {renderSplitUserDetails()}
          </View>
          {split.imageUrl ? (
            <View style={styles.receiptSection}>
              <Text style={styles.sectionTitle}>Receipt</Text>
              <TouchableOpacity
                onPress={() => Linking.openURL(split.imageUrl!)}
                activeOpacity={0.9}>
                <Image
                  source={{uri: split.imageUrl}}
                  style={styles.receiptImage}
                  resizeMode="cover"
                />
                <Text style={styles.receiptTapHint}>Tap to open full size</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() =>
                navigation.navigate('CreateSplit', {group, split})
              }>
              <MaterialCommunityIcons name="pencil" size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={confirmAndDelete}>
              <MaterialCommunityIcons
                name="trash-can"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
};

export default SplitDetailScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
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
  summaryCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cardContent: {padding: 25},
  summaryHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 20},
  summaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  summaryInfo: {flex: 1},
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
  detailItem: {width: '48%', marginBottom: 15},
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
  breakdownSection: {paddingHorizontal: 20, marginBottom: 20},
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
    elevation: Platform.OS === 'android' ? 0 : 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  transactionsCardImage: {borderRadius: 10},
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
  positiveAmount: {color: SUCCESS_COLOR},
  negativeAmount: {color: EXPENSE_COLOR},
  percentageText: {fontSize: 12, color: '#959698', marginTop: 2},
  roleText: {fontSize: 12, color: '#959698', marginTop: 2},
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
    elevation: Platform.OS === 'android' ? 0 : 1,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EXPENSE_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    elevation: Platform.OS === 'android' ? 0 : 1,
    shadowColor: EXPENSE_COLOR,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
  },
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
  receiptSection: {paddingHorizontal: 20, marginBottom: 20},
  receiptImage: {width: '100%', height: 200, borderRadius: 12, marginTop: 10},
  receiptTapHint: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 6,
    fontFamily: 'Lato-Regular',
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: '#EEF0FB',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  recurringBadgeText: {
    fontSize: 11,
    color: '#677CD2',
    fontFamily: 'Lato-Regular',
  },
});
