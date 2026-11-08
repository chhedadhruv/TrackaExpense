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
  Platform,
} from 'react-native';
import {Card, ActivityIndicator} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {reportError} from '../src/services/ErrorReporter';
import * as AnalyticsService from '../src/services/AnalyticsService';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {DatePickerModal} from 'react-native-paper-dates';
import {useCurrency} from '../utils/CurrencyUtil';
import {GOAL_KEYWORD_MAP} from '../utils/CategoryData';
import ReminderNotificationService from '../services/ReminderNotificationService';
import {
  PRIMARY_COLOR,
  BACKGROUND_COLOR,
  EXPENSE_COLOR,
} from '../src/constants/theme';
import {formatDisplayDate} from '../src/utils/formatters';
import type {SavingsGoal} from '../src/types';

const SUCCESS_COLOR = '#25B07F';
const ORANGE_COLOR = '#F5A623';

interface GoalCategory {
  id: string;
  label: string;
  icon: string;
}

const GOAL_CATEGORIES: GoalCategory[] = [
  {id: 'emergency', label: 'Emergency', icon: 'shield-check'},
  {id: 'vacation', label: 'Vacation', icon: 'airplane'},
  {id: 'house', label: 'House', icon: 'home-city'},
  {id: 'car', label: 'Car', icon: 'car-sports'},
  {id: 'education', label: 'Education', icon: 'school'},
  {id: 'investment', label: 'Investment', icon: 'chart-line'},
  {id: 'wedding', label: 'Wedding', icon: 'ring'},
  {id: 'electronics', label: 'Electronics', icon: 'devices'},
  {id: 'other', label: 'Other', icon: 'piggy-bank'},
];

interface EditValues {
  name: string;
  description: string;
  current: string;
  target: string;
  monthly: string;
  category: string;
  targetDate: string;
}

type InputType = 'add' | 'withdraw' | '';

const EMPTY_EDIT_VALUES: EditValues = {
  name: '',
  description: '',
  current: '',
  target: '',
  monthly: '',
  category: 'other',
  targetDate: '',
};

