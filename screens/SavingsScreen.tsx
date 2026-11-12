import React, {useState, useEffect, useRef} from 'react';
import {useRouter} from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import {Card, ActivityIndicator} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getFirestore,
  updateDoc,
} from '@react-native-firebase/firestore';
import {getAuth} from '@react-native-firebase/auth';
import {reportError} from '../src/services/ErrorReporter';
import * as AnalyticsService from '../src/services/AnalyticsService';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import {KeyboardAvoidingModal} from '../src/components/KeyboardAvoidingModal';
import {DatePickerModal} from 'react-native-paper-dates';
import {useCurrency} from '../utils/CurrencyUtil';
import {GOAL_KEYWORD_MAP} from '../utils/CategoryData';
import ReminderNotificationService from '../services/ReminderNotificationService';
import {useTheme, useThemedStyles, type ThemeColors} from '../src/theme';
import {ErrorState, LoadingState} from '../src/components/ScreenState';
import {useUserData} from '../src/data/hooks';
import {formatDisplayDate} from '../src/utils/formatters';
import {
  addMajor,
  savingsHistoryMoneyFields,
  subtractMajor,
  sumValuesMajor,
} from '../src/utils/amounts';
import type {SavingsGoal} from '../src/types';
import type {McIconName} from '../src/types/icons';
import {snackbar} from '../src/utils/snackbarStore';
import {ModalSnackbar} from '../src/components/Snackbar';

interface GoalCategory {
  id: string;
  label: string;
  icon: McIconName;
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

// A stable empty list, so the effect that creates the starter goal does not run on every render.
const NO_GOALS: SavingsGoal[] = [];

const SavingsScreen = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const styles = useThemedStyles(createStyles);
  const {currency, formatAmount: formatCurrencyAmount} = useCurrency();
  // The goals are part of the profile document, which the shared cache keeps current through a
  // live listener (src/data). Every change below rewrites the whole goals array from what is on
  // screen, so the screen shows goals only once the listener has confirmed them (`user.live`):
  // a copy saved on the phone could be older than what another device wrote.
  const user = useUserData();
  const savingsGoals = user.data?.savingsGoals ?? NO_GOALS;
  const creatingDefaultGoal = useRef(false);
  const [defaultGoalFailed, setDefaultGoalFailed] = useState(false);
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

