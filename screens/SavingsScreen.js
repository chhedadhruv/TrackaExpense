import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import {Card, ActivityIndicator, Button} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import FormButton from '../components/FormButton';
import {useCurrency} from '../utils/CurrencyUtil';
const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const SUCCESS_COLOR = '#25B07F';
const EXPENSE_COLOR = '#F64E4E';
const SavingsScreen = ({navigation}) => {
  const {currency, formatAmount: formatCurrencyAmount} = useCurrency();
  const [loading, setLoading] = useState(true);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [savingsHistory, setSavingsHistory] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editValues, setEditValues] = useState({
    name: '',
    description: '',
    current: '',
    target: '',
    monthly: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputAmount, setInputAmount] = useState('');
  const [inputType, setInputType] = useState(''); // 'add' or 'withdraw'
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState(null);
  useEffect(() => {
    fetchSavingsData();
  }, []);
  const fetchSavingsData = async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated. Please log in again.');
        setLoading(false);
        return;
      }

      const userDoc = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .get();
      
      if (!userDoc.exists) {
        Alert.alert('Error', 'User document not found. Please try again.');
        setLoading(false);
        return;
      }

      const userData = userDoc.data();
      if (userData && userData.savingsGoals && userData.savingsGoals.length > 0) {
        setSavingsGoals(userData.savingsGoals);
      } else {
        // Initialize with a default savings goal if none exist
        const defaultGoal = {
          id: Date.now().toString(),
          name: 'Emergency Fund',
          description: 'Your emergency savings for unexpected expenses',
          current: 0,
          target: 10000,
          monthly: 500,
          createdAt: firestore.Timestamp.fromDate(new Date()),
          updatedAt: firestore.Timestamp.fromDate(new Date()),
        };
        await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .update({ savingsGoals: [defaultGoal] });
        setSavingsGoals([defaultGoal]);
      }

      // Fetch savings history
      const historySnapshot = await firestore()
        .collection('users')
        .doc(currentUser.uid)
        .collection('savingsHistory')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();
      
      const history = historySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Ensure goalName exists for display
          goalName: data.goalName || data.goal?.name || 'savings goal',
        };
      });
      setSavingsHistory(history);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching savings data:', error);
      Alert.alert('Error', 'Failed to load savings data. Please try again.');
      setLoading(false);
    }
  };
  const handleEdit = (goalId) => {
    const goal = savingsGoals.find(g => g.id === goalId);
    if (goal) {
      setEditingGoalId(goalId);
      setEditValues({
        name: goal.name,
        description: goal.description || '',
        current: goal.current.toString(),
        target: goal.target.toString(),
        monthly: goal.monthly.toString(),
      });
      setIsEditing(true);
    }
  };
  
  const handleCancel = () => {
    setIsEditing(false);
    setEditingGoalId(null);
    setEditValues({
      name: '',
      description: '',
      current: '',
      target: '',
      monthly: '',
    });
  };
  const handleSave = async () => {
    if (!editValues.name || !editValues.current || !editValues.target || !editValues.monthly) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (editValues.name.trim().length > 50) {
      Alert.alert('Error', 'Goal name must be 50 characters or less');
      return;
    }
    if (editValues.description.trim().length > 200) {
      Alert.alert('Error', 'Description must be 200 characters or less');
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
    if (current > 999999999 || target > 999999999 || monthly > 999999999) {
      Alert.alert('Error', 'Values are too large. Please enter smaller amounts.');
      return;
    }
    setIsSubmitting(true);
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      const userDocRef = firestore().collection('users').doc(currentUser.uid);
      const updatedGoals = savingsGoals.map(goal => {
        if (goal.id === editingGoalId) {
          const oldGoal = { ...goal };
          const newGoal = {
            ...goal,
            name: editValues.name,
            description: editValues.description,
            current,
            target,
            monthly,
            updatedAt: firestore.Timestamp.fromDate(new Date()),
          };
          
          // Add to history if values changed
          if (current !== oldGoal.current || target !== oldGoal.target || monthly !== oldGoal.monthly || 
              editValues.name !== oldGoal.name || editValues.description !== oldGoal.description) {
            userDocRef.collection('savingsHistory').add({
              goalId: editingGoalId,
              goalName: editValues.name || oldGoal.name,
              type: 'update',
              previousGoal: oldGoal,
              newGoal,
              createdAt: firestore.Timestamp.fromDate(new Date()),
            });
          }
          
          return newGoal;
        }
        return goal;
      });

      await userDocRef.update({
        savingsGoals: updatedGoals,
      });
      
      setSavingsGoals(updatedGoals);
      setIsEditing(false);
      setEditingGoalId(null);
      Alert.alert('Success', 'Savings goal updated successfully');
    } catch (error) {
      console.error('Error updating savings goal:', error);
      Alert.alert('Error', `Failed to update savings goal: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  const addToSavings = async (amount) => {
    if (!amount || isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (parseFloat(amount) > 999999999) {
      Alert.alert('Error', 'Amount is too large. Please enter a smaller amount.');
      return;
    }
    if (!selectedGoalId) {
      Alert.alert('Error', 'Please select a savings goal first');
      return;
    }
    setIsSubmitting(true);
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      const userDocRef = firestore().collection('users').doc(currentUser.uid);
      const updatedGoals = savingsGoals.map(goal => {
        if (goal.id === selectedGoalId) {
          const newCurrent = goal.current + parseFloat(amount);
          const updatedGoal = {
            ...goal,
            current: newCurrent,
            updatedAt: firestore.Timestamp.fromDate(new Date()),
          };
          
          // Add to history
          userDocRef.collection('savingsHistory').add({
            goalId: selectedGoalId,
            goalName: goal.name,
            type: 'deposit',
            amount: parseFloat(amount),
            previousAmount: goal.current,
            newAmount: newCurrent,
            createdAt: firestore.Timestamp.fromDate(new Date()),
          });
          
          return updatedGoal;
        }
        return goal;
      });

      await userDocRef.update({
        savingsGoals: updatedGoals,
      });
      
      setSavingsGoals(updatedGoals);
      Alert.alert('Success', `${formatCurrencyAmount(amount)} added to ${savingsGoals.find(g => g.id === selectedGoalId)?.name}`);
    } catch (error) {
      console.error('Error adding to savings:', error);
      Alert.alert('Error', `Failed to add to savings: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  const withdrawFromSavings = async (amount) => {
    if (!amount || isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (parseFloat(amount) > 999999999) {
      Alert.alert('Error', 'Amount is too large. Please enter a smaller amount.');
      return;
    }
    if (!selectedGoalId) {
      Alert.alert('Error', 'Please select a savings goal first');
      return;
    }
    
    const selectedGoal = savingsGoals.find(g => g.id === selectedGoalId);
    if (parseFloat(amount) > selectedGoal.current) {
      Alert.alert('Error', 'Insufficient savings balance');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      const userDocRef = firestore().collection('users').doc(currentUser.uid);
      const updatedGoals = savingsGoals.map(goal => {
        if (goal.id === selectedGoalId) {
          const newCurrent = goal.current - parseFloat(amount);
          const updatedGoal = {
            ...goal,
            current: newCurrent,
            updatedAt: firestore.Timestamp.fromDate(new Date()),
          };
          
          // Add to history
          userDocRef.collection('savingsHistory').add({
            goalId: selectedGoalId,
            goalName: goal.name,
            type: 'withdrawal',
            amount: parseFloat(amount),
            previousAmount: goal.current,
            newAmount: newCurrent,
            createdAt: firestore.Timestamp.fromDate(new Date()),
          });
          
          return updatedGoal;
        }
        return goal;
      });

      await userDocRef.update({
        savingsGoals: updatedGoals,
      });
      
      setSavingsGoals(updatedGoals);
      Alert.alert('Success', `${formatCurrencyAmount(amount)} withdrawn from ${selectedGoal.name}`);
    } catch (error) {
      console.error('Error withdrawing from savings:', error);
      Alert.alert('Error', `Failed to withdraw from savings: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  const calculateProgress = (goal) => {
    if (goal.target === 0) return 0;
    return Math.min((goal.current / goal.target) * 100, 100);
  };
  
  const calculateMonthsToTarget = (goal) => {
    if (goal.monthly === 0) return null;
    const remaining = goal.target - goal.current;
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / goal.monthly);
  };
  const formatCurrency = (amount) => {
    return parseInt(amount, 10).toLocaleString();
  };

  const showAmountInput = (type) => {
    setInputType(type);
    setInputAmount('');
    setShowInputModal(true);
  };

  const handleAmountSubmit = () => {
    if (!inputAmount || isNaN(inputAmount) || parseFloat(inputAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    setShowInputModal(false);
    if (inputType === 'add') {
      addToSavings(inputAmount);
    } else if (inputType === 'withdraw') {
      withdrawFromSavings(inputAmount);
    }
  };

  const handleAmountCancel = () => {
    setShowInputModal(false);
    setInputAmount('');
    setInputType('');
  };

  const createNewGoal = async () => {
    if (!editValues.name || !editValues.current || !editValues.target || !editValues.monthly) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (editValues.name.trim().length > 50) {
      Alert.alert('Error', 'Goal name must be 50 characters or less');
      return;
    }
    if (editValues.description.trim().length > 200) {
      Alert.alert('Error', 'Description must be 200 characters or less');
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
    if (current > 999999999 || target > 999999999 || monthly > 999999999) {
      Alert.alert('Error', 'Values are too large. Please enter smaller amounts.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      const userDocRef = firestore().collection('users').doc(currentUser.uid);
      const newGoal = {
        id: Date.now().toString(),
        name: editValues.name,
        description: editValues.description,
        current,
        target,
        monthly,
        createdAt: firestore.Timestamp.fromDate(new Date()),
        updatedAt: firestore.Timestamp.fromDate(new Date()),
      };
      
      const updatedGoals = [...savingsGoals, newGoal];
      await userDocRef.update({
        savingsGoals: updatedGoals,
      });
      
      // Add to history
      await userDocRef.collection('savingsHistory').add({
        goalId: newGoal.id,
        goalName: newGoal.name,
        type: 'create',
        newGoal,
        createdAt: firestore.Timestamp.fromDate(new Date()),
      });
      
      setSavingsGoals(updatedGoals);
      setShowCreateModal(false);
      setEditValues({
        name: '',
        description: '',
        current: '',
        target: '',
        monthly: '',
      });
      Alert.alert('Success', 'Savings goal created successfully');
    } catch (error) {
      console.error('Error creating savings goal:', error);
      Alert.alert('Error', `Failed to create savings goal: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteGoal = async (goalId) => {
    setIsSubmitting(true);
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'User not authenticated. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      const userDocRef = firestore().collection('users').doc(currentUser.uid);
      const goalToDelete = savingsGoals.find(g => g.id === goalId);
      const updatedGoals = savingsGoals.filter(g => g.id !== goalId);
      
      await userDocRef.update({
        savingsGoals: updatedGoals,
      });
      
      // Add to history
      await userDocRef.collection('savingsHistory').add({
        goalId: goalId,
        goalName: goalToDelete.name,
        type: 'delete',
        deletedGoal: goalToDelete,
        createdAt: firestore.Timestamp.fromDate(new Date()),
      });
      
      setSavingsGoals(updatedGoals);
      setShowDeleteModal(false);
      setGoalToDelete(null);
      Alert.alert('Success', 'Savings goal deleted successfully');
    } catch (error) {
      console.error('Error deleting savings goal:', error);
      Alert.alert('Error', `Failed to delete savings goal: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (goalId) => {
    const goal = savingsGoals.find(g => g.id === goalId);
    setGoalToDelete(goal);
    setShowDeleteModal(true);
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
              <Text style={styles.headerTitle}>Savings Goals</Text>
            </View>
            <Text style={styles.headerSubtitle}>Track and manage multiple savings goals</Text>
            <TouchableOpacity
              style={styles.addGoalButton}
              onPress={() => setShowCreateModal(true)}>
              <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.addGoalButtonText}>Add New Goal</Text>
            </TouchableOpacity>
          </View>

          {/* Savings Goals List */}
          {savingsGoals.length > 0 ? (
            savingsGoals.map((goal, index) => (
              <Card key={goal.id} style={styles.savingsCard} elevation={2}>
                <View style={styles.cardContent}>
                  <View style={styles.savingsHeader}>
                    <View style={styles.goalInfo}>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      {goal.description && (
                        <Text style={styles.goalDescription}>{goal.description}</Text>
                      )}
                    </View>
                    <View style={styles.goalActions}>
                      <TouchableOpacity 
                        onPress={() => handleEdit(goal.id)} 
                        style={styles.actionIcon}>
                        <MaterialCommunityIcons name="pencil" size={20} color={PRIMARY_COLOR} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => confirmDelete(goal.id)} 
                        style={styles.actionIcon}>
                        <MaterialCommunityIcons name="delete" size={20} color={EXPENSE_COLOR} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {isEditing && editingGoalId === goal.id ? (
                    <View style={styles.editForm}>
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Goal Name</Text>
                        <TextInput
                          style={styles.textInput}
                          value={editValues.name}
                          onChangeText={(text) => setEditValues({...editValues, name: text})}
                          placeholder="Enter goal name"
                          placeholderTextColor="#999"
                          maxLength={50}
                        />
                        <Text style={styles.characterCount}>{editValues.name.length}/50</Text>
                      </View>
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Description (Optional)</Text>
                        <TextInput
                          style={styles.textInput}
                          value={editValues.description}
                          onChangeText={(text) => setEditValues({...editValues, description: text})}
                          placeholder="Enter description"
                          placeholderTextColor="#999"
                          maxLength={200}
                          multiline
                          numberOfLines={2}
                        />
                        <Text style={styles.characterCount}>{editValues.description.length}/200</Text>
                      </View>
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Current Amount ({currency.symbol})</Text>
                        <TextInput
                          style={styles.textInput}
                          value={editValues.current}
                          onChangeText={(text) => setEditValues({...editValues, current: text})}
                          keyboardType="numeric"
                          placeholder="Enter current amount"
                          placeholderTextColor="#999"
                        />
                      </View>
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputLabel}>Target Amount ({currency.symbol})</Text>
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
                        <Text style={styles.inputLabel}>Monthly Goal ({currency.symbol})</Text>
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
                    <>
                      <Text style={styles.savingsAmount}>{formatCurrency(goal.current)}</Text>
                      <View style={styles.savingsInfo}>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Target:</Text>
                          <Text style={styles.infoValue}>{formatCurrency(goal.target)}</Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Monthly Goal:</Text>
                          <Text style={styles.infoValue}>{formatCurrency(goal.monthly)}</Text>
                        </View>
                      </View>

                      {/* Progress Section */}
                      <View style={styles.progressSection}>
                        <Text style={styles.progressTitle}>Progress to Goal</Text>
                        <View style={styles.progressBar}>
                          <View 
                            style={[
                              styles.progressFill, 
                              {width: `${calculateProgress(goal)}%`}
                            ]} 
                          />
                        </View>
                        <Text style={styles.progressText}>
                          {calculateProgress(goal).toFixed(1)}% Complete
                        </Text>
                        {calculateMonthsToTarget(goal) !== null && (
                          <Text style={styles.monthsText}>
                            {calculateMonthsToTarget(goal) === 0 
                              ? 'Goal achieved! 🎉' 
                              : `${calculateMonthsToTarget(goal)} months to target`
                            }
                          </Text>
                        )}
                      </View>

                      {/* Quick Actions for this goal */}
                      <View style={styles.goalActions}>
                        <TouchableOpacity
                          style={[styles.goalActionButton, styles.addButton]}
                          onPress={() => {
                            setSelectedGoalId(goal.id);
                            showAmountInput('add');
                          }}
                          disabled={isSubmitting}>
                          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
                          <Text style={styles.goalActionText}>Add Money</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.goalActionButton, styles.withdrawButton]}
                          onPress={() => {
                            setSelectedGoalId(goal.id);
                            showAmountInput('withdraw');
                          }}
                          disabled={isSubmitting}>
                          <MaterialCommunityIcons name="minus" size={20} color="#FFFFFF" />
                          <Text style={styles.goalActionText}>Withdraw</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyStateCard} elevation={2}>
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="piggy-bank-outline" size={64} color="#CBD3EE" />
                <Text style={styles.emptyStateTitle}>No Savings Goals Yet</Text>
                <Text style={styles.emptyStateSubtitle}>Create your first savings goal to start tracking your progress</Text>
                <TouchableOpacity
                  style={styles.createFirstGoalButton}
                  onPress={() => setShowCreateModal(true)}>
                  <Text style={styles.createFirstGoalButtonText}>Create Your First Goal</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}

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
                      ) : item.type === 'create' ? (
                        <MaterialCommunityIcons name="plus" size={20} color={PRIMARY_COLOR} />
                      ) : item.type === 'delete' ? (
                        <MaterialCommunityIcons name="delete" size={20} color={EXPENSE_COLOR} />
                      ) : (
                        <MaterialCommunityIcons name="pencil" size={20} color={PRIMARY_COLOR} />
                      )}
                    </View>
                    <View style={styles.historyDetails}>
                      <Text style={styles.historyDescription}>
                        {(() => {
                          const goalName = item.goalName || 'savings goal';
                          switch (item.type) {
                            case 'deposit':
                              return `Added to ${goalName}`;
                            case 'withdrawal':
                              return `Withdrawn from ${goalName}`;
                            case 'create':
                              return `Created goal: ${goalName}`;
                            case 'delete':
                              return `Deleted goal: ${goalName}`;
                            case 'update':
                              return `Updated ${goalName}`;
                            default:
                              return `Savings activity`;
                          }
                        })()}
                      </Text>
                      <Text style={styles.historyDate}>
                        {item.createdAt ? item.createdAt.toDate().toLocaleDateString() : 'Unknown date'}
                      </Text>
                    </View>
                    {item.amount && (
                      <Text style={[
                        styles.historyAmount,
                        item.type === 'deposit' ? styles.positiveAmount : styles.negativeAmount
                      ]}>
                        {item.type === 'deposit' ? '+' : '-'}{formatCurrency(item.amount)}
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
        
        {/* Input Modal */}
        <Modal
          visible={showInputModal}
          transparent={true}
          animationType="slide"
          onRequestClose={handleAmountCancel}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {inputType === 'add' ? 'Add to Savings' : 'Withdraw from Savings'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {inputType === 'add' 
                  ? 'Enter the amount you want to add to your savings' 
                  : 'Enter the amount you want to withdraw from your savings'
                }
              </Text>
              <TextInput
                style={styles.modalInput}
                value={inputAmount}
                onChangeText={setInputAmount}
                placeholder="Enter amount"
                placeholderTextColor="#999"
                keyboardType="numeric"
                autoFocus={true}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={handleAmountCancel}>
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSubmitButton]}
                  onPress={handleAmountSubmit}
                  disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>
                      {inputType === 'add' ? 'Add' : 'Withdraw'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Create Goal Modal */}
        <Modal
          visible={showCreateModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowCreateModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create New Savings Goal</Text>
              <Text style={styles.modalSubtitle}>
                Set up a new savings goal to track your progress
              </Text>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Goal Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editValues.name}
                  onChangeText={(text) => setEditValues({...editValues, name: text})}
                  placeholder="e.g., Emergency Fund, Vacation"
                  placeholderTextColor="#999"
                  maxLength={50}
                />
                <Text style={styles.characterCount}>{editValues.name.length}/50</Text>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={editValues.description}
                  onChangeText={(text) => setEditValues({...editValues, description: text})}
                  placeholder="Describe your savings goal"
                  placeholderTextColor="#999"
                  maxLength={200}
                  multiline
                  numberOfLines={2}
                />
                <Text style={styles.characterCount}>{editValues.description.length}/200</Text>
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Current Amount ({currency.symbol}) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editValues.current}
                  onChangeText={(text) => setEditValues({...editValues, current: text})}
                  keyboardType="numeric"
                  placeholder="Enter current amount"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Target Amount ({currency.symbol}) *</Text>
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
                <Text style={styles.inputLabel}>Monthly Goal ({currency.symbol}) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={editValues.monthly}
                  onChangeText={(text) => setEditValues({...editValues, monthly: text})}
                  keyboardType="numeric"
                  placeholder="Enter monthly goal"
                  placeholderTextColor="#999"
                />
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    setShowCreateModal(false);
                    setEditValues({
                      name: '',
                      description: '',
                      current: '',
                      target: '',
                      monthly: '',
                    });
                  }}>
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSubmitButton]}
                  onPress={createNewGoal}
                  disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>Create Goal</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          visible={showDeleteModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDeleteModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <MaterialCommunityIcons name="alert-circle" size={48} color={EXPENSE_COLOR} />
              <Text style={styles.modalTitle}>Delete Savings Goal</Text>
              <Text style={styles.modalSubtitle}>
                Are you sure you want to delete "{goalToDelete?.name}"? This action cannot be undone.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setShowDeleteModal(false)}>
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.deleteButton]}
                  onPress={() => deleteGoal(goalToDelete?.id)}
                  disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: 'Lato-Bold',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Lato-Regular',
  },
  modalInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 0.48,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  modalSubmitButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  modalCancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  modalSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  addGoalButton: {
    backgroundColor: PRIMARY_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 15,
  },
  addGoalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    fontFamily: 'Lato-Bold',
  },
  goalInfo: {
    flex: 1,
  },
  goalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  goalDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
    fontFamily: 'Lato-Regular',
  },
  goalActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    padding: 8,
    marginLeft: 5,
  },
  progressSection: {
    marginTop: 15,
    marginBottom: 15,
  },
  goalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  goalActionButton: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  goalActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: 'Lato-Bold',
  },
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'Lato-Bold',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
    fontFamily: 'Lato-Regular',
  },
  createFirstGoalButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  createFirstGoalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  deleteButton: {
    backgroundColor: EXPENSE_COLOR,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
export default SavingsScreen; 