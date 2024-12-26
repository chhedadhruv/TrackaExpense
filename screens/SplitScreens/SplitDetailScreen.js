import React from 'react';
import {View, ScrollView, StyleSheet} from 'react-native';
import {Text} from 'react-native-paper';
import UserAvatar from 'react-native-user-avatar';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';

const SplitDetailScreen = ({route, navigation}) => {
  const {split, group} = route.params;
  const currentUser = auth().currentUser;

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
          <View style={styles.Icon}>
            <MaterialCommunityIcons
              name="cash-multiple"
              color="#fff"
              size={24}
            />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.TitleText}>{split.title}</Text>
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
            <Text style={styles.TitleText}>Category</Text>
            <Text style={styles.ValueText}>{split.category}</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.TitleText}>Split Type</Text>
            <Text style={styles.ValueText}>
              {split.splitType === 'percentage' ? 'Percentage' : 'Equal'}
            </Text>
          </View>
        </View>

        <View style={[styles.dataCard, {marginTop: 10}]}>
          <View style={styles.cardContent}>
            <Text style={styles.TitleText}>Paid By</Text>
            <Text style={styles.ValueText}>
              {split.paidBy.name || split.paidBy.email}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Split Breakdown</Text>
      {renderSplitUserDetails()}
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
  percentageText: {
    fontSize: 12,
    color: '#959698',
    marginTop: 2,
  },
});

export default SplitDetailScreen;
