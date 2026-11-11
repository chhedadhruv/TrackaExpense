import React, {useState, type ReactNode} from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Text,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  deleteDoc,
  doc,
  getFirestore,
  increment,
  updateDoc,
} from '@react-native-firebase/firestore';
import {
  deleteObject,
  getStorage,
  ref as createStorageRef,
} from '@react-native-firebase/storage';
import {reportError} from '../src/services/ErrorReporter';
import {receiptUrlOf} from '../src/utils/receipt';
import * as AnalyticsService from '../src/services/AnalyticsService';
import {useCurrency} from '../utils/CurrencyUtil';
import {balanceEffect, majorOf} from '../src/utils/amounts';
import {useTheme} from '../src/theme';
import TagChips from '../src/components/TagChips';
import {sanitizeTags} from '../src/utils/tags';
import type {McIconName} from '../src/types/icons';
import {snackbar} from '../src/utils/snackbarStore';

const DetailRow = ({
  icon,
  label,
  children,
}: {
  icon: McIconName;
  label: string;
  children: ReactNode;
}) => {
  const {colors} = useTheme();
  return (
    <View className="mb-5 flex-row items-start">
      <View className="mr-[15px] h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
        <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="mb-1.5 font-sans text-sm font-medium text-text-secondary">
          {label}
        </Text>
        {children}
      </View>
    </View>
  );
};

const TransactionDetailScreen = ({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) => {
  const {colors} = useTheme();
  const {currency, formatAmount} = useCurrency();
  const {transaction} = route.params;
  // Receipts are stored as imageUrl or the older image field; accept either.
  const receiptUrl = receiptUrlOf(transaction);
  const tagList = sanitizeTags(transaction.tags);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onImagePress = () => {
    if (receiptUrl) {
      navigation.navigate('Image', {imageUrl: receiptUrl});
    }
  };

  const handleEdit = () => {
    navigation.navigate('EditTransaction', {transaction});
  };

  const deleteTransaction = async () => {
    setLoading(true);
    setError('');
    const {userId, id, type} = transaction;
    // Deleting reverses what the transaction did to the balance.
    const balanceIncrement = -balanceEffect(type, transaction, currency.code);
    try {
      await deleteDoc(doc(getFirestore(), 'users', userId, 'transactions', id));
      await updateDoc(doc(getFirestore(), 'users', userId), {
        balance: increment(balanceIncrement),
      });
      if (receiptUrl) {
        const imageRef = createStorageRef(getStorage(), receiptUrl);
        await deleteObject(imageRef);
      }
      AnalyticsService.logDeleteTransaction({
        type: transaction.type,
        category: transaction.category,
      });
      snackbar.success('Transaction deleted successfully!');
      navigation.goBack();
    } catch (e) {
      reportError(e as Error);
      setError('An error occurred while deleting the transaction.');
      snackbar.error('An error occurred while deleting the transaction.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete', onPress: deleteTransaction},
      ],
      {cancelable: false},
    );
  };

  const isIncome = transaction.type === 'income';
  const accentColor = isIncome ? colors.income : colors.expense;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-[15px] font-sans text-base text-primary">
          Deleting transaction...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-divider bg-surface px-5 py-[25px]">
        <View className="flex-row items-center">
          <View className="mr-5 h-[60px] w-[60px] items-center justify-center rounded-[20px] bg-surface-muted">
            <MaterialCommunityIcons
              name={isIncome ? 'trending-up' : 'trending-down'}
              size={24}
              color={accentColor}
            />
          </View>
          <View className="flex-1">
            <Text className="mb-1.5 font-heading text-xl font-bold text-text-strong">
              {transaction.title}
            </Text>
            <Text
              className={`font-sans-bold text-[28px] font-bold ${
                isIncome ? 'text-income' : 'text-expense'
              }`}>
              {isIncome ? '+ ' : '- '}
              {formatAmount(majorOf(transaction, currency.code))}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="m-5 rounded-2xl border border-card-border bg-surface ios:shadow-md">
          <View className="p-[25px]">
            <Text
              accessibilityRole="header"
              className="mb-5 font-sans-bold text-lg font-bold text-text-strong">
              Transaction Details
            </Text>

            <DetailRow icon="calendar" label="Date">
              <Text className="font-sans-bold text-base font-semibold text-text-strong">
                {transaction.date}
              </Text>
            </DetailRow>

            <DetailRow icon="tag" label="Category">
              <Text className="font-sans-bold text-base font-semibold text-text-strong">
                {transaction.category}
              </Text>
            </DetailRow>

            {tagList.length > 0 ? (
              <DetailRow icon="tag-multiple" label="Tags">
                <TagChips tags={tagList} />
              </DetailRow>
            ) : null}

            <DetailRow
              icon={isIncome ? 'plus-circle' : 'minus-circle'}
              label="Type">
              <View
                className={`self-start rounded-lg px-3 py-1.5 ${
                  isIncome ? 'bg-income-soft' : 'bg-expense-soft'
                }`}>
                <Text
                  className={`font-sans-bold text-sm font-semibold ${
                    isIncome ? 'text-income-text' : 'text-expense-text'
                  }`}>
                  {transaction.type.charAt(0).toUpperCase() +
                    transaction.type.slice(1)}
                </Text>
              </View>
            </DetailRow>

            {transaction.description ? (
              <DetailRow icon="text" label="Description">
                <Text className="font-sans-bold text-base font-semibold text-text-strong">
                  {transaction.description}
                </Text>
              </DetailRow>
            ) : null}
          </View>
        </View>

        {receiptUrl ? (
          <View className="mx-5 mb-5 rounded-2xl border border-card-border bg-surface ios:shadow-md">
            <TouchableOpacity
              onPress={onImagePress}
              accessibilityRole="button"
              accessibilityLabel="View receipt image full size"
              className="flex-row items-center p-5">
              <View className="mr-[15px]">
                <Image
                  source={{uri: receiptUrl}}
                  className="h-[60px] w-[60px] rounded-xl"
                />
              </View>
              <View className="flex-1">
                <Text className="mb-1 font-sans-bold text-base font-semibold text-text-strong">
                  Receipt Image
                </Text>
                <Text className="font-sans text-sm text-text-secondary">
                  Tap to view full size
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        ) : null}

        <View className="gap-[15px] px-5 pb-[30px]">
          <TouchableOpacity
            className="flex-row items-center justify-center rounded-xl bg-primary-fill py-4 ios:shadow-md"
            accessibilityRole="button"
            onPress={handleEdit}>
            <MaterialCommunityIcons
              name="pencil"
              size={20}
              color={colors.onPrimary}
            />
            <Text className="ml-2 font-sans-bold text-base font-semibold text-on-primary">
              Edit Transaction
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center justify-center rounded-xl bg-expense-fill py-4 ios:shadow-md"
            accessibilityRole="button"
            onPress={handleDelete}>
            <MaterialCommunityIcons
              name="delete"
              size={20}
              color={colors.onPrimary}
            />
            <Text className="ml-2 font-sans-bold text-base font-semibold text-on-primary">
              Delete Transaction
            </Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View
            accessibilityRole="alert"
            className="mx-5 mb-5 flex-row items-center rounded-xl border-l-4 border-expense bg-expense-soft p-[15px]">
            <MaterialCommunityIcons
              name="alert-circle"
              size={20}
              color={colors.expenseText}
            />
            <Text className="ml-2.5 flex-1 font-sans text-sm text-expense-text">
              {error}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default TransactionDetailScreen;
