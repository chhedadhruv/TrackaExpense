import React, {useState} from 'react';
import {View, Text} from 'react-native';
import {ActivityIndicator} from 'react-native-paper';
import {getAuth} from '@react-native-firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getFirestore,
  increment,
  runTransaction,
} from '@react-native-firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  putFile,
  ref as createStorageRef,
} from '@react-native-firebase/storage';
import {reportError} from '../src/services/ErrorReporter';
import {receiptFields, receiptUrlOf} from '../src/utils/receipt';
import * as PerformanceService from '../src/services/PerformanceService';
import * as AnalyticsService from '../src/services/AnalyticsService';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import FormButton from '../components/FormButton';
import {useCurrency} from '../utils/CurrencyUtil';
import {EXPENSE_CATEGORIES, INCOME_CATEGORIES} from '../utils/CategoryData';
import {useTheme} from '../src/theme';
import {useTransactionForm} from '../src/hooks/useTransactionForm';
import {editBalanceDelta, transactionMoneyFields} from '../src/utils/amounts';
import CategorySelector from '../src/components/CategorySelector';
import AmountInput from '../src/components/AmountInput';
import DateInput from '../src/components/DateInput';
import ImagePickerModal from '../src/components/ImagePickerModal';
import {
  FormCard,
  FormError,
  FormHeader,
  FormSection,
} from '../src/components/form/FormParts';
import TextField from '../src/components/form/TextField';
import ReceiptField from '../src/components/form/ReceiptField';
import TagField from '../src/components/form/TagField';
import {useKnownTags, useRecordTags} from '../src/hooks/useKnownTags';
import {sanitizeTags} from '../src/utils/tags';
import {snackbar} from '../src/utils/snackbarStore';
import AlignLeft from 'lucide-react-native/icons/align-left';
import BanknoteArrowDown from 'lucide-react-native/icons/banknote-arrow-down';
import BanknoteArrowUp from 'lucide-react-native/icons/banknote-arrow-up';
import FileText from 'lucide-react-native/icons/file-text';
import {useRouter} from 'expo-router';
import type {TransactionDocument} from '../src/types';

const DISABLED_BUTTON = {opacity: 0.5} as const;

interface EditTransactionScreenProps {
  transaction: TransactionDocument & {id: string};
  /** "" in the Home tab and "/statistic" in the Statistic tab (see TransactionDetailScreen). */
  basePath: string;
}

const EditTransactionScreen = ({
  transaction,
  basePath,
}: EditTransactionScreenProps) => {
  const {colors} = useTheme();
  const router = useRouter();
  const {currency} = useCurrency();

  const {
    title,
    description,
    amount,
    category,
    date,
    image,
    tags,
    setTitle,
    setDescription,
    setAmount,
    setCategory,
    setDate,
    setImage,
    setTags,
    errorMessage,
    setErrorMessage,
    isFormValid,
    validateForm,
  } = useTransactionForm({
    title: transaction.title,
    description: transaction.description ?? '',
    amount: transaction.amount.toString(),
    category: transaction.category,
    date: transaction.date,
    image: receiptUrlOf(transaction),
    tags: sanitizeTags(transaction.tags),
  });
  const knownTags = useKnownTags();
  const recordTags = useRecordTags();

  const [uploading, setUploading] = useState(false);
  const [transferred, setTransferred] = useState(0);
  const [imagePickerVisible, setImagePickerVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getUid = (): string => getAuth().currentUser!.uid;

  const uploadImageAsync = async (): Promise<string | null> => {
    if (!image) {
      return null;
    }
    const uploadUri = image;
    let filename = uploadUri.substring(uploadUri.lastIndexOf('/') + 1);
    const extension = filename.split('.').pop();
    const name = filename.split('.').slice(0, -1).join('.');
    filename = `${name}${Date.now()}.${extension}`;
    setTransferred(0);
    const storageRef = createStorageRef(
      getStorage(),
      `bills/${getUid()}/${filename}`,
    );
    const task = putFile(storageRef, uploadUri);
    task.on('state_changed', snapshot => {
      setTransferred(
        Math.round(snapshot.bytesTransferred / snapshot.totalBytes) * 100,
      );
    });
    try {
      const stopTrace = await PerformanceService.traceUploadReceipt();
      await task;
      await stopTrace?.();
      return await getDownloadURL(storageRef);
    } catch (e) {
      reportError(e as Error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm(transaction.type)) {
      return;
    }
    setIsSubmitting(true);

    const isLocalFile = image && !image.startsWith('http');
    if (isLocalFile) {
      setUploading(true);
    }

    try {
      const imageUrl = isLocalFile ? await uploadImageAsync() : image ?? null;
      const uid = getUid();
      const userDocRef = doc(getFirestore(), 'users', uid);
      const transactionRef = doc(
        collection(userDocRef, 'transactions'),
        transaction.id,
      );

      await runTransaction(getFirestore(), async txn => {
        const snap = await txn.get(transactionRef);
        const existing = snap.data();

        const updatePayload: Record<string, any> = {
          title: title.trim(),
          description: description.trim(),
          amount: parseFloat(amount),
          ...transactionMoneyFields(amount, currency.code),
          category,
          date,
          // Always written on an edit, so removing every tag clears the field.
          tags,
          createdAt: Timestamp.fromDate(new Date()),
        };
        if (existing?.type === 'expense') {
          // Both fields, so removing the receipt clears the legacy one too.
          Object.assign(updatePayload, receiptFields(imageUrl));
        }

        txn.update(transactionRef, updatePayload);

        const isExpense = existing?.type === 'expense';
        // Exact integer math first; the old float subtraction only if an amount cannot be
        // converted to minor units.
        const delta =
          editBalanceDelta(
            existing ?? {},
            isExpense ? 'expense' : 'income',
            amount,
            currency.code,
          ) ??
          (isExpense
            ? parseFloat(existing?.amount) - parseFloat(amount)
            : parseFloat(amount) - parseFloat(existing?.amount));
        if (delta !== 0) {
          txn.update(userDocRef, {
            balance: increment(delta),
          });
        }
      });

      AnalyticsService.logEditTransaction({
        type: transaction.type,
        category: category ?? 'uncategorized',
        amount_changed:
          parseFloat(amount) !== parseFloat(transaction.amount.toString()),
      });
      // The suggestion list is a convenience: record the tags without holding up the screen.
      recordTags(tags, knownTags).catch(reportError);
      snackbar.success('Transaction updated');
      // Back to the list this edit started from: Home, or the Statistic tab's own page.
      router.navigate(basePath === '' ? '/home' : (basePath as '/statistic'));
    } catch (e) {
      reportError(e as Error);
      setErrorMessage(
        'An error occurred while updating the transaction. Please try again.',
      );
    } finally {
      setUploading(false);
      setIsSubmitting(false);
    }
  };

  const accentColor =
    transaction.type === 'expense' ? colors.expense : colors.income;

  if (uploading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-[15px] font-sans text-base text-primary">
          {transferred > 0
            ? `Uploading image... ${transferred}%`
            : 'Updating transaction...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View className="flex-1 bg-background">
        <KeyboardAwareScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <FormHeader
            icon={
              transaction.type === 'expense'
                ? BanknoteArrowDown
                : BanknoteArrowUp
            }
            iconColor={accentColor}
            title="Edit Transaction"
            subtitle={
              transaction.type === 'expense'
                ? 'Update your expense details'
                : 'Update your income details'
            }
          />

          <FormCard>
            {errorMessage && <FormError message={errorMessage} />}

            <TextField
              label="Title"
              icon={AlignLeft}
              placeholder={`Enter ${transaction.type} title`}
              value={title}
              onChangeText={setTitle}
              disabled={isSubmitting}
              maxLength={100}
            />

            <TextField
              label="Description"
              optional
              icon={FileText}
              placeholder="Enter description"
              value={description}
              onChangeText={setDescription}
              disabled={isSubmitting}
              multiline
              numberOfLines={2}
              maxLength={500}
            />

            <FormSection label="Category">
              <CategorySelector
                categories={
                  transaction.type === 'expense'
                    ? EXPENSE_CATEGORIES
                    : INCOME_CATEGORIES
                }
                selectedCategory={category}
                onSelect={setCategory}
                disabled={isSubmitting}
                placeholder="Select category"
              />
            </FormSection>

            <FormSection>
              <AmountInput
                value={amount}
                onChangeText={setAmount}
                currencySymbol={currency.symbol}
                disabled={isSubmitting}
                label={`Amount (${currency.symbol})`}
              />
            </FormSection>

            <FormSection>
              <DateInput
                date={date}
                onConfirm={setDate}
                disabled={isSubmitting}
                label="Date"
              />
            </FormSection>

            <TagField
              tags={tags}
              onChange={setTags}
              knownTags={knownTags}
              disabled={isSubmitting}
            />

            {/* Receipt: only expenses have one */}
            {transaction.type === 'expense' && (
              <ReceiptField
                image={image}
                disabled={isSubmitting}
                onPick={() => setImagePickerVisible(true)}
                onRemove={() => setImage(null)}
              />
            )}

            <View className="mt-5">
              {isSubmitting ? (
                <View className="flex-row items-center justify-center py-[15px]">
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text className="ml-2.5 font-sans text-base text-primary">
                    Updating Transaction...
                  </Text>
                </View>
              ) : (
                <FormButton
                  buttonTitle="Update Transaction"
                  onPress={handleSubmit}
                  disabled={!isFormValid()}
                  style={!isFormValid() ? DISABLED_BUTTON : undefined}
                />
              )}
            </View>
          </FormCard>
        </KeyboardAwareScrollView>

        <ImagePickerModal
          visible={imagePickerVisible}
          onDismiss={() => setImagePickerVisible(false)}
          onImageSelected={uri => setImage(uri)}
        />
      </View>
    </SafeAreaProvider>
  );
};

export default EditTransactionScreen;