  // A profile with no goals at all gets one starter goal, once.
  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (
      !uid ||
      !user.live ||
      !user.data ||
      savingsGoals.length > 0 ||
      creatingDefaultGoal.current
    ) {
      return;
    }
    creatingDefaultGoal.current = true;
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
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    };
    updateDoc(doc(getFirestore(), 'users', uid), {
      savingsGoals: [defaultGoal],
    }).catch(error => {
      reportError(error as Error);
      creatingDefaultGoal.current = false;
      setDefaultGoalFailed(true);
    });
  }, [user.live, user.data, savingsGoals.length]);

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
      snackbar.error('Please fill in all required fields');
      return false;
    }
    if (values.name.trim().length > 50) {
      snackbar.error('Goal name must be 50 characters or less');
      return false;
    }
    if (values.description.trim().length > 200) {
      snackbar.error('Description must be 200 characters or less');
      return false;
    }
    if (isNaN(current) || isNaN(target) || isNaN(monthly)) {
      snackbar.error('Please enter valid numbers');
      return false;
    }
    if (current < 0 || target < 0 || monthly < 0) {
      snackbar.error('Values cannot be negative');
      return false;
    }
    if (current > 999999999 || target > 999999999 || monthly > 999999999) {
      snackbar.error('Values are too large. Please enter smaller amounts.');
      return false;
    }
    if (current > target) {
      snackbar.error('Current amount cannot exceed target amount');
      return false;
    }
    if (values.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(values.targetDate)) {
      snackbar.error('Target date must be in YYYY-MM-DD format');
      return false;
    }
    if (values.targetDate) {
      const date = new Date(values.targetDate);
      if (isNaN(date.getTime()) || date <= new Date()) {
        snackbar.error('Target date must be a valid future date');
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
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        snackbar.error('User not authenticated. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      const userDocRef = doc(getFirestore(), 'users', currentUser.uid);
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
            updatedAt: Timestamp.fromDate(new Date()),
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
            addDoc(collection(userDocRef, 'savingsHistory'), {
              goalId: editingGoalId,
              goalName: editValues.name || oldGoal.name,
              type: 'update',
              previousGoal: oldGoal,
              newGoal,
              createdAt: Timestamp.fromDate(new Date()),
            });
          }

          return newGoal;
        }
        return goal;
      });

      await updateDoc(userDocRef, {savingsGoals: updatedGoals});
      setIsEditing(false);
      setEditingGoalId(null);
      snackbar.success('Savings goal updated successfully');
    } catch (error: any) {
      reportError(error as Error);
      snackbar.error(`Failed to update savings goal: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addToSavings = async (amount: string) => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      snackbar.error('Please enter a valid amount');
      return;
    }
    if (parsed > 999999999) {
      snackbar.error('Amount is too large. Please enter a smaller amount.');
      return;
    }
    if (!selectedGoalId) {
      snackbar.error('Please select a savings goal first');
      return;
    }
    setIsSubmitting(true);
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        snackbar.error('User not authenticated. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      const userDocRef = doc(getFirestore(), 'users', currentUser.uid);
      const updatedGoals = savingsGoals.map(goal => {
        if (goal.id === selectedGoalId) {
          // Exact arithmetic (0.1 + 0.2 is 0.3); the deposit is rounded to the minor unit.
          const deposit = addMajor(0, parsed, currency.code);
          const newCurrent = addMajor(goal.current, deposit, currency.code);
          const updatedGoal = {
            ...goal,
            current: newCurrent,
            updatedAt: Timestamp.fromDate(new Date()),
          };

          addDoc(collection(userDocRef, 'savingsHistory'), {
            goalId: selectedGoalId,
            goalName: goal.name,
            type: 'deposit',
            amount: deposit,
            previousAmount: goal.current,
            newAmount: newCurrent,
            ...savingsHistoryMoneyFields(
              {
                amount: deposit,
                previousAmount: goal.current,
                newAmount: newCurrent,
              },
              currency.code,
            ),
            createdAt: Timestamp.fromDate(new Date()),
          });

          return updatedGoal;
        }
        return goal;
      });

      await updateDoc(userDocRef, {savingsGoals: updatedGoals});
      AnalyticsService.logAddFundsToGoal({
        amount_range: AnalyticsService.getAmountRange(parsed),
        goal_category:
          savingsGoals.find(g => g.id === selectedGoalId)?.category ?? 'other',
      });
      snackbar.success(
        `${formatCurrencyAmount(parsed)} added to ${
          savingsGoals.find(g => g.id === selectedGoalId)?.name
        }`,
      );
    } catch (error: any) {
      reportError(error as Error);
      snackbar.error(`Failed to add to savings: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const withdrawFromSavings = async (amount: string) => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      snackbar.error('Please enter a valid amount');
      return;
    }
    if (parsed > 999999999) {
      snackbar.error('Amount is too large. Please enter a smaller amount.');
      return;
    }
    if (!selectedGoalId) {
      snackbar.error('Please select a savings goal first');
      return;
    }

    const selectedGoal = savingsGoals.find(g => g.id === selectedGoalId);
    if (!selectedGoal || parsed > selectedGoal.current) {
      snackbar.error('Insufficient savings balance');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        snackbar.error('User not authenticated. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      const userDocRef = doc(getFirestore(), 'users', currentUser.uid);
      const updatedGoals = savingsGoals.map(goal => {
        if (goal.id === selectedGoalId) {
          // Exact arithmetic; the withdrawal is rounded to the minor unit.
          const withdrawal = addMajor(0, parsed, currency.code);
          const newCurrent = subtractMajor(
            goal.current,
            withdrawal,
            currency.code,
          );
          const updatedGoal = {
            ...goal,
            current: newCurrent,
            updatedAt: Timestamp.fromDate(new Date()),
          };

          addDoc(collection(userDocRef, 'savingsHistory'), {
            goalId: selectedGoalId,
            goalName: goal.name,
            type: 'withdrawal',
            amount: withdrawal,
            previousAmount: goal.current,
            newAmount: newCurrent,
            ...savingsHistoryMoneyFields(
              {
                amount: withdrawal,
                previousAmount: goal.current,
                newAmount: newCurrent,
              },
              currency.code,
            ),
            createdAt: Timestamp.fromDate(new Date()),
          });

          return updatedGoal;
        }
        return goal;
      });

      await updateDoc(userDocRef, {savingsGoals: updatedGoals});
      AnalyticsService.logWithdrawFromGoal({
        amount_range: AnalyticsService.getAmountRange(parsed),
      });
      snackbar.success(
        `${formatCurrencyAmount(parsed)} withdrawn from ${selectedGoal.name}`,
      );
    } catch (error: any) {
      reportError(error as Error);
      snackbar.error(`Failed to withdraw from savings: ${error.message}`);
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
      return colors.success;
    }
    if (progress >= 25) {
      return colors.warning;
    }
    return colors.expense;
  };

  const getCategoryIcon = (category: string): McIconName => {
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
      snackbar.error('Please enter a valid amount');
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
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        snackbar.error('User not authenticated. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      const userDocRef = doc(getFirestore(), 'users', currentUser.uid);
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
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      };

      const updatedGoals = [...savingsGoals, newGoal];
      await updateDoc(userDocRef, {savingsGoals: updatedGoals});

      await addDoc(collection(userDocRef, 'savingsHistory'), {
        goalId: newGoal.id,
        goalName: newGoal.name,
        type: 'create',
        newGoal,
        createdAt: Timestamp.fromDate(new Date()),
      });

      setShowCreateModal(false);
      setEditValues(EMPTY_EDIT_VALUES);
      AnalyticsService.logCreateSavingsGoal({
        category: editValues.category || 'other',
        has_target_date: !!editValues.targetDate,
        has_monthly_target: parseFloat(editValues.monthly) > 0,
      });
      snackbar.success('Savings goal created successfully');
    } catch (error: any) {
      reportError(error as Error);
      snackbar.error(`Failed to create savings goal: ${error.message}`);
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
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        snackbar.error('User not authenticated. Please log in again.');
        setIsSubmitting(false);
        return;
      }

      const userDocRef = doc(getFirestore(), 'users', currentUser.uid);
      const deletedGoal = savingsGoals.find(g => g.id === goalId);
      const updatedGoals = savingsGoals.filter(g => g.id !== goalId);

      await updateDoc(userDocRef, {savingsGoals: updatedGoals});

      await addDoc(collection(userDocRef, 'savingsHistory'), {
        goalId,
        goalName: deletedGoal?.name,
        type: 'delete',
        deletedGoal,
        createdAt: Timestamp.fromDate(new Date()),
      });

      setShowDeleteModal(false);
      setGoalToDelete(null);
      AnalyticsService.logDeleteSavingsGoal();
      snackbar.success('Savings goal deleted successfully');
    } catch (error: any) {
      reportError(error as Error);
      snackbar.error(`Failed to delete savings goal: ${error.message}`);
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
      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        return;
      }
      const userDocRef = doc(getFirestore(), 'users', currentUser.uid);
      const updatedGoals = savingsGoals.map(goal =>
        goal.id === goalId
          ? {...goal, reminderEnabled: enabled, reminderFrequency: frequency}
          : goal,
      );
      await updateDoc(userDocRef, {savingsGoals: updatedGoals});

      if (enabled) {
        const goal = updatedGoals.find(g => g.id === goalId);
        if (goal) {
          await ReminderNotificationService.sendSavingsGoalReminder(
            goal,
            currentUser.uid,
          );
        }
        snackbar.success(
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

  // Summed as integer minor units so the totals are exact.
  const totalSaved = sumValuesMajor(
    savingsGoals.map(g => g.current),
    currency.code,
  );
  const totalTarget = sumValuesMajor(
    savingsGoals.map(g => g.target),
    currency.code,
  );
  const overallProgress =
    totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;

  const renderCategoryButton = () => {
    const cat = GOAL_CATEGORIES.find(c => c.id === editValues.category);
    return cat ? (
      <>
        <MaterialCommunityIcons
          name={cat.icon}
          size={20}
          color={colors.primary}
        />
        <Text style={styles.categorySelectorText}>{cat.label}</Text>
      </>
    ) : (
      <Text style={styles.categorySelectorPlaceholder}>Select category</Text>
    );
  };

  // A failed load must not show an empty goals list: the client rewrites the whole goals array on
  // every change, so adding a goal on top of "no goals" could overwrite real ones.
  if (user.failed || defaultGoalFailed || (user.live && !user.data)) {
    return (
      <ErrorState
        title="Could not load your savings"
        onRetry={() => {
          setDefaultGoalFailed(false);
          user.retry();
        }}
      />
    );
  }

  // Not confirmed by the live listener yet, or the starter goal is being created.
  if (!user.live || savingsGoals.length === 0) {
    return <LoadingState message="Loading savings..." />;
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
                  color={colors.success}
                />
                <Text style={styles.headerTitle}>Savings Goals</Text>
              </View>
              <TouchableOpacity
                style={styles.historyIconButton}
                onPress={() => router.navigate('/savings/history')}>
                <MaterialCommunityIcons
                  name="history"
                  size={20}
                  color={colors.onPrimary}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSubtitle}>
              Track and manage multiple savings goals
            </Text>
            <TouchableOpacity
              style={styles.addGoalButton}
              onPress={() => setShowCreateModal(true)}>
              <MaterialCommunityIcons
                name="plus"
                size={20}
                color={colors.onPrimary}
              />
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
                          color={colors.primary}
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
                              goal.reminderEnabled
                                ? colors.primary
                                : colors.textPlaceholder
                            }
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleEdit(goal.id)}
                          style={styles.actionIcon}>
                          <MaterialCommunityIcons
                            name="pencil"
                            size={20}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => confirmDelete(goal.id)}
                          style={styles.actionIcon}>
                          <MaterialCommunityIcons
                            name="delete"
                            size={20}
                            color={colors.expense}
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
                            placeholderTextColor={colors.textPlaceholder}
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
                            placeholderTextColor={colors.textPlaceholder}
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
                              color={colors.textPlaceholder}
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
                            placeholderTextColor={colors.textPlaceholder}
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
                            placeholderTextColor={colors.textPlaceholder}
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
                              color={colors.primary}
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
                              color={colors.textPlaceholder}
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
                            placeholderTextColor={colors.textPlaceholder}
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
                              <ActivityIndicator
                                size="small"
                                color={colors.onPrimary}
                              />
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
                                  ? colors.expense
                                  : colors.primary
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
                              Goal achieved!
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
                              color={colors.onPrimary}
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
                              color={colors.onPrimary}
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
                  color={colors.iconMuted}
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
        <KeyboardAvoidingModal
          visible={showInputModal}
          transparent
          animationType="slide"
          onRequestClose={handleAmountCancel}
          overlayStyle={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {inputType === 'add' ? 'Add to Savings' : 'Withdraw from Savings'}
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
              placeholderTextColor={colors.textPlaceholder}
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
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>
                    {inputType === 'add' ? 'Add' : 'Withdraw'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingModal>

        {/* Create Goal Modal */}
        <KeyboardAvoidingModal
          visible={showCreateModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowCreateModal(false);
            resetEditValues();
          }}
          overlayStyle={styles.modalOverlay}>
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
                  placeholderTextColor={colors.textPlaceholder}
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
                  placeholderTextColor={colors.textPlaceholder}
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
                    color={colors.textPlaceholder}
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
                  placeholderTextColor={colors.textPlaceholder}
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
                  placeholderTextColor={colors.textPlaceholder}
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
                    color={colors.primary}
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
                    color={colors.textPlaceholder}
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
                  placeholderTextColor={colors.textPlaceholder}
                />
              </View>
            </ScrollView>
            <View style={[styles.modalButtons, styles.modalButtonsSpaced]}>
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
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>Create Goal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingModal>

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
                color={colors.expense}
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
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <ModalSnackbar />
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
                color={colors.primary}
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
                  color={colors.primary}
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
                  color={colors.textPlaceholder}
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
                  color={colors.primary}
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
                  color={colors.textPlaceholder}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCancelButton, styles.reminderCancelButton]}
                onPress={() => setShowReminderModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ModalSnackbar />
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
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={colors.textSecondary}
                  />
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
                        color={isSelected ? colors.onPrimary : colors.primary}
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
          <ModalSnackbar />
        </Modal>
      </View>
    </SafeAreaProvider>
  );
};

export default SavingsScreen;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    scrollView: {flex: 1},
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
      backgroundColor: colors.primaryFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primary,
      fontFamily: 'Kufam-SemiBoldItalic',
      marginLeft: 12,
    },
    headerSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      fontFamily: 'Lato-Regular',
    },
    addGoalButton: {
      backgroundColor: colors.primaryFill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 25,
      marginTop: 15,
    },
    addGoalButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
      fontFamily: 'Lato-Bold',
    },
    summaryCard: {
      backgroundColor: colors.primaryFill,
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
      color: colors.onPrimary,
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
      color: colors.onPrimary,
      fontFamily: 'Lato-Bold',
    },
    summaryGoalCount: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.7)',
      marginTop: 8,
      fontFamily: 'Lato-Regular',
    },
    savingsCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      marginHorizontal: 20,
      marginBottom: 20,
    },
    cardContent: {padding: 25},
    savingsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
    },
    goalCategoryIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    goalInfo: {flex: 1},
    goalName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textStrong,
      fontFamily: 'Lato-Bold',
    },
    goalDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      fontFamily: 'Lato-Regular',
    },
    goalHeaderActions: {flexDirection: 'row', alignItems: 'center'},
    actionIcon: {padding: 6, marginLeft: 2},
    savingsAmount: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.success,
      marginBottom: 8,
      fontFamily: 'Kufam-SemiBoldItalic',
    },
    targetDateBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      alignSelf: 'flex-start',
      marginBottom: 12,
      gap: 4,
    },
    targetDateBadgeOverdue: {backgroundColor: colors.expenseSoft},
    targetDateText: {
      fontSize: 12,
      color: colors.primary,
      fontFamily: 'Lato-Regular',
      marginLeft: 4,
    },
    targetDateTextOverdue: {color: colors.expense},
    savingsInfo: {marginTop: 4, marginBottom: 4},
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    infoLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontFamily: 'Lato-Regular',
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textStrong,
      fontFamily: 'Lato-Bold',
    },
    progressSection: {marginTop: 15, marginBottom: 15},
    progressTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textStrong,
      marginBottom: 10,
      fontFamily: 'Lato-Bold',
    },
    progressBar: {
      height: 12,
      backgroundColor: colors.divider,
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
      color: colors.textSecondary,
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
    addButton: {backgroundColor: colors.primaryFill},
    withdrawButton: {backgroundColor: colors.expenseFill},
    goalActionText: {
      color: colors.onPrimary,
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
      color: colors.textStrong,
      marginBottom: 8,
      fontFamily: 'Lato-Bold',
    },
    textInput: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
    },
    dateInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 15,
      paddingVertical: 12,
    },
    inputIcon: {marginRight: 10},
    dateText: {
      flex: 1,
      fontSize: 16,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
    },
    placeholderText: {color: colors.textPlaceholder},
    characterCount: {
      fontSize: 12,
      color: colors.textPlaceholder,
      marginTop: 4,
      textAlign: 'right',
      fontFamily: 'Lato-Regular',
    },
    categorySelectorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 15,
      paddingVertical: 12,
      gap: 10,
    },
    categorySelectorText: {
      flex: 1,
      fontSize: 16,
      color: colors.textStrong,
      fontFamily: 'Lato-Regular',
    },
    categorySelectorPlaceholder: {
      flex: 1,
      fontSize: 16,
      color: colors.textPlaceholder,
      fontFamily: 'Lato-Regular',
    },
    categoryModalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    categoryModalSheet: {
      backgroundColor: colors.surface,
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
      color: colors.textStrong,
      fontFamily: 'Lato-Bold',
    },
    categoryGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
    categoryChip: {
      width: '30%',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    categoryChipSelected: {
      backgroundColor: colors.primaryFill,
      borderColor: colors.primaryFill,
    },
    categoryChipText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 5,
      fontFamily: 'Lato-Regular',
      textAlign: 'center',
    },
    categoryChipTextSelected: {
      color: colors.onPrimary,
      fontFamily: 'Lato-Bold',
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
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    saveButton: {backgroundColor: colors.primaryFill},
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
      fontFamily: 'Lato-Bold',
    },
    saveButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      fontFamily: 'Lato-Bold',
    },
    emptyStateCard: {
      backgroundColor: colors.surface,
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
      color: colors.textStrong,
      marginTop: 20,
      marginBottom: 10,
      textAlign: 'center',
      fontFamily: 'Lato-Bold',
    },
    emptyStateSubtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 30,
      lineHeight: 22,
      fontFamily: 'Lato-Regular',
    },
    createFirstGoalButton: {
      backgroundColor: colors.primaryFill,
      paddingVertical: 15,
      paddingHorizontal: 30,
      borderRadius: 25,
    },
    createFirstGoalButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      fontFamily: 'Lato-Bold',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 25,
      width: '100%',
      maxWidth: 400,
      maxHeight: '85%',
      elevation: Platform.OS === 'android' ? 0 : 10,
      shadowColor: colors.shadow,
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.25,
      shadowRadius: 8,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textStrong,
      textAlign: 'center',
      marginBottom: 10,
      fontFamily: 'Lato-Bold',
    },
    modalSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
      fontFamily: 'Lato-Regular',
    },
    modalInput: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.textStrong,
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
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    modalSubmitButton: {backgroundColor: colors.primaryFill},
    modalCancelButtonText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
      fontFamily: 'Lato-Bold',
    },
    modalSubmitButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      fontFamily: 'Lato-Bold',
    },
    deleteButton: {backgroundColor: colors.expenseFill},
    deleteButtonText: {
      color: colors.onPrimary,
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
      borderBottomColor: colors.divider,
    },
    reminderOptionText: {flex: 1, marginLeft: 14},
    reminderOptionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textStrong,
      fontFamily: 'Lato-Bold',
    },
    reminderOptionSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
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
    modalButtonsSpaced: {marginTop: 10},
    cardAndroid: {borderWidth: 1, borderColor: colors.cardBorder},
  });
