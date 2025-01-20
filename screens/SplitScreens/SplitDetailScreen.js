import React from 'react';
import {View, ScrollView, StyleSheet, TouchableOpacity} from 'react-native';
import {Text, Menu, IconButton} from 'react-native-paper';
import UserAvatar from 'react-native-user-avatar';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const SplitDetailScreen = ({route, navigation}) => {
  const {split, group, transaction} = route.params;
  const currentUser = auth().currentUser;
  const isSettlement = split.type === 'settlement';
  const [menuVisible, setMenuVisible] = React.useState(false);

  const handleDeleteSplit = async () => {
    try {
      await firestore()
        .collection('groups')
        .doc(group.id)
        .collection('splits')
        .doc(split.id)
        .delete();

      setMenuVisible(false);
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting split:', error);
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
                  {split.splitUsers[0].email === currentUser?.email ? ' (You)' : ''}
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
    <ScrollView style={styles.container}>
      <View style={styles.myCard}>
        <View style={styles.cardContentWithIcon}>
          <View style={[styles.Icon, isSettlement && styles.settlementIcon]}>
            <MaterialCommunityIcons
              name={isSettlement ? 'bank-transfer' : 'cash-multiple'}
              color="#fff"
              size={24}
            />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.TitleText}>
              {isSettlement ? 'Settlement' : split.title}
            </Text>
            <Text style={styles.BalanceText}>
              ₹{parseFloat(split.amount).toLocaleString()}
            </Text>
          </View>
        </View>

        <View style={styles.dataCard}>
          <View style={styles.cardContent}>
            <Text style={styles.TitleText}>Date</Text>
            <Text style={styles.ValueText}>
              {formatDate(split.date || split.createdAt)}
            </Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.TitleText}>Type</Text>
            <Text style={styles.ValueText}>
              {isSettlement ? 'Settlement' : split.category || 'Expense'}
            </Text>
          </View>
          {!isSettlement && (
            <View style={styles.cardContent}>
              <Text style={styles.TitleText}>Split Type</Text>
              <Text style={styles.ValueText}>
                {split.splitType === 'percentage' ? 'Percentage' : 'Equal'}
              </Text>
            </View>
          )}
        </View>

        {!isSettlement && (
          <View style={[styles.dataCard, {marginTop: 10}]}>
            <View style={styles.cardContent}>
              <Text style={styles.TitleText}>Paid By</Text>
              <Text style={styles.ValueText}>
                {split.paidBy.name || split.paidBy.email}
              </Text>
            </View>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>
        {isSettlement ? 'Settlement Details' : 'Split Breakdown'}
      </Text>
      {renderSplitUserDetails()}
      <View style={styles.buttonContainer}>
    <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('CreateSplit', { group, split })}>
      <Text style={styles.buttonText}>Edit</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteSplit}>
      <Text style={styles.buttonText}>Delete</Text>
    </TouchableOpacity>
  </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
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
    padding: 15,
    marginVertical: 5,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    fontWeight: '500',
    color: '#3A3B3E',
  },
  splitAmount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#677CD2',
    marginTop: 2,
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
    paddingHorizontal: 10,
    paddingVertical: 15,
  },
  button: {
    width: '48%',
    height: 45,
    borderRadius: 24,
    backgroundColor: '#677CD2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: '48%',
    height: 45,
    borderRadius: 24,
    backgroundColor: '#F64E4E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
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