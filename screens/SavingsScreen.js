import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import {Card, ActivityIndicator, Button} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import FormButton from '../components/FormButton';
const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const SUCCESS_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';
const SavingsScreen = ({navigation}) => {
  const [loading, setLoading] = useState(true);
  const [savings, setSavings] = useState({
    current: 0,
    target: 0,
    monthly: 0,
  });
  const [savingsHistory, setSavingsHistory] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    current: '',
    target: '',
    monthly: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    fetchSavingsData();
  }, []);
  const fetchSavingsData = async () => {
    try {
      const currentUser = auth().currentUser;
      const userDoc = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();
      const userData = userDoc.data();
      if (userData.savings) {
        setSavings(userData.savings);
        setEditValues({
          current: userData.savings.current.toString(),
          target: userData.savings.target.toString(),
          monthly: userData.savings.monthly.toString(),
        });
      }
      // Fetch savings history
      const historySnapshot = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('savingsHistory')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
      const history = historySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSavingsHistory(history);
      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };
  const handleEdit = () => {
    setIsEditing(true);
  };
  const handleCancel = () => {
    setIsEditing(false);
    setEditValues({
      current: savings.current.toString(),
      target: savings.target.toString(),
      monthly: savings.monthly.toString(),
    });
  };
  const handleSave = async () => {
    if (!editValues.current || !editValues.target || !editValues.monthly) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    const current = parseFloat(editValues.current);
    const target = parseFloat(editValues.target);
    const monthly = parseFloat(editValues.monthly);
    if (isNaN(current) || isNaN(target) || isNaN(monthly)) {
      Alert.alert('Error', 'Please enter valid numbers');
      return;
    }
    if (current < 0 || target < 0 || monthly < 0) {
      Alert.alert('Error', 'Values cannot be negative');
      return;
    }
    setIsSubmitting(true);
    try {
      const currentUser = auth().currentUser;
      const userDocRef = firestore().collection('users').doc(currentUser.uid);
      const newSavings = {
        current,
        target,
        monthly,
        updatedAt: firestore.Timestamp.fromDate(new Date()),
      };
      await userDocRef.update({
        savings: newSavings,
      });
      // Add to history if values changed
      if (current !== savings.current || target !== savings.target || monthly !== savings.monthly) {
        await userDocRef.collection('savingsHistory').add({
          previousSavings: savings,
          newSavings,
          createdAt: firestore.Timestamp.fromDate(new Date()),
        });
      }
      setSavings(newSavings);
      setIsEditing(false);
      Alert.alert('Success', 'Savings updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update savings. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  const addToSavings = async (amount) => {
    if (!amount || isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    setIsSubmitting(true);
    try {
      const currentUser = auth().currentUser;
      const userDocRef = firestore().collection('users').doc(currentUser.uid);
      const newCurrent = savings.current + parseFloat(amount);
      const newSavings = {
        ...savings,
        current: newCurrent,
        updatedAt: firestore.Timestamp.fromDate(new Date()),
      };
      await userDocRef.update({
        savings: newSavings,
      });
      // Add to history
      await userDocRef.collection('savingsHistory').add({
        type: 'deposit',
        amount: parseFloat(amount),
        previousAmount: savings.current,
        newAmount: newCurrent,
        createdAt: firestore.Timestamp.fromDate(new Date()),
      });
      setSavings(newSavings);
      Alert.alert('Success', `₹${amount} added to savings`);
    } catch (error) {
      Alert.alert('Error', 'Failed to add to savings. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  const withdrawFromSavings = async (amount) => {
    if (!amount || isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (parseFloat(amount) > savings.current) {
      Alert.alert('Error', 'Insufficient savings balance');
      return;
    }
    setIsSubmitting(true);
    try {
      const currentUser = auth().currentUser;
      const userDocRef = firestore().collection('users').doc(currentUser.uid);
      const newCurrent = savings.current - parseFloat(amount);
      const newSavings = {
        ...savings,
        current: newCurrent,
        updatedAt: firestore.Timestamp.fromDate(new Date()),
      };
      await userDocRef.update({
        savings: newSavings,
      });
      // Add to history
      await userDocRef.collection('savingsHistory').add({
        type: 'withdrawal',
        amount: parseFloat(amount),
        previousAmount: savings.current,
        newAmount: newCurrent,
        createdAt: firestore.Timestamp.fromDate(new Date()),
      });
      setSavings(newSavings);
      Alert.alert('Success', `₹${amount} withdrawn from savings`);
    } catch (error) {
      Alert.alert('Error', 'Failed to withdraw from savings. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  const calculateProgress = () => {
    if (savings.target === 0) return 0;
    return Math.min((savings.current / savings.target) * 100, 100);
  };
  const calculateMonthsToTarget = () => {
    if (savings.monthly === 0) return null;
    const remaining = savings.target - savings.current;
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / savings.monthly);
  };
  const formatCurrency = (amount) => {
    return parseInt(amount, 10).toLocaleString();
  };
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading savings...</Text>
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
              <MaterialCommunityIcons name="piggy-bank" size={32} color={SUCCESS_COLOR} />
              <Text style={styles.headerTitle}>Savings</Text>
            </View>
            <Text style={styles.headerSubtitle}>Track and manage your savings goals</Text>
          </View>
          {/* Current Savings Card */}
          <Card style={styles.savingsCard}>
            <View style={styles.cardContent}>
              <View style={styles.savingsHeader}>
                <MaterialCommunityIcons name="wallet" size={24} color={PRIMARY_COLOR} />
                <Text style={styles.savingsTitle}>Current Savings</Text>
                {!isEditing && (
                  <TouchableOpacity onPress={handleEdit} style={styles.editButton}>
                    <MaterialCommunityIcons name="pencil" size={20} color={PRIMARY_COLOR} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.savingsAmount}>₹{formatCurrency(savings.current)}</Text>
              {isEditing ? (
                <View style={styles.editForm}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Current Amount (₹)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editValues.current}
                      onChangeText={(text) => setEditValues({...editValues, current: text})}
                      keyboardType="numeric"
                      placeholder="Enter current savings"
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Target Amount (₹)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editValues.target}
                      onChangeText={(text) => setEditValues({...editValues, target: text})}
                      keyboardType="numeric"
                      placeholder="Enter target amount"
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Monthly Goal (₹)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editValues.monthly}
                      onChangeText={(text) => setEditValues({...editValues, monthly: text})}
                      keyboardType="numeric"
                      placeholder="Enter monthly goal"
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={handleCancel}
                      disabled={isSubmitting}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.saveButton]}
                      onPress={handleSave}
                      disabled={isSubmitting}>
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.saveButtonText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.savingsInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Target:</Text>
                    <Text style={styles.infoValue}>₹{formatCurrency(savings.target)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Monthly Goal:</Text>
                    <Text style={styles.infoValue}>₹{formatCurrency(savings.monthly)}</Text>
                  </View>
                </View>
              )}
            </View>
          </Card>
          {/* Progress Card */}
          <Card style={styles.progressCard}>
            <View style={styles.cardContent}>
              <Text style={styles.progressTitle}>Progress to Goal</Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    {width: `${calculateProgress()}%`}
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {calculateProgress().toFixed(1)}% Complete
              </Text>
              {calculateMonthsToTarget() !== null && (
                <Text style={styles.monthsText}>
                  {calculateMonthsToTarget() === 0 
                    ? 'Goal achieved! 🎉' 
                    : `${calculateMonthsToTarget()} months to target`
                  }
                </Text>
              )}
            </View>
          </Card>
          {/* Quick Actions Card */}
          <Card style={styles.actionsCard}>
            <View style={styles.cardContent}>
              <Text style={styles.actionsTitle}>Quick Actions</Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.addButton]}
                  onPress={() => {
                    Alert.prompt(
                      'Add to Savings',
                      'Enter amount to add:',
                      [
                        {text: 'Cancel', style: 'cancel'},
                        {
                          text: 'Add',
                          onPress: (amount) => addToSavings(amount)
                        }
                      ],
                      'plain-text'
                    );
                  }}
                  disabled={isSubmitting}>
                  <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
                  <Text style={styles.quickActionText}>Add Money</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickActionButton, styles.withdrawButton]}
                  onPress={() => {
                    Alert.prompt(
                      'Withdraw from Savings',
                      'Enter amount to withdraw:',
                      [
                        {text: 'Cancel', style: 'cancel'},
                        {
                          text: 'Withdraw',
                          onPress: (amount) => withdrawFromSavings(amount)
                        }
                      ],
                      'plain-text'
                    );
                  }}
                  disabled={isSubmitting}>
                  <MaterialCommunityIcons name="minus" size={24} color="#FFFFFF" />
                  <Text style={styles.quickActionText}>Withdraw</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
          {/* Recent Activity Card */}
          <Card style={styles.historyCard}>
            <View style={styles.cardContent}>
              <Text style={styles.historyTitle}>Recent Activity</Text>
              {savingsHistory.length > 0 ? (
                savingsHistory.map((item, index) => (
                  <View key={item.id} style={styles.historyItem}>
                    <View style={styles.historyIcon}>
                      {item.type === 'deposit' ? (
                        <MaterialCommunityIcons name="plus-circle" size={20} color={SUCCESS_COLOR} />
                      ) : item.type === 'withdrawal' ? (
                        <MaterialCommunityIcons name="minus-circle" size={20} color={EXPENSE_COLOR} />
                      ) : (
                        <MaterialCommunityIcons name="pencil" size={20} color={PRIMARY_COLOR} />
                      )}
                    </View>
                    <View style={styles.historyDetails}>
                      <Text style={styles.historyDescription}>
                        {item.type === 'deposit' ? 'Added to savings' :
                         item.type === 'withdrawal' ? 'Withdrawn from savings' :
                         'Savings updated'}
                      </Text>
                      <Text style={styles.historyDate}>
                        {item.createdAt.toDate().toLocaleDateString()}
                      </Text>
                    </View>
                    {item.amount && (
                      <Text style={[
                        styles.historyAmount,
                        item.type === 'deposit' ? styles.positiveAmount : styles.negativeAmount
                      ]}>
                        {item.type === 'deposit' ? '+' : '-'}₹{formatCurrency(item.amount)}
                      </Text>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyHistory}>
                  <MaterialCommunityIcons name="history" size={48} color="#CBD3EE" />
                  <Text style={styles.emptyHistoryText}>No activity yet</Text>
                  <Text style={styles.emptyHistorySubtext}>Your savings activity will appear here</Text>
                </View>
              )}
            </View>
          </Card>
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
  savingsCard: {
    backgroundColor: '#FFFFFF',
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
  progressCard: {
    backgroundColor: '#FFFFFF',
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
  actionsCard: {
    backgroundColor: '#FFFFFF',
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
  historyCard: {
    backgroundColor: '#FFFFFF',
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
    marginBottom: 40,
  },
  cardContent: {
    padding: 25,
  },
  savingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  savingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    marginLeft: 10,
    flex: 1,
    fontFamily: 'Lato-Bold',
  },
  editButton: {
    padding: 5,
  },
  savingsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: SUCCESS_COLOR,
    marginBottom: 20,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  savingsInfo: {
    marginTop: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Lato-Regular',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  editForm: {
    marginTop: 15,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 8,
    fontFamily: 'Lato-Bold',
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
  editActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    flex: 0.48,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 15,
    fontFamily: 'Lato-Bold',
  },
  progressBar: {
    height: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    textAlign: 'center',
    marginBottom: 5,
    fontFamily: 'Lato-Bold',
  },
  monthsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 20,
    fontFamily: 'Lato-Bold',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
  },
  addButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  withdrawButton: {
    backgroundColor: EXPENSE_COLOR,
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 20,
    fontFamily: 'Lato-Bold',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyIcon: {
    width: 40,
    alignItems: 'center',
  },
  historyDetails: {
    flex: 1,
    marginLeft: 10,
  },
  historyDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  historyDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontFamily: 'Lato-Regular',
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  positiveAmount: {
    color: SUCCESS_COLOR,
  },
  negativeAmount: {
    color: EXPENSE_COLOR,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyHistoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
    fontFamily: 'Lato-Bold',
  },
  emptyHistorySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
});
export default SavingsScreen; 