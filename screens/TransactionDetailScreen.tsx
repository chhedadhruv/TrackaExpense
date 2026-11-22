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
import {
  doc,
  getFirestore,
  increment,
  writeBatch,
} from '@react-native-firebase/firestore';
import {isOnline} from '../src/services/ConnectivityService';
import {settleWrite} from '../src/utils/offlineWrite';
import {
  deleteObject,
  getStorage,
  ref as createStorageRef,
} from '@react-native-firebase/storage';
import {reportError} from '../src/services/ErrorReporter';
import {useAsyncAction} from '../src/hooks/useAsyncAction';
import {receiptUrlOf} from '../src/utils/receipt';
import * as AnalyticsService from '../src/services/AnalyticsService';
import {useCurrency} from '../utils/CurrencyUtil';
import {balanceEffect, majorOf} from '../src/utils/amounts';
import {useTheme} from '../src/theme';
import TagChips from '../src/components/TagChips';
import {sanitizeTags} from '../src/utils/tags';
import AlignLeft from 'lucide-react-native/icons/align-left';
import Calendar from 'lucide-react-native/icons/calendar';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import CircleMinus from 'lucide-react-native/icons/circle-minus';
import CirclePlus from 'lucide-react-native/icons/circle-plus';
import Pencil from 'lucide-react-native/icons/pencil';
import Tag from 'lucide-react-native/icons/tag';
import Tags from 'lucide-react-native/icons/tags';
import Trash2 from 'lucide-react-native/icons/trash-2';
import TrendingDown from 'lucide-react-native/icons/trending-down';
import TrendingUp from 'lucide-react-native/icons/trending-up';
import type {AppIcon} from '../src/types/icons';
import {snackbar} from '../src/utils/snackbarStore';
import {isCardPayment} from '../src/utils/cards';
import {isBalanceAdjustment} from '../src/utils/balanceAdjust';
import {undoBillPayment} from '../src/services/CardService';
import {useRouter} from 'expo-router';
import type {TransactionDocument} from '../src/types';

const DetailRow = ({
  icon: Icon,
  label,
  children,
}: {
  icon: AppIcon;
  label: string;
  children: ReactNode;
}) => {
  const {colors} = useTheme();
  return (
    <View className="mb-5 flex-row items-start">
      <View className="mr-[15px] h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
        <Icon size={20} color={colors.primary} />
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

interface TransactionDetailScreenProps {
  transaction: TransactionDocument & {id: string};
  /**
   * "" in the Home tab and "/statistic" in the Statistic tab: each tab has its own copy of the
   * detail, edit and image routes so the tab bar and the way back stay in that tab.
   */
  basePath: string;
}

const TransactionDetailScreen = ({
  transaction,
  basePath,
}: TransactionDetailScreenProps) => {
  const {colors} = useTheme();
  const router = useRouter();
  const {currency, formatAmount} = useCurrency();
  // Receipts are stored as imageUrl or the older image field; accept either.
  const receiptUrl = receiptUrlOf(transaction);
  const tagList = sanitizeTags(transaction.tags);
  const [error, setError] = useState('');

  const onImagePress = () => {
    if (receiptUrl) {
      router.navigate({
        pathname: `${basePath}/image` as '/image',
        params: {imageUrl: receiptUrl},
      });
    }
  };

  const handleEdit = () => {
    router.navigate(
      `${basePath}/transaction/${transaction.id}/edit` as '/transaction/[id]/edit',
    );
  };

  const removeTransaction = async () => {
    setError('');
    const {userId, id, type} = transaction;
    // Deleting reverses what the transaction did to the balance. A card purchase never moved it
    // (the effect is 0), so only the money the card bill took is given back, and only through
    // undoing the payment, which also frees that period to be paid again.
    const balanceIncrement = -balanceEffect(type, transaction, currency.code);
    const paymentId = (transaction as {cardPaymentId?: unknown}).cardPaymentId;
    try {
      if (isCardPayment(transaction) && typeof paymentId === 'string') {
        // Undoing a bill payment is one server transaction, so it needs a connection.
        if (!isOnline()) {
          snackbar.error(
            'Connect to the internet to undo a card bill payment.',
          );
          return;
        }
        await undoBillPayment(userId, paymentId);
        snackbar.success('Card bill payment undone');
        router.back();
        return;
      }
      // One atomic batch (offline it is queued on the phone and synced later).
      const batch = writeBatch(getFirestore());
      batch.delete(doc(getFirestore(), 'users', userId, 'transactions', id));
      if (balanceIncrement !== 0) {
        batch.update(doc(getFirestore(), 'users', userId), {
          balance: increment(balanceIncrement),
        });
      }
      const {queued} = await settleWrite(
        batch.commit(),
        isOnline(),
        reportError,
      );
      if (receiptUrl) {
        // Removing the photo needs a connection. Offline, or if it fails, the transaction is
        // already deleted, so leaving the photo behind is reported but does not undo the delete.
        const imageRef = createStorageRef(getStorage(), receiptUrl);
        if (queued) {
          deleteObject(imageRef).catch(() => {});
        } else {
          await deleteObject(imageRef);
        }
      }
      AnalyticsService.logDeleteTransaction({
        type: transaction.type,
        category: transaction.category,
      });
      snackbar.success(
        queued
          ? 'Deleted on this phone, it will sync'
          : 'Transaction deleted successfully!',
      );
      router.back();
    } catch (e) {
      reportError(e as Error);
      setError('An error occurred while deleting the transaction.');
      snackbar.error('An error occurred while deleting the transaction.');
    }
  };
  const {run: deleteTransaction, pending: loading} =
    useAsyncAction(removeTransaction);

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete', style: 'destructive', onPress: deleteTransaction},
      ],
      {cancelable: false},
    );
  };

  const isIncome = transaction.type === 'income';
  const accentColor = isIncome ? colors.income : colors.expense;

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-divider bg-surface px-5 py-[25px]">
        <View className="flex-row items-center">
          <View className="mr-5 h-[60px] w-[60px] items-center justify-center rounded-[20px] bg-surface-muted">
            {isIncome ? (
              <TrendingUp size={24} color={accentColor} />
            ) : (
              <TrendingDown size={24} color={accentColor} />
            )}
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

            <DetailRow icon={Calendar} label="Date">
              <Text className="font-sans-bold text-base font-semibold text-text-strong">
                {transaction.date}
              </Text>
            </DetailRow>

            <DetailRow icon={Tag} label="Category">
              <Text className="font-sans-bold text-base font-semibold text-text-strong">
                {transaction.category}
              </Text>
            </DetailRow>

            {tagList.length > 0 ? (
              <DetailRow icon={Tags} label="Tags">
                <TagChips tags={tagList} />
              </DetailRow>
            ) : null}

            <DetailRow icon={isIncome ? CirclePlus : CircleMinus} label="Type">
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
              <DetailRow icon={AlignLeft} label="Description">
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
              <ChevronRight size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View className="gap-[15px] px-5 pb-[30px]">
          {isCardPayment(transaction) ||
          isBalanceAdjustment(transaction) ? null : (
            <TouchableOpacity
              className="flex-row items-center justify-center rounded-xl bg-primary-fill py-4 ios:shadow-md"
              accessibilityRole="button"
              disabled={loading}
              onPress={handleEdit}>
              <Pencil size={20} color={colors.onPrimary} />
              <Text className="ml-2 font-sans-bold text-base font-semibold text-on-primary">
                Edit Transaction
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            className={`flex-row items-center justify-center rounded-xl bg-expense-fill py-4 ios:shadow-md ${
              loading ? 'opacity-70' : ''
            }`}
            accessibilityRole="button"
            accessibilityState={{disabled: loading, busy: loading}}
            disabled={loading}
            onPress={handleDelete}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <>
                <Trash2 size={20} color={colors.onPrimary} />
                <Text className="ml-2 font-sans-bold text-base font-semibold text-on-primary">
                  Delete Transaction
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {error ? (
          <View
            accessibilityRole="alert"
            className="mx-5 mb-5 flex-row items-center rounded-xl border-l-4 border-expense bg-expense-soft p-[15px]">
            <CircleAlert size={20} color={colors.expenseText} />
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
