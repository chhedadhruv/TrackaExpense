import {View, Text} from 'react-native';
import React, {useState, useEffect} from 'react';
import {useRouter} from 'expo-router';
import {ActivityIndicator} from 'react-native-paper';
import {getAuth} from '@react-native-firebase/auth';
import {
  Timestamp,
  addDoc,
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
import {receiptFields} from '../src/utils/receipt';
import {requestPushPermissionAfterFirstExpense} from '../src/services/PushService';
import * as PerformanceService from '../src/services/PerformanceService';
import * as AnalyticsService from '../src/services/AnalyticsService';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import FormButton from '../components/FormButton';
import {useCurrency} from '../utils/CurrencyUtil';
import {EXPENSE_CATEGORIES, EXPENSE_KEYWORD_MAP} from '../utils/CategoryData';
import {useTheme} from '../src/theme';
import {useTransactionForm} from '../src/hooks/useTransactionForm';
import {balanceEffect, transactionMoneyFields} from '../src/utils/amounts';
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
import {useKnownTags} from '../src/hooks/useKnownTags';
import {recordTagUse} from '../src/services/TagService';
import {snackbar} from '../src/utils/snackbarStore';
import AlignLeft from 'lucide-react-native/icons/align-left';
import BanknoteArrowDown from 'lucide-react-native/icons/banknote-arrow-down';
import FileText from 'lucide-react-native/icons/file-text';

const DISABLED_BUTTON = {opacity: 0.5} as const;

const AddExpense = () => {
  const router = useRouter();
  const {colors} = useTheme();
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
  } = useTransactionForm();
  const knownTags = useKnownTags();

  const [uploading, setUploading] = useState(false);
  const [transferred, setTransferred] = useState(0);
  const [imagePickerVisible, setImagePickerVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-suggest category from title keywords
  useEffect(() => {
    if (title.trim().length < 3 || category) {
      return;
    }
    const lower = title.toLowerCase();
    const match = Object.keys(EXPENSE_KEYWORD_MAP).find(kw =>
      lower.includes(kw),
    );
    if (match) {
      setCategory(EXPENSE_KEYWORD_MAP[match]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  const getUid = (): string => getAuth().currentUser!.uid;

  const uploadImageAsync = async (): Promise<string | null> => {
    if (!image) {
      return null;
    }
    const uploadUri = image;
    let filename = uploadUri.substring(uploadUri.lastIndexOf('/') + 1);
    const extension = filename.split('.').pop();
    const name = filename.split('.').slice(0, -1).join('.');
    filename = name + Date.now() + '.' + extension;
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
    if (!validateForm('expense')) {
      return;
    }
    setUploading(true);
    setIsSubmitting(true);
    try {
      const imageUrl = image ? await uploadImageAsync() : null;
      const uid = getUid();
      const userDocRef = doc(getFirestore(), 'users', uid);
      await runTransaction(getFirestore(), async transaction => {
        const transactionRef = collection(userDocRef, 'transactions');
        const expenseData = {
          userId: uid,
          title: title.trim(),
          description: description.trim(),
          amount,
          ...transactionMoneyFields(amount, currency.code),
          category,
          date,
          // Both fields: other screens read imageUrl, older apps and data use image.
          ...receiptFields(imageUrl),
          // Only written when there are tags; documents without the field are valid.
          ...(tags.length > 0 ? {tags} : {}),
          createdAt: Timestamp.fromDate(new Date()),
          type: 'expense',
        };
        const expenseDocRef = await addDoc(transactionRef, expenseData);
        transaction.update(expenseDocRef, {documentId: expenseDocRef.id});
        const balanceDelta = balanceEffect('expense', {amount}, currency.code);
        transaction.update(userDocRef, {
          balance: increment(balanceDelta),
        });
      });
      AnalyticsService.logAddExpense({
        amount_range: AnalyticsService.getAmountRange(parseFloat(amount)),
        category: category ?? 'uncategorized',
        has_image: !!image,
        has_description: description.trim().length > 0,
      });
      // The suggestion list is a convenience: record the tags without holding up the screen.
      recordTagUse(uid, tags, knownTags).catch(reportError);
      // Deferred notification prompt: asked once, right after a saved expense.
      requestPushPermissionAfterFirstExpense();
      snackbar.success('Expense added');
      router.back();
    } catch (e) {
      reportError(e as Error);
      setErrorMessage(
        'An error occurred while adding the expense. Please try again.',
      );
    } finally {
      setUploading(false);
      setIsSubmitting(false);
    }
  };

  if (uploading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-[15px] font-sans text-base text-primary">
          {transferred > 0
            ? `Uploading image... ${transferred}%`
            : 'Adding your expense...'}
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
            icon={BanknoteArrowDown}
            iconColor={colors.expense}
            title="Add Expense"
            subtitle="Record your expenses to track your spending"
          />

          <FormCard>
            {errorMessage && <FormError message={errorMessage} />}

            <TextField
              label="Title"
              icon={AlignLeft}
              placeholder="Enter expense title"
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
                categories={EXPENSE_CATEGORIES}
                selectedCategory={category}
                onSelect={setCategory}
                disabled={isSubmitting}
                placeholder="Select expense category"
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

            <ReceiptField
              image={image}
              disabled={isSubmitting}
              onPick={() => setImagePickerVisible(true)}
              onRemove={() => setImage(null)}
            />

            <View className="mt-5">
              {isSubmitting ? (
                <View className="flex-row items-center justify-center py-[15px]">
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text className="ml-2.5 font-sans text-base text-primary">
                    Adding Expense...
                  </Text>
                </View>
              ) : (
                <FormButton
                  buttonTitle="Add Expense"
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

export default AddExpense;