const SavingsScreen = ({navigation}: {navigation: any}) => {
  const {currency, formatAmount: formatCurrencyAmount} = useCurrency();
  const [loading, setLoading] = useState(true);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues>(EMPTY_EDIT_VALUES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputAmount, setInputAmount] = useState('');
  const [inputType, setInputType] = useState<InputType>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<SavingsGoal | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderGoalId, setReminderGoalId] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [openDate, setOpenDate] = useState(false);
  const [categoryManuallySelected, setCategoryManuallySelected] =
    useState(false);

  useEffect(() => {
    fetchSavingsData();
  }, []);

  useEffect(() => {
    if (editValues.name.trim().length < 3 || categoryManuallySelected) {
      return;
    }
    const lower = editValues.name.toLowerCase();
    const match = Object.keys(GOAL_KEYWORD_MAP).find(kw => lower.includes(kw));
    if (match) {
      setEditValues(prev => ({...prev, category: GOAL_KEYWORD_MAP[match]}));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editValues.name]);

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
      const storedGoals = userData?.savingsGoals;
      if (Array.isArray(storedGoals) && storedGoals.length > 0) {
        setSavingsGoals(storedGoals as SavingsGoal[]);
      } else {
        const defaultGoal: SavingsGoal = {
          id: Date.now().toString(),
          name: 'Emergency Fund',
          description: 'Your emergency savings for unexpected expenses',
          current: 0,
          target: 10000,
          monthly: 500,
          category: 'emergency',
          targetDate: '',
          reminderEnabled: false,
          reminderFrequency: null,
          createdAt: firestore.Timestamp.fromDate(new Date()),
          updatedAt: firestore.Timestamp.fromDate(new Date()),
        };
        await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .update({savingsGoals: [defaultGoal]});
        setSavingsGoals([defaultGoal]);
      }

      setLoading(false);
    } catch (error: any) {
      reportError(error as Error);
      Alert.alert('Error', 'Failed to load savings data. Please try again.');
      setLoading(false);
    }
  };

  const handleEdit = (goalId: string) => {
    const goal = savingsGoals.find(g => g.id === goalId);
    if (goal) {
      setEditingGoalId(goalId);
      setEditValues({
        name: goal.name,
        description: goal.description || '',
        current: goal.current.toString(),
        target: goal.target.toString(),
        monthly: goal.monthly.toString(),
        category: goal.category || 'other',
        targetDate: goal.targetDate || '',
      });
      setCategoryManuallySelected(false);
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingGoalId(null);
    setEditValues(EMPTY_EDIT_VALUES);
    setCategoryManuallySelected(false);
  };

  const validateGoalValues = (
    values: EditValues,
    current: number,
    target: number,
    monthly: number,
  ): boolean => {
    if (!values.name || !values.current || !values.target || !values.monthly) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }
    if (values.name.trim().length > 50) {
      Alert.alert('Error', 'Goal name must be 50 characters or less');
      return false;
    }
    if (values.description.trim().length > 200) {
      Alert.alert('Error', 'Description must be 200 characters or less');
      return false;
    }
    if (isNaN(current) || isNaN(target) || isNaN(monthly)) {
      Alert.alert('Error', 'Please enter valid numbers');
      return false;
    }
    if (current < 0 || target < 0 || monthly < 0) {
      Alert.alert('Error', 'Values cannot be negative');
      return false;
    }
    if (current > 999999999 || target > 999999999 || monthly > 999999999) {
      Alert.alert(
        'Error',
        'Values are too large. Please enter smaller amounts.',
      );
      return false;
    }
    if (current > target) {
      Alert.alert('Error', 'Current amount cannot exceed target amount');
      return false;
    }
    if (values.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.targetDate)) {
      Alert.alert('Error', 'Target date must be in YYYY-MM-DD format');
      return false;
    }
    if (values.targetDate) {
      const date = new Date(values.targetDate);
      if (isNaN(date.getTime()) || date <= new Date()) {
        Alert.alert('Error', 'Target date must be a valid future date');
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    const current = parseFloat(editValues.current);
    const target = parseFloat(editValues.target);
    const monthly = parseFloat(editValues.monthly);
    if (!validateGoalValues(editValues, current, target, monthly)) {
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
          const oldGoal = {...goal};
          const newGoal: SavingsGoal = {
            ...goal,
            name: editValues.name,
            description: editValues.description,
            current,
            target,
            monthly,
            category: editValues.category || 'other',
            targetDate: editValues.targetDate || '',
            updatedAt: firestore.Timestamp.fromDate(new Date()),
          };

          const changed =
            current !== oldGoal.current ||
            target !== oldGoal.target ||
            monthly !== oldGoal.monthly ||
            editValues.name !== oldGoal.name ||
            editValues.description !== oldGoal.description ||
            editValues.category !== oldGoal.category ||
            editValues.targetDate !== oldGoal.targetDate;

          if (changed) {
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

      await userDocRef.update({savingsGoals: updatedGoals});
      setSavingsGoals(updatedGoals);
      setIsEditing(false);
      setEditingGoalId(null);
      Alert.alert('Success', 'Savings goal updated successfully');
    } catch (error: any) {
      reportError(error as Error);
      Alert.alert('Error', `Failed to update savings goal: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addToSavings = async (amount: string) => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (parsed > 999999999) {
      Alert.alert(
        'Error',
        'Amount is too large. Please enter a smaller amount.',
      );
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
          const newCurrent = goal.current + parsed;
          const updatedGoal = {
            ...goal,
            current: newCurrent,
            updatedAt: firestore.Timestamp.fromDate(new Date()),
          };

          userDocRef.collection('savingsHistory').add({
            goalId: selectedGoalId,
            goalName: goal.name,
            type: 'deposit',
            amount: parsed,
            previousAmount: goal.current,
            newAmount: newCurrent,
            createdAt: firestore.Timestamp.fromDate(new Date()),
          });

          return updatedGoal;
        }
        return goal;
      });

      await userDocRef.update({savingsGoals: updatedGoals});
      setSavingsGoals(updatedGoals);
      AnalyticsService.logAddFundsToGoal({
        amount_range: AnalyticsService.getAmountRange(parsed),
        goal_category:
          savingsGoals.find(g => g.id === selectedGoalId)?.category ?? 'other',
      });
      Alert.alert(
        'Success',
        `${formatCurrencyAmount(parsed)} added to ${
          savingsGoals.find(g => g.id === selectedGoalId)?.name
        }`,
      );
    } catch (error: any) {
      reportError(error as Error);
      Alert.alert('Error', `Failed to add to savings: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const withdrawFromSavings = async (amount: string) => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (parsed > 999999999) {
      Alert.alert(
        'Error',
        'Amount is too large. Please enter a smaller amount.',
      );
      return;
    }
    if (!selectedGoalId) {
      Alert.alert('Error', 'Please select a savings goal first');
      return;
    }

    const selectedGoal = savingsGoals.find(g => g.id === selectedGoalId);
    if (!selectedGoal || parsed > selectedGoal.current) {
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
          const newCurrent = goal.current - parsed;
          const updatedGoal = {
            ...goal,
            current: newCurrent,
            updatedAt: firestore.Timestamp.fromDate(new Date()),
          };

          userDocRef.collection('savingsHistory').add({
            goalId: selectedGoalId,
            goalName: goal.name,
            type: 'withdrawal',
            amount: parsed,
            previousAmount: goal.current,
            newAmount: newCurrent,
            createdAt: firestore.Timestamp.fromDate(new Date()),
          });

          return updatedGoal;
        }
        return goal;
      });

      await userDocRef.update({savingsGoals: updatedGoals});
      setSavingsGoals(updatedGoals);
      AnalyticsService.logWithdrawFromGoal({
        amount_range: AnalyticsService.getAmountRange(parsed),
      });
      Alert.alert(
        'Success',
        `${formatCurrencyAmount(parsed)} withdrawn from ${selectedGoal.name}`,
      );
    } catch (error: any) {
      reportError(error as Error);
      Alert.alert('Error', `Failed to withdraw from savings: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateProgress = (goal: SavingsGoal): number => {
    if (goal.target === 0) {
      return 0;
    }
    return Math.min((goal.current / goal.target) * 100, 100);
  };

  const calculateMonthsToTarget = (goal: SavingsGoal): number | null => {
    if (goal.monthly === 0) {
      return null;
    }
    const remaining = goal.target - goal.current;
    if (remaining <= 0) {
      return 0;
    }
    return Math.ceil(remaining / goal.monthly);
  };

  const getProgressColor = (progress: number): string => {
    if (progress >= 75) {
      return SUCCESS_COLOR;
    }
    if (progress >= 25) {
      return ORANGE_COLOR;
    }
    return EXPENSE_COLOR;
  };

  const getCategoryIcon = (category: string): string => {
    const cat = GOAL_CATEGORIES.find(c => c.id === category);
    return cat ? cat.icon : 'piggy-bank';
  };

  const calculateTargetDateLabel = (
    targetDate: string | undefined,
  ): string | null => {
    if (!targetDate) {
      return null;
    }
    const date = new Date(targetDate);
    const now = new Date();
    const diffDays = Math.ceil(
      (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays < 0) {
      return 'Overdue';
    }
    if (diffDays === 0) {
      return 'Due today';
    }
    if (diffDays < 30) {
      return `${diffDays} days left`;
    }
    const monthsLeft = Math.ceil(diffDays / 30);
    const targetMonth = date.toLocaleString('default', {
      month: 'short',
      year: 'numeric',
    });
    return `Due ${targetMonth} · ${monthsLeft}mo left`;
  };

  const getRequiredMonthly = (goal: SavingsGoal): number | null => {
    if (!goal.targetDate) {
      return null;
    }
    const date = new Date(goal.targetDate);
    const now = new Date();
    const monthsLeft = Math.max(
      1,
      Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)),
    );
    const remaining = goal.target - goal.current;
    if (remaining <= 0) {
      return null;
    }
    return remaining / monthsLeft;
  };

  const handleTargetDateChange = (text: string) => {
    setEditValues(prev => {
      const updated = {...prev, targetDate: text};
      if (text && text.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
        const date = new Date(text);
        const now = new Date();
        if (date > now) {
          const monthsLeft = Math.max(
            1,
            Math.ceil(
              (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30),
            ),
          );
          const current = parseFloat(prev.current) || 0;
          const target = parseFloat(prev.target) || 0;
          const remaining = target - current;
          if (remaining > 0 && (!prev.monthly || prev.monthly === '0')) {
            updated.monthly = Math.ceil(remaining / monthsLeft).toString();
          }
        }
      }
      return updated;
    });
  };

  const onDismissDate = () => setOpenDate(false);

  const onConfirmDate = (params: any) => {
    setOpenDate(false);
    const d: Date = params.date;
    const formatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(d.getDate()).padStart(2, '0')}`;
    handleTargetDateChange(formatted);
  };

  const showAmountInput = (type: 'add' | 'withdraw') => {
    setInputType(type);
    setInputAmount('');
    setShowInputModal(true);
  };

  const handleAmountSubmit = () => {
    if (
      !inputAmount ||
      isNaN(parseFloat(inputAmount)) ||
      parseFloat(inputAmount) <= 0
    ) {
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
    const current = parseFloat(editValues.current);
    const target = parseFloat(editValues.target);
    const monthly = parseFloat(editValues.monthly);
    if (!validateGoalValues(editValues, current, target, monthly)) {
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
      const newGoal: SavingsGoal = {
        id: Date.now().toString(),
        name: editValues.name,
        description: editValues.description,
        current,
        target,
        monthly,
        category: editValues.category || 'other',
        targetDate: editValues.targetDate || '',
        reminderEnabled: false,
        reminderFrequency: null,
        createdAt: firestore.Timestamp.fromDate(new Date()),
        updatedAt: firestore.Timestamp.fromDate(new Date()),
      };

      const updatedGoals = [...savingsGoals, newGoal];
      await userDocRef.update({savingsGoals: updatedGoals});

      await userDocRef.collection('savingsHistory').add({
        goalId: newGoal.id,
        goalName: newGoal.name,
        type: 'create',
        newGoal,
        createdAt: firestore.Timestamp.fromDate(new Date()),
      });

      setSavingsGoals(updatedGoals);
      setShowCreateModal(false);
      setEditValues(EMPTY_EDIT_VALUES);
      AnalyticsService.logCreateSavingsGoal({
        category: editValues.category || 'other',
        has_target_date: !!editValues.targetDate,
        has_monthly_target: parseFloat(editValues.monthly) > 0,
      });
      Alert.alert('Success', 'Savings goal created successfully');
    } catch (error: any) {
      reportError(error as Error);
      Alert.alert('Error', `Failed to create savings goal: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteGoal = async (goalId: string | undefined) => {
    if (!goalId) {
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
      const deletedGoal = savingsGoals.find(g => g.id === goalId);
      const updatedGoals = savingsGoals.filter(g => g.id !== goalId);

      await userDocRef.update({savingsGoals: updatedGoals});

      await userDocRef.collection('savingsHistory').add({
        goalId,
        goalName: deletedGoal?.name,
        type: 'delete',
        deletedGoal,
        createdAt: firestore.Timestamp.fromDate(new Date()),
      });

      setSavingsGoals(updatedGoals);
      setShowDeleteModal(false);
      setGoalToDelete(null);
      AnalyticsService.logDeleteSavingsGoal();
      Alert.alert('Success', 'Savings goal deleted successfully');
    } catch (error: any) {
      reportError(error as Error);
      Alert.alert('Error', `Failed to delete savings goal: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (goalId: string) => {
    const goal = savingsGoals.find(g => g.id === goalId);
    setGoalToDelete(goal ?? null);
    setShowDeleteModal(true);
  };

  const handleReminderToggle = (goalId: string) => {
    const goal = savingsGoals.find(g => g.id === goalId);
    if (goal?.reminderEnabled) {
      toggleReminder(goalId, false, null);
    } else {
      setReminderGoalId(goalId);
      setShowReminderModal(true);
    }
  };

  const toggleReminder = async (
    goalId: string,
    enabled: boolean,
    frequency: string | null,
  ) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        return;
      }
      const userDocRef = firestore().collection('users').doc(currentUser.uid);
      const updatedGoals = savingsGoals.map(goal =>
        goal.id === goalId
          ? {...goal, reminderEnabled: enabled, reminderFrequency: frequency}
          : goal,
      );
      await userDocRef.update({savingsGoals: updatedGoals});
      setSavingsGoals(updatedGoals);

      if (enabled) {
        const goal = updatedGoals.find(g => g.id === goalId);
        if (goal) {
          await ReminderNotificationService.sendSavingsGoalReminder(
            goal,
            currentUser.uid,
          );
        }
        Alert.alert(
          'Reminder Set',
          `You'll receive ${frequency} reminders for "${goal?.name}".`,
        );
      }
    } catch (e) {
      reportError(e as Error);
    }
  };

  const resetEditValues = () => {
    setEditValues(EMPTY_EDIT_VALUES);
    setCategoryManuallySelected(false);
  };

  const totalSaved = savingsGoals.reduce((sum, g) => sum + g.current, 0);
  const totalTarget = savingsGoals.reduce((sum, g) => sum + g.target, 0);
  const overallProgress =
    totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;

  const renderCategoryButton = () => {
    const cat = GOAL_CATEGORIES.find(c => c.id === editValues.category);
    return cat ? (
      <>
        <MaterialCommunityIcons
          name={cat.icon}
          size={20}
          color={PRIMARY_COLOR}
        />
        <Text style={styles.categorySelectorText}>{cat.label}</Text>
      </>
    ) : (
      <Text style={styles.categorySelectorPlaceholder}>Select category</Text>
    );
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
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerTitleLeft}>
                <MaterialCommunityIcons
                  name="piggy-bank"
                  size={32}
                  color={SUCCESS_COLOR}
                />
                <Text style={styles.headerTitle}>Savings Goals</Text>
              </View>
              <TouchableOpacity
                style={styles.historyIconButton}
                onPress={() => navigation.navigate('SavingsHistory')}>
                <MaterialCommunityIcons
                  name="history"
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSubtitle}>
              Track and manage multiple savings goals
            </Text>
            <TouchableOpacity
              style={styles.addGoalButton}
              onPress={() => setShowCreateModal(true)}>
              <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.addGoalButtonText}>Add New Goal</Text>
            </TouchableOpacity>
          </View>

          {/* Summary Hero Card */}
          {savingsGoals.length > 0 && (
            <Card
              style={[
                styles.summaryCard,
                Platform.OS === 'android' && styles.cardAndroid,
              ]}
              elevation={Platform.OS === 'android' ? 0 : 2}>
              <View style={styles.cardContent}>
                <Text style={styles.summaryLabel}>Total Saved</Text>
                <Text style={styles.summaryAmount}>
                  {formatCurrencyAmount(totalSaved)}
                </Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTarget}>
                    of {formatCurrencyAmount(totalTarget)} target
                  </Text>
                  <Text style={styles.summaryPercent}>
                    {overallProgress.toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${overallProgress}%` as any,
                        backgroundColor: getProgressColor(overallProgress),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.summaryGoalCount}>
                  {savingsGoals.length}{' '}
                  {savingsGoals.length === 1 ? 'goal' : 'goals'} active
                </Text>
              </View>
            </Card>
          )}

          {/* Goals List */}
          {savingsGoals.length > 0 ? (
            savingsGoals.map(goal => {
              const progress = calculateProgress(goal);
              const progressColor = getProgressColor(progress);
              const targetDateLabel = calculateTargetDateLabel(goal.targetDate);
              const requiredMonthly = getRequiredMonthly(goal);
              const monthsToTarget = calculateMonthsToTarget(goal);

              return (
                <Card
                  key={goal.id}
                  style={[
                    styles.savingsCard,
                    Platform.OS === 'android' && styles.cardAndroid,
                  ]}
                  elevation={Platform.OS === 'android' ? 0 : 2}>
                  <View style={styles.cardContent}>
                    <View style={styles.savingsHeader}>
                      <View style={styles.goalCategoryIcon}>
                        <MaterialCommunityIcons
                          name={getCategoryIcon(goal.category)}
                          size={24}
                          color={PRIMARY_COLOR}
                        />
                      </View>
                      <View style={styles.goalInfo}>
                        <Text style={styles.goalName}>{goal.name}</Text>
                        {goal.description ? (
                          <Text style={styles.goalDescription}>
                            {goal.description}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.goalHeaderActions}>
                        <TouchableOpacity
                          onPress={() => handleReminderToggle(goal.id)}
                          style={styles.actionIcon}>
                          <MaterialCommunityIcons
                            name={
                              goal.reminderEnabled ? 'bell' : 'bell-outline'
                            }
                            size={20}
                            color={
                              goal.reminderEnabled ? PRIMARY_COLOR : '#999'
                            }
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleEdit(goal.id)}
                          style={styles.actionIcon}>
                          <MaterialCommunityIcons
                            name="pencil"
                            size={20}
                            color={PRIMARY_COLOR}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => confirmDelete(goal.id)}
                          style={styles.actionIcon}>
                          <MaterialCommunityIcons
                            name="delete"
                            size={20}
                            color={EXPENSE_COLOR}
                          />
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
                            onChangeText={text =>
                              setEditValues({...editValues, name: text})
                            }
                            placeholder="Enter goal name"
                            placeholderTextColor="#999"
                            maxLength={50}
                          />
                          <Text style={styles.characterCount}>
                            {editValues.name.length}/50
                          </Text>
                        </View>
                        <View style={styles.inputContainer}>
                          <Text style={styles.inputLabel}>
                            Description (Optional)
                          </Text>
                          <TextInput
                            style={styles.textInput}
                            value={editValues.description}
                            onChangeText={text =>
                              setEditValues({...editValues, description: text})
                            }
                            placeholder="Enter description"
                            placeholderTextColor="#999"
                            maxLength={200}
                            multiline
                            numberOfLines={2}
                          />
                          <Text style={styles.characterCount}>
                            {editValues.description.length}/200
                          </Text>
                        </View>
                        <View style={styles.inputContainer}>
                          <Text style={styles.inputLabel}>Category</Text>
                          <TouchableOpacity
                            style={styles.categorySelectorButton}
                            onPress={() => setShowCategoryModal(true)}>
                            {renderCategoryButton()}
                            <MaterialCommunityIcons
                              name="chevron-down"
                              size={20}
                              color="#999"
                            />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.inputContainer}>
                          <Text style={styles.inputLabel}>
                            Current Amount ({currency.symbol})
                          </Text>
                          <TextInput
                            style={styles.textInput}
                            value={editValues.current}
                            onChangeText={text =>
                              setEditValues({...editValues, current: text})
                            }
                            keyboardType="numeric"
                            placeholder="Enter current amount"
                            placeholderTextColor="#999"
                          />
                        </View>
                        <View style={styles.inputContainer}>
                          <Text style={styles.inputLabel}>
                            Target Amount ({currency.symbol})
                          </Text>
                          <TextInput
                            style={styles.textInput}
                            value={editValues.target}
                            onChangeText={text =>
                              setEditValues({...editValues, target: text})
                            }
                            keyboardType="numeric"
                            placeholder="Enter target amount"
                            placeholderTextColor="#999"
                          />
                        </View>
                        <View style={styles.inputContainer}>
                          <Text style={styles.inputLabel}>
                            Target Date (Optional)
                          </Text>
                          <TouchableOpacity
                            style={styles.dateInputWrapper}
                            onPress={() => setOpenDate(true)}>
                            <MaterialCommunityIcons
                              name="calendar"
                              size={20}
                              color={PRIMARY_COLOR}
                              style={styles.inputIcon}
                            />
                            <Text
                              style={[
                                styles.dateText,
                                !editValues.targetDate &&
                                  styles.placeholderText,
                              ]}>
                              {editValues.targetDate
                                ? formatDisplayDate(editValues.targetDate)
                                : 'Select target date'}
                            </Text>
                            <MaterialCommunityIcons
                              name="chevron-down"
                              size={20}
                              color="#999"
                            />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.inputContainer}>
                          <Text style={styles.inputLabel}>
                            Monthly Goal ({currency.symbol})
                          </Text>
                          <TextInput
                            style={styles.textInput}
                            value={editValues.monthly}
                            onChangeText={text =>
                              setEditValues({...editValues, monthly: text})
                            }
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
                        <Text style={styles.savingsAmount}>
                          {formatCurrencyAmount(goal.current)}
                        </Text>

                        {targetDateLabel && (
                          <View
                            style={[
                              styles.targetDateBadge,
                              targetDateLabel === 'Overdue' &&
                                styles.targetDateBadgeOverdue,
                            ]}>
                            <MaterialCommunityIcons
                              name="calendar-clock"
                              size={12}
                              color={
                                targetDateLabel === 'Overdue'
                                  ? EXPENSE_COLOR
                                  : PRIMARY_COLOR
                              }
                            />
                            <Text
                              style={[
                                styles.targetDateText,
                                targetDateLabel === 'Overdue' &&
                                  styles.targetDateTextOverdue,
                              ]}>
                              {targetDateLabel}
                            </Text>
                          </View>
                        )}

                        <View style={styles.savingsInfo}>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Target:</Text>
                            <Text style={styles.infoValue}>
                              {formatCurrencyAmount(goal.target)}
                            </Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Monthly Goal:</Text>
                            <Text style={styles.infoValue}>
                              {formatCurrencyAmount(goal.monthly)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.progressSection}>
                          <Text style={styles.progressTitle}>
                            Progress to Goal
                          </Text>
                          <View style={styles.progressBar}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  width: `${progress}%` as any,
                                  backgroundColor: progressColor,
                                },
                              ]}
                            />
                          </View>
                          <Text
                            style={[
                              styles.progressText,
                              {color: progressColor},
                            ]}>
                            {progress.toFixed(1)}% Complete
                          </Text>
                          {progress >= 100 ? (
                            <Text style={styles.monthsText}>
                              Goal achieved! 🎉
                            </Text>
                          ) : requiredMonthly ? (
                            <Text style={styles.monthsText}>
                              Need {formatCurrencyAmount(requiredMonthly)}/month
                              to reach goal by{' '}
                              {new Date(goal.targetDate!).toLocaleString(
                                'default',
                                {month: 'short', year: 'numeric'},
                              )}
                            </Text>
                          ) : monthsToTarget !== null ? (
                            <Text style={styles.monthsText}>
                              {monthsToTarget === 0
                                ? 'Almost there!'
                                : `${monthsToTarget} months to target`}
                            </Text>
                          ) : (
                            <Text style={styles.monthsText}>
                              No monthly goal set
                            </Text>
                          )}
                        </View>

                        <View style={styles.goalActionsRow}>
                          <TouchableOpacity
                            style={[styles.goalActionButton, styles.addButton]}
                            onPress={() => {
                              setSelectedGoalId(goal.id);
                              showAmountInput('add');
                            }}
                            disabled={isSubmitting}>
                            <MaterialCommunityIcons
                              name="plus"
                              size={20}
                              color="#FFFFFF"
                            />
                            <Text style={styles.goalActionText}>Add Money</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.goalActionButton,
                              styles.withdrawButton,
                            ]}
                            onPress={() => {
                              setSelectedGoalId(goal.id);
                              showAmountInput('withdraw');
                            }}
                            disabled={isSubmitting}>
                            <MaterialCommunityIcons
                              name="minus"
                              size={20}
                              color="#FFFFFF"
                            />
                            <Text style={styles.goalActionText}>Withdraw</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                </Card>
              );
            })
          ) : (
            <Card
              style={[
                styles.emptyStateCard,
                Platform.OS === 'android' && styles.cardAndroid,
              ]}
              elevation={Platform.OS === 'android' ? 0 : 2}>
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="piggy-bank-outline"
                  size={64}
                  color="#CBD3EE"
                />
                <Text style={styles.emptyStateTitle}>No Savings Goals Yet</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Create your first savings goal to start tracking your progress
                </Text>
                <TouchableOpacity
                  style={styles.createFirstGoalButton}
                  onPress={() => setShowCreateModal(true)}>
                  <Text style={styles.createFirstGoalButtonText}>
                    Create Your First Goal
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
        </KeyboardAwareScrollView>

        {/* Add / Withdraw Modal */}
        <Modal
          visible={showInputModal}
          transparent
          animationType="slide"
          onRequestClose={handleAmountCancel}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {inputType === 'add'
                  ? 'Add to Savings'
                  : 'Withdraw from Savings'}
              </Text>
              <Text style={styles.modalSubtitle}>
                {inputType === 'add'
                  ? 'Enter the amount you want to add to your savings'
                  : 'Enter the amount you want to withdraw from your savings'}
              </Text>
              <TextInput
                style={styles.modalInput}
                value={inputAmount}
                onChangeText={setInputAmount}
                placeholder="Enter amount"
                placeholderTextColor="#999"
                keyboardType="numeric"
                autoFocus
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
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowCreateModal(false);
            resetEditValues();
          }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create New Savings Goal</Text>
              <Text style={styles.modalSubtitle}>
                Set up a new savings goal to track your progress
              </Text>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Goal Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editValues.name}
                    onChangeText={text =>
                      setEditValues({...editValues, name: text})
                    }
                    placeholder="e.g., Emergency Fund, Vacation"
                    placeholderTextColor="#999"
                    maxLength={50}
                  />
                  <Text style={styles.characterCount}>
                    {editValues.name.length}/50
                  </Text>
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Description (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editValues.description}
                    onChangeText={text =>
                      setEditValues({...editValues, description: text})
                    }
                    placeholder="Describe your savings goal"
                    placeholderTextColor="#999"
                    maxLength={200}
                    multiline
                    numberOfLines={2}
                  />
                  <Text style={styles.characterCount}>
                    {editValues.description.length}/200
                  </Text>
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Category</Text>
                  <TouchableOpacity
                    style={styles.categorySelectorButton}
                    onPress={() => setShowCategoryModal(true)}>
                    {renderCategoryButton()}
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color="#999"
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    Current Amount ({currency.symbol}) *
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={editValues.current}
                    onChangeText={text =>
                      setEditValues({...editValues, current: text})
                    }
                    keyboardType="numeric"
                    placeholder="Enter current amount"
                    placeholderTextColor="#999"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    Target Amount ({currency.symbol}) *
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={editValues.target}
                    onChangeText={text =>
                      setEditValues({...editValues, target: text})
                    }
                    keyboardType="numeric"
                    placeholder="Enter target amount"
                    placeholderTextColor="#999"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Target Date (Optional)</Text>
                  <TouchableOpacity
                    style={styles.dateInputWrapper}
                    onPress={() => setOpenDate(true)}>
                    <MaterialCommunityIcons
                      name="calendar"
                      size={20}
                      color={PRIMARY_COLOR}
                      style={styles.inputIcon}
                    />
                    <Text
                      style={[
                        styles.dateText,
                        !editValues.targetDate && styles.placeholderText,
                      ]}>
                      {editValues.targetDate
                        ? formatDisplayDate(editValues.targetDate)
                        : 'Select target date'}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color="#999"
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    Monthly Goal ({currency.symbol}) *
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={editValues.monthly}
                    onChangeText={text =>
                      setEditValues({...editValues, monthly: text})
                    }
                    keyboardType="numeric"
                    placeholder="Enter monthly goal"
                    placeholderTextColor="#999"
                  />
                </View>
              </ScrollView>
              <View style={[styles.modalButtons, {marginTop: 10}]}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    setShowCreateModal(false);
                    resetEditValues();
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
                    <Text style={styles.modalSubmitButtonText}>
                      Create Goal
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          visible={showDeleteModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={48}
                color={EXPENSE_COLOR}
              />
              <Text style={styles.modalTitle}>Delete Savings Goal</Text>
              <Text style={styles.modalSubtitle}>
                Are you sure you want to delete "{goalToDelete?.name}"? This
                action cannot be undone.
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

        {/* Reminder Frequency Modal */}
        <Modal
          visible={showReminderModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowReminderModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <MaterialCommunityIcons
                name="bell-ring"
                size={40}
                color={PRIMARY_COLOR}
              />
              <Text style={styles.modalTitle}>Set Reminder</Text>
              <Text style={styles.modalSubtitle}>
                How often would you like to be reminded about this savings goal?
              </Text>
              <TouchableOpacity
                style={styles.reminderOption}
                onPress={() => {
                  setShowReminderModal(false);
                  toggleReminder(reminderGoalId!, true, 'weekly');
                }}>
                <MaterialCommunityIcons
                  name="calendar-week"
                  size={22}
                  color={PRIMARY_COLOR}
                />
                <View style={styles.reminderOptionText}>
                  <Text style={styles.reminderOptionTitle}>Weekly</Text>
                  <Text style={styles.reminderOptionSubtitle}>
                    Every week to check in on your goal
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#CCC"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reminderOption}
                onPress={() => {
                  setShowReminderModal(false);
                  toggleReminder(reminderGoalId!, true, 'monthly');
                }}>
                <MaterialCommunityIcons
                  name="calendar-month"
                  size={22}
                  color={PRIMARY_COLOR}
                />
                <View style={styles.reminderOptionText}>
                  <Text style={styles.reminderOptionTitle}>Monthly</Text>
                  <Text style={styles.reminderOptionSubtitle}>
                    Once a month to review progress
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#CCC"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCancelButton, styles.reminderCancelButton]}
                onPress={() => setShowReminderModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <DatePickerModal
          locale="en"
          mode="single"
          visible={openDate}
          onDismiss={onDismissDate}
          date={
            editValues.targetDate ? new Date(editValues.targetDate) : new Date()
          }
          onConfirm={onConfirmDate}
          saveLabel="Confirm"
          label="Select target date"
          uppercase={false}
          validRange={{startDate: new Date()}}
          {...(Platform.OS === 'ios' && {presentationStyle: 'pageSheet'})}
        />

        {/* Category Picker Modal */}
        <Modal
          visible={showCategoryModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCategoryModal(false)}>
          <View style={styles.categoryModalOverlay}>
            <View style={styles.categoryModalSheet}>
              <View style={styles.categoryModalHeader}>
                <Text style={styles.categoryModalTitle}>Select Category</Text>
                <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                  <MaterialCommunityIcons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <View style={styles.categoryGrid}>
                {GOAL_CATEGORIES.map(cat => {
                  const isSelected = editValues.category === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        isSelected && styles.categoryChipSelected,
                      ]}
                      onPress={() => {
                        setEditValues({...editValues, category: cat.id});
                        setCategoryManuallySelected(true);
                        setShowCategoryModal(false);
                      }}>
                      <MaterialCommunityIcons
                        name={cat.icon}
                        size={22}
                        color={isSelected ? '#FFFFFF' : PRIMARY_COLOR}
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && styles.categoryChipTextSelected,
                        ]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaProvider>
  );
};

export default SavingsScreen;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
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
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  headerTitleLeft: {flexDirection: 'row', alignItems: 'center'},
  historyIconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
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
  summaryCard: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Lato-Regular',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Kufam-SemiBoldItalic',
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryTarget: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: 'Lato-Regular',
  },
  summaryPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Lato-Bold',
  },
  summaryGoalCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    fontFamily: 'Lato-Regular',
  },
  savingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cardContent: {padding: 25},
  savingsHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 15},
  goalCategoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF0FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  goalInfo: {flex: 1},
  goalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  goalDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
    fontFamily: 'Lato-Regular',
  },
  goalHeaderActions: {flexDirection: 'row', alignItems: 'center'},
  actionIcon: {padding: 6, marginLeft: 2},
  savingsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: SUCCESS_COLOR,
    marginBottom: 8,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  targetDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF0FB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 4,
  },
  targetDateBadgeOverdue: {backgroundColor: '#FFF0F0'},
  targetDateText: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontFamily: 'Lato-Regular',
    marginLeft: 4,
  },
  targetDateTextOverdue: {color: EXPENSE_COLOR},
  savingsInfo: {marginTop: 4, marginBottom: 4},
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {fontSize: 14, color: '#666', fontFamily: 'Lato-Regular'},
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  progressSection: {marginTop: 15, marginBottom: 15},
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 10,
    fontFamily: 'Lato-Bold',
  },
  progressBar: {
    height: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {height: '100%', borderRadius: 6},
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'Lato-Bold',
  },
  monthsText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
  goalActionsRow: {
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
  addButton: {backgroundColor: PRIMARY_COLOR},
  withdrawButton: {backgroundColor: EXPENSE_COLOR},
  goalActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: 'Lato-Bold',
  },
  editForm: {marginTop: 10},
  inputContainer: {marginBottom: 15},
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
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  inputIcon: {marginRight: 10},
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  placeholderText: {color: '#999'},
  characterCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
    fontFamily: 'Lato-Regular',
  },
  categorySelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 10,
  },
  categorySelectorText: {
    flex: 1,
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  categorySelectorPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: '#999',
    fontFamily: 'Lato-Regular',
  },
  categoryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  categoryModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  categoryModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  categoryGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  categoryChip: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  categoryChipSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  categoryChipText: {
    fontSize: 12,
    color: '#555',
    marginTop: 5,
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
  },
  categoryChipTextSelected: {color: '#FFFFFF', fontFamily: 'Lato-Bold'},
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
  saveButton: {backgroundColor: PRIMARY_COLOR},
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
    maxHeight: '85%',
    elevation: Platform.OS === 'android' ? 0 : 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
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
  modalButtons: {flexDirection: 'row', justifyContent: 'space-between'},
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
  modalSubmitButton: {backgroundColor: PRIMARY_COLOR},
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
  deleteButton: {backgroundColor: EXPENSE_COLOR},
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  reminderOptionText: {flex: 1, marginLeft: 14},
  reminderOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    fontFamily: 'Lato-Bold',
  },
  reminderOptionSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontFamily: 'Lato-Regular',
  },
  reminderCancelButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
});
