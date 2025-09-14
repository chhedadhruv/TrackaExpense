import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {ActivityIndicator, Card, Button, Menu} from 'react-native-paper';
import {useFocusEffect} from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import UserAvatar from 'react-native-user-avatar';
import firestore from '@react-native-firebase/firestore';
import moment from 'moment';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const SUCCESS_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';
const SplitGroupDetailScreen = ({route, navigation}) => {
  const {group} = route.params || {};
  const [loading, setLoading] = useState(true);
  const [splits, setSplits] = useState([]);
  const [totalSplitAmount, setTotalSplitAmount] = useState(0);
  const [userSplits, setUserSplits] = useState({});
  const [detailedLendingInfo, setDetailedLendingInfo] = useState([]);
  const [menuVisibleForSplit, setMenuVisibleForSplit] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [showAllSplits, setShowAllSplits] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSplits, setFilteredSplits] = useState([]);
  const RECENT_SPLITS_LIMIT = 3;
  if (!group || !group.id) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Group not found</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
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
      const groupDoc = await firestore()
        .collection('groups')
        .doc(group.id)
        .get();
      const membersData = groupDoc.data()?.members || [];
      const memberPromises = membersData.map(async email => {
        const userSnapshot = await firestore()
          .collection('users')
          .where('email', '==', email)
          .get();
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          return {
            email,
            name: userData.name || userData.displayName || email.split('@')[0],
            avatar: userData.avatar || null,
            userId: userSnapshot.docs[0].id,
          };
        }
        return {
          email,
          name: email.split('@')[0],
          avatar: null,
          userId: null,
        };
      });
      const formattedMembers = await Promise.all(memberPromises);
      setGroupMembers(formattedMembers);
    } catch (error) {
    }
  };
  const fetchGroupSplits = async () => {
    try {
      setLoading(true);
      const splitsSnapshot = await firestore()
        .collection('groups')
        .doc(group.id)
        .collection('splits')
        .orderBy('createdAt', 'desc')
        .get();
      const fetchedSplits = splitsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      const totalAmount = fetchedSplits.reduce(
        (sum, split) => sum + parseFloat(split.amount),
        0,
      );
      const userSplitCalculations = calculateUserSplits(fetchedSplits);
      setSplits(fetchedSplits);
      setTotalSplitAmount(totalAmount);
      setUserSplits(userSplitCalculations);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch group splits');
    } finally {
      setLoading(false);
    }
  };
  const handleEditSplit = split => {
    navigation.navigate('CreateSplit', {group, split});
    setMenuVisibleForSplit(null);
  };
  const handleDeleteSplit = async split => {
    try {
      await firestore()
        .collection('groups')
        .doc(group.id)
        .collection('splits')
        .doc(split.id)
        .delete();
      // Refresh splits after deletion
      fetchGroupSplits();
      setMenuVisibleForSplit(null);
      Alert.alert('Success', 'Split deleted successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to delete split');
    }
  };
  const calculateUserSplits = splits => {
    const userSplitMap = {};
    splits.forEach(split => {
      const paidByUser = split.paidBy;
      const splitUsers = split.splitUsers || [];
      // Calculate how much each user owes or is owed
      const splitAmount = parseFloat(split.amount) / splitUsers.length;
      splitUsers.forEach(user => {
        if (!userSplitMap[user.email]) {
          userSplitMap[user.email] = {
            paid: 0,
            owed: 0,
            name: user.name || user.email,
          };
        }
        if (user.email === paidByUser.email) {
          userSplitMap[user.email].paid += parseFloat(split.amount);
        } else {
          userSplitMap[user.email].owed += splitAmount;
        }
      });
    });
    return userSplitMap;
  };
  const calculateNetLendingBalances = splits => {
    const userLendingBalances = {};
    splits.forEach(split => {
      const paidByUser = split.paidBy;
      const splitUsers = split.splitUsers || [];
      const splitAmount = parseFloat(split.amount);
      const splitPerUser = splitAmount / splitUsers.length;
      // Initialize user balances if not exist
      if (!userLendingBalances[paidByUser.email]) {
        userLendingBalances[paidByUser.email] = {};
      }
      splitUsers.forEach(user => {
        if (user.email !== paidByUser.email) {
          // If not already initialized, set the balance to 0
          if (!userLendingBalances[paidByUser.email][user.email]) {
            userLendingBalances[paidByUser.email][user.email] = 0;
          }
          // Add the amount that this user owes
          userLendingBalances[paidByUser.email][user.email] += splitPerUser;
        }
      });
    });
    // Calculate net lending balances
    const netLendingBalances = [];
    // Iterate through all lenders
    Object.keys(userLendingBalances).forEach(lenderEmail => {
      const borrowerBalances = userLendingBalances[lenderEmail];
      // Check lending with each borrower
      Object.keys(borrowerBalances).forEach(borrowerEmail => {
        const lenderToborrowerAmount = borrowerBalances[borrowerEmail] || 0;
        // Check if reverse lending exists
        const borrowerToLenderAmount =
          (userLendingBalances[borrowerEmail] &&
            userLendingBalances[borrowerEmail][lenderEmail]) ||
          0;
        // Calculate net amount
        const netAmount = lenderToborrowerAmount - borrowerToLenderAmount;
        if (netAmount !== 0) {
          // Find names using the first available method
          const lenderName =
            splits.find(s => s.paidBy.email === lenderEmail)?.paidBy.name ||
            lenderEmail.split('@')[0];
          const borrowerName =
            splits
              .find(s => s.splitUsers.some(u => u.email === borrowerEmail))
              ?.splitUsers.find(u => u.email === borrowerEmail)?.name ||
            borrowerEmail.split('@')[0];
          netLendingBalances.push({
            lender: {
              email: netAmount > 0 ? lenderEmail : borrowerEmail,
              name: netAmount > 0 ? lenderName : borrowerName,
            },
            borrower: {
              email: netAmount > 0 ? borrowerEmail : lenderEmail,
              name: netAmount > 0 ? borrowerName : lenderName,
            },
            amount: Math.abs(netAmount),
          });
        }
      });
    });
    // Remove duplicate entries and keep only the net amounts
    const uniqueNetLendingBalances = netLendingBalances.reduce(
      (acc, current) => {
        const existingEntry = acc.find(
          entry =>
            (entry.lender.email === current.lender.email &&
              entry.borrower.email === current.borrower.email) ||
            (entry.lender.email === current.borrower.email &&
              entry.borrower.email === current.lender.email),
        );
        if (!existingEntry) {
          acc.push(current);
        }
        return acc;
      },
      [],
    );
    return uniqueNetLendingBalances;
  };
  useEffect(() => {
    if (splits.length > 0) {
      const netLendingBalances = calculateNetLendingBalances(splits);
      setDetailedLendingInfo(netLendingBalances);
    }
  }, [splits]);
  const renderGroupSummaryCard = () => (
    <Card style={styles.groupSummaryCard}>
      <View style={styles.cardContent}>
        <Text style={styles.titleText}>{group.name}</Text>
        <View style={styles.groupMemberAvatars}>
          {groupMembers.slice(0, 4).map((member, index) => (
            <UserAvatar
              key={member.email}
              size={40}
              name={member.name}
              src={member.avatar}
              style={[
                styles.groupMemberAvatar,
                {zIndex: 4 - index, marginLeft: index > 0 ? -10 : 0},
              ]}
            />
          ))}
          {groupMembers.length > 4 && (
            <View style={[styles.groupMemberAvatar, styles.extraMembersAvatar]}>
              <Text style={styles.extraMembersText}>
                +{groupMembers.length - 4}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
  const handleSearch = query => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredSplits(splits);
      return;
    }
    const searchTerms = query.toLowerCase().trim().split(' ');
    const filtered = splits.filter(split => {
      const matchTitle = split.title
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchDate = moment(split.createdAt.toDate())
        .format('MMM D, YYYY')
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchCategory = split.category
        ?.toLowerCase()
        .includes(query.toLowerCase());
      const matchAmount = split.amount.toString().includes(query);
      const matchPaidBy = split.paidBy.name
        .toLowerCase()
        .includes(query.toLowerCase());
      return (
        matchTitle || matchDate || matchCategory || matchAmount || matchPaidBy
      );
    });
    setFilteredSplits(filtered);
  };
  const handleSettleUp = (lender, borrower, amount) => {
    navigation.navigate('SettleUp', {
      group: {
        ...group,
        members: groupMembers,
      },
      lendingDetails: detailedLendingInfo,
    });
  };
  const renderSplitsList = () => {
    const splitsToShow = showAllSplits
      ? filteredSplits
      : filteredSplits.slice(0, RECENT_SPLITS_LIMIT);
    return (
      <View style={styles.splitsList}>
        {filteredSplits.length > 0 ? (
          <>
            {splitsToShow.map(split => (
              <Card key={split.id} style={styles.splitCard}>
                <TouchableOpacity
                  style={styles.splitCardContent}
                  onPress={() =>
                    navigation.navigate('SplitDetail', {group, split})
                  }>
                  <View style={styles.splitCardDetails}>
                    <Text style={styles.splitTitle}>{split.title}</Text>
                    <Text style={styles.splitSubtitle}>
                      Paid by {split.paidBy.name || split.paidBy.email}
                    </Text>
                    <Text style={styles.splitDate}>
                      {moment(split.createdAt.toDate()).format('MMM D, YYYY')}
                    </Text>
                    {split.category && (
                      <View style={styles.categoryTag}>
                        <Text style={styles.categoryText}>
                          {split.category}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.splitCardRight}>
                    <Text style={styles.splitAmount}>
                      ₹{parseFloat(split.amount).toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Card>
            ))}
            {filteredSplits.length > 3 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('SplitTransaction', {group})}
                style={styles.showAllButton}>
                <Text style={styles.showAllText}>Show all transactions</Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={PRIMARY_COLOR}
                />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <Text style={styles.noSplitsText}>
            {searchQuery
              ? 'No splits found matching your search'
              : 'No splits yet'}
          </Text>
        )}
      </View>
    );
  };
  // Render detailed lending summary
  const renderDetailedLendingSummary = () => {
    if (detailedLendingInfo.length === 0) {
      return null;
    }
    return (
      <View style={styles.lendingSummaryContainer}>
        <Text style={styles.sectionHeaderText}>Settlement Suggestions</Text>
        {detailedLendingInfo.map((detail, index) => (
          <Card key={index} style={styles.lendingSummaryCard}>
            <View style={styles.lendingSummaryContent}>
              <View style={styles.lendingUserContainer}>
                <UserAvatar size={40} name={detail.borrower.name} />
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={20}
                  color="#959698"
                  style={styles.arrowIcon}
                />
                <UserAvatar size={40} name={detail.lender.name} />
              </View>
              <Text style={styles.lendingDetailText}>
                {detail.borrower.name} should pay ₹
                {detail.amount.toLocaleString()} to {detail.lender.name}
              </Text>
              <Button
                mode="contained"
                onPress={() =>
                  handleSettleUp(detail.lender, detail.borrower, detail.amount)
                }
                style={styles.settleButton}
                textColor="#fff">
                Settle Up
              </Button>
            </View>
          </Card>
        ))}
      </View>
    );
  };
  useEffect(() => {
    setFilteredSplits(splits);
  }, [splits]);
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
        <KeyboardAwareScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="account-group" size={32} color={PRIMARY_COLOR} />
              <Text style={styles.headerTitle}>{group.name}</Text>
            </View>
            <Text style={styles.headerSubtitle}>Group expense details and settlements</Text>
          </View>
          {renderGroupSummaryCard()}
          {renderDetailedLendingSummary()}
          {/* Recent Splits Section */}
          <View style={styles.splitsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Recent Splits</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => navigation.navigate('CreateSplit', {group})}>
                <MaterialCommunityIcons name="plus" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {renderSplitsList()}
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
    paddingHorizontal: 20,
  },
  scrollView: {
    flex: 1,
  },
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
  splitsSection: {
    paddingBottom: 30,
  },
  groupSummaryCard: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 20,
    elevation: 8,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cardContent: {
    alignItems: 'center',
    padding: 25,
  },
  titleText: {
    fontSize: 14,
    color: '#CED6EC',
    marginBottom: 5,
    fontFamily: 'Lato-Regular',
  },
  balanceText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  balanceDetails: {
    fontSize: 12,
    color: '#333',
    marginLeft: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 15,
  },
  sectionHeaderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  addButton: {
    backgroundColor: PRIMARY_COLOR,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userBalanceContainer: {
    marginBottom: 15,
  },
  userBalanceCard: {
    marginBottom: 10,
    padding: 15,
    backgroundColor: '#fff',
  },
  userBalanceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userBalanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userBalanceName: {
    marginLeft: 10,
    fontSize: 16,
    color: '#3A3B3E',
  },
  userBalanceAmount: {
    fontSize: 16,
    fontWeight: '500',
  },
  positiveBalance: {
    color: '#25B07F',
  },
  negativeBalance: {
    color: '#F64E4E',
  },
  splitsList: {
    marginBottom: 30,
  },
  splitCard: {
    marginBottom: 10,
    padding: 15,
    backgroundColor: '#fff',
  },
  splitCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitCardDetails: {
    flex: 1,
  },
  splitTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A3B3E',
  },
  splitSubtitle: {
    fontSize: 12,
    color: '#959698',
    marginTop: 4,
  },
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 5,
  },
  showAllText: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 5,
  },
  splitAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: PRIMARY_COLOR,
  },
  noSplitsText: {
    textAlign: 'center',
    color: '#959698',
    marginTop: 20,
  },
  backButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 5,
  },
  lendingSummaryContainer: {
    marginTop: 15,
  },
  lendingSummaryCard: {
    marginVertical: 10,
    padding: 15,
    backgroundColor: '#fff',
  },
  lenderName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A3B3E',
    marginBottom: 10,
  },
  lendingDetailText: {
    fontSize: 14,
    color: '#959698',
    marginBottom: 5,
  },
  groupSummaryCard: {
    backgroundColor: PRIMARY_COLOR,
    padding: 20,
    marginBottom: 15,
  },
  cardContent: {
    alignItems: 'center',
  },
  titleText: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 10,
    fontWeight: '600',
  },
  groupMemberAvatars: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  groupMemberAvatar: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  extraMembersAvatar: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  extraMembersText: {
    color: '#fff',
    fontSize: 12,
  },
  balanceText: {
    fontSize: 22,
    fontWeight: '500',
    color: '#fff',
  },
  splitCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuAnchor: {
    marginLeft: 10,
  },
  lendingSummaryContent: {
    alignItems: 'center',
    padding: 15,
  },
  lendingUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  arrowIcon: {
    marginHorizontal: 10,
  },
  searchBar: {
    marginBottom: 15,
    elevation: 2,
  },
  splitDate: {
    fontSize: 12,
    color: '#959698',
    marginTop: 2,
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
  },
  settleButton: {
    marginTop: 10,
    backgroundColor: PRIMARY_COLOR,
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 15,
    marginBottom: 10,
  },
  userList: {
    marginBottom: 15,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
  },
  selectedUser: {
    backgroundColor: '#e3e3e3',
  },
  userName: {
    marginLeft: 10,
    flex: 1,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    fontSize: 16,
  },
  summaryText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    width: '45%',
  },
});
export default SplitGroupDetailScreen;
