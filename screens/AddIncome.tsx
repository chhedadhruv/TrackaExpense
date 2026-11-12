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
import {reportError} from '../src/services/ErrorReporter';
import * as AnalyticsService from '../src/services/AnalyticsService';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import FormButton from '../components/FormButton';
import {useCurrency} from '../utils/CurrencyUtil';
import {INCOME_CATEGORIES, INCOME_KEYWORD_MAP} from '../utils/CategoryData';
import {useTheme} from '../src/theme';
import {useTransactionForm} from '../src/hooks/useTransactionForm';
import {balanceEffect, transactionMoneyFields} from '../src/utils/amounts';
import CategorySelector from '../src/components/CategorySelector';
import AmountInput from '../src/components/AmountInput';
import DateInput from '../src/components/DateInput';
import {
  FormCard,
  FormError,
  FormHeader,
  FormSection,
} from '../src/components/form/FormParts';
import TextField from '../src/components/form/TextField';
import TagField from '../src/components/form/TagField';
import {useKnownTags} from '../src/hooks/useKnownTags';
import {recordTagUse} from '../src/services/TagService';
import {snackbar} from '../src/utils/snackbarStore';
import AlignLeft from 'lucide-react-native/icons/align-left';
import BanknoteArrowUp from 'lucide-react-native/icons/banknote-arrow-up';
import FileText from 'lucide-react-native/icons/file-text';

const DISABLED_BUTTON = {opacity: 0.5} as const;

const AddIncome = () => {
  const router = useRouter();
  const {colors} = useTheme();
  const {currency} = useCurrency();
  const {
    title,
    description,
    amount,
    category,
    date,
    tags,
    setTitle,
    setDescription,
    setAmount,
    setCategory,
    setDate,
    setTags,
    errorMessage,
    setErrorMessage,
    isFormValid,
    validateForm,
  } = useTransactionForm();
  const knownTags = useKnownTags();

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (title.trim().length < 3 || category) {
      return;
    }
    const lower = title.toLowerCase();
    const match = Object.keys(INCOME_KEYWORD_MAP).find(kw =>
      lower.includes(kw),
    );
    if (match) {
      setCategory(INCOME_KEYWORD_MAP[match]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  const getUid = (): string => getAuth().currentUser!.uid;

  const handleSubmit = async () => {
    if (!validateForm('income')) {
      return;
    }
    setIsSubmitting(true);
    try {
      const uid = getUid();
      const userDocRef = doc(getFirestore(), 'users', uid);
      await runTransaction(getFirestore(), async transaction => {
        const transactionRef = collection(userDocRef, 'transactions');
        const incomeData = {
          userId: uid,
          title: title.trim(),
          description: description.trim(),
          amount,
          ...transactionMoneyFields(amount, currency.code),
          category,
          date,
          // Only written when there are tags; documents without the field are valid.
          ...(tags.length > 0 ? {tags} : {}),
          createdAt: Timestamp.fromDate(new Date()),
          type: 'income',
        };
        const incomeDocRef = await addDoc(transactionRef, incomeData);
        transaction.update(incomeDocRef, {documentId: incomeDocRef.id});
        const balanceDelta = balanceEffect('income', {amount}, currency.code);
        transaction.update(userDocRef, {
          balance: increment(balanceDelta),
        });
      });
      AnalyticsService.logAddIncome({
        amount_range: AnalyticsService.getAmountRange(parseFloat(amount)),
        category: category ?? 'uncategorized',
      });
      // The suggestion list is a convenience: record the tags without holding up the screen.
      recordTagUse(uid, tags, knownTags).catch(reportError);
      snackbar.success('Income added');
      router.back();
    } catch (e) {
      reportError(e as Error);
      setErrorMessage(
        'An error occurred while adding the income. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-[15px] font-sans text-base text-primary">
          Adding your income...
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
            icon={BanknoteArrowUp}
            iconColor={colors.income}
            title="Add Income"
            subtitle="Record your income to track your finances"
          />

          <FormCard>
            {errorMessage && <FormError message={errorMessage} />}

            <TextField
              label="Title"
              icon={AlignLeft}
              placeholder="Enter income title"
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
                categories={INCOME_CATEGORIES}
                selectedCategory={category}
                onSelect={setCategory}
                disabled={isSubmitting}
                placeholder="Select income category"
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

            <View className="mt-5">
              {isSubmitting ? (
                <View className="flex-row items-center justify-center py-[15px]">
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text className="ml-2.5 font-sans text-base text-primary">
                    Adding Income...
                  </Text>
                </View>
              ) : (
                <FormButton
                  buttonTitle="Add Income"
                  onPress={handleSubmit}
                  disabled={!isFormValid()}
                  style={!isFormValid() ? DISABLED_BUTTON : undefined}
                />
              )}
            </View>
          </FormCard>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
};

export default AddIncome;
