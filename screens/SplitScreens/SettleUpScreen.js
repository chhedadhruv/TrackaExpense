import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import UserAvatar from 'react-native-user-avatar';
import firestore from '@react-native-firebase/firestore';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';

const SettleUpScreen = ({route, navigation}) => {
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

    const settlementAmount = parseFloat(amount);
    if (isNaN(settlementAmount) || settlementAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);

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

      await firestore()
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
          amount: settlementAmount
        }
      };

      await firestore()
        .collection('groups')
        .doc(group.id)
        .collection('splits')
        .add(settlementSplit);

      Alert.alert('Success', 'Settlement recorded successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Error settling up:', error);
      Alert.alert('Error', 'Failed to record settlement');
    } finally {
      setLoading(false);
    }
  };

  const renderUserSelectionCard = (title, selectedUser, users, onSelect, excludeUser) => (
    <Card style={styles.card}>
      <Card.Content>
        <Text style={styles.cardTitle}>{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.userList}>
            {users
              .filter(user => user.email !== excludeUser?.email)
              .map(user => (
                <TouchableOpacity
                  key={user.email}
                  style={[
                    styles.userItem,
                    selectedUser?.email === user.email && styles.selectedUserItem,
                  ]}
                  onPress={() => onSelect(user)}>
                  <UserAvatar
                    size={50}
                    name={user.name}
                    src={user.avatar}
                    style={styles.userAvatar}
                  />
                  <Text
                    style={[
                      styles.userName,
                      selectedUser?.email === user.email && styles.selectedUserName,
                    ]}>
                    {user.name}
                  </Text>
                  {selectedUser?.email === user.email && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={24}
                      color={PRIMARY_COLOR}
                      style={styles.checkIcon}
                    />
                  )}
                </TouchableOpacity>
              ))}
          </View>
        </ScrollView>
      </Card.Content>
    </Card>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.headerText}>Settle Up</Text>
        
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
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Amount</Text>
            <TextInput
              style={styles.amountInput}
              label="Enter amount"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              mode="outlined"
              placeholder="₹0"
            />
          </Card.Content>
        </Card>

        {/* Note section */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Add a note</Text>
            <TextInput
              style={styles.noteInput}
              label="Note (optional)"
              value={note}
              onChangeText={setNote}
              mode="outlined"
              placeholder="Add a note for this settlement"
              multiline
            />
          </Card.Content>
        </Card>

        {/* Summary section */}
        {selectedLender && selectedBorrower && amount && (
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Text style={styles.summaryTitle}>Summary</Text>
              <Text style={styles.summaryText}>
                {selectedBorrower.name} pays ₹{parseFloat(amount).toLocaleString()} to{' '}
                {selectedLender.name}
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Settle Up button */}
        <Button
          mode="contained"
          onPress={handleSettleUp}
          style={styles.settleButton}
          loading={loading}
          disabled={loading || !selectedLender || !selectedBorrower || !amount}>
          Settle Up
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  content: {
    padding: 16,
  },
  headerText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 12,
  },
  userList: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  userItem: {
    alignItems: 'center',
    marginRight: 16,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    width: 80,
  },
  selectedUserItem: {
    backgroundColor: PRIMARY_COLOR + '10',
    borderColor: PRIMARY_COLOR,
  },
  userAvatar: {
    marginBottom: 8,
  },
  userName: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
  },
  selectedUserName: {
    color: PRIMARY_COLOR,
    fontWeight: '500',
  },
  checkIcon: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  amountInput: {
    backgroundColor: '#fff',
  },
  noteInput: {
    backgroundColor: '#fff',
    height: 80,
  },
  summaryCard: {
    marginBottom: 16,
    backgroundColor: PRIMARY_COLOR,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#fff',
  },
  settleButton: {
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 8,
  },
});

export default SettleUpScreen;