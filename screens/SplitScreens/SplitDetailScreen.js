import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {Card, Chip} from 'react-native-paper';
import UserAvatar from 'react-native-user-avatar';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';

const SplitDetailScreen = ({route, navigation}) => {
  const {split, group} = route.params;
  const currentUser = auth().currentUser;

  const renderSplitUserDetails = () => {
    return split.splitUsers.map(user => {
      const isCurrentUser = user.email === currentUser?.email;
      const splitAmount =
        split.splitType === 'percentage'
          ? `${user.percentage}% (₹${(
              split.amount *
              (user.percentage / 100)
            ).toFixed(2)})`
          : `₹${(split.amount / split.splitUsers.length).toFixed(2)}`;

      return (
        <Card key={user.email} style={styles.userCard}>
          <View style={styles.userCardContent}>
            <View style={styles.userInfo}>
              <UserAvatar size={40} name={user.name} />
              <View style={styles.userNameContainer}>
                <Text style={styles.userName}>
                  {user.name}
                  {isCurrentUser && ' (You)'}
                </Text>
                {split.splitType === 'percentage' && (
                  <Text style={styles.userSplitPercentage}>
                    {user.percentage}% Split
                  </Text>
                )}
              </View>
            </View>
            <Text style={styles.userSplitAmount}>{splitAmount}</Text>
          </View>
        </Card>
      );
    });
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.splitSummaryCard}>
        <View style={styles.splitSummaryContent}>
          <Text style={styles.splitTitle}>{split.title}</Text>

          <View style={styles.splitInfoRow}>
            <MaterialCommunityIcons
              name="cash"
              size={24}
              color={PRIMARY_COLOR}
              style={styles.icon}
            />
            <Text style={styles.splitAmount}>
              ₹ {parseFloat(split.amount).toLocaleString()}
            </Text>
          </View>

          <View style={styles.splitInfoRow}>
            <MaterialCommunityIcons
              name="account"
              size={24}
              color={PRIMARY_COLOR}
              style={styles.icon}
            />
            <Text style={styles.splitPaidBy}>
              Paid by {split.paidBy.name || split.paidBy.email}
            </Text>
          </View>

          <View style={styles.splitInfoRow}>
            <MaterialCommunityIcons
              name="tag"
              size={24}
              color={PRIMARY_COLOR}
              style={styles.icon}
            />
            <Text style={styles.splitCategory}>{split.category}</Text>
          </View>

          <Chip
            style={styles.splitTypeChip}
            textStyle={styles.splitTypeChipText}>
            {split.splitType === 'percentage'
              ? 'Percentage Split'
              : 'Equal Split'}
          </Chip>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Split Breakdown</Text>
      {renderSplitUserDetails()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    padding: 15,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3A3B3E',
  },
  splitSummaryCard: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
    borderRadius: 12, // Rounded corners
    elevation: 5, // Shadow for better elevation
    shadowColor: '#000', // Shadow color
    shadowOpacity: 0.1, // Slight shadow opacity
    shadowOffset: {width: 0, height: 4}, // Slight offset for shadow
    shadowRadius: 6, // Radius for softer shadow
  },
  splitSummaryContent: {
    alignItems: 'flex-start', // Align elements to the start for a cleaner look
  },
  splitTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginBottom: 15,
    textAlign: 'center', // Center the title
  },
  splitInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15, // Increased margin for better spacing
  },
  splitAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A3B3E',
  },
  splitPaidBy: {
    fontSize: 16,
    color: '#3A3B3E',
  },
  splitCategory: {
    fontSize: 16,
    color: '#3A3B3E',
  },
  splitTypeChip: {
    marginTop: 15,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 30, // Round the corners of the chip
    paddingVertical: 5,
    paddingHorizontal: 15,
  },
  splitTypeChipText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  icon: {
    marginRight: 10, // Add space between icon and text
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#3A3B3E',
    marginBottom: 10,
  },
  userCard: {
    marginBottom: 10,
    backgroundColor: '#fff',
    padding: 15,
  },
  userCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userNameContainer: {
    marginLeft: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A3B3E',
  },
  userSplitPercentage: {
    fontSize: 12,
    color: '#959698',
  },
  userSplitAmount: {
    fontSize: 16,
    fontWeight: '500',
    color: PRIMARY_COLOR,
  },
});

export default SplitDetailScreen;
