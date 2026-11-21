import {View} from 'react-native';
import React from 'react';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {prefillFromParams} from '../src/utils/smsImport';
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
import {useAsyncAction} from '../src/hooks/useAsyncAction';
import {useCurrency} from '../utils/CurrencyUtil';
import {INCOME_KEYWORD_MAP} from '../utils/CategoryData';
import {useCategoryLists} from '../src/data/categories';
import {useTheme} from '../src/theme';
import {useTransactionForm} from '../src/hooks/useTransactionForm';
import {
  useCategoryHistory,
  useCategorySuggestion,
} from '../src/hooks/useCategorySuggestion';
import {
  useTitleSuggestions,
  useTransactionTitleIndex,
} from '../src/hooks/useTitleSuggestions';
import TitleSuggestions from '../src/components/form/TitleSuggestions';
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
import {useKnownTags, useRecordTags} from '../src/hooks/useKnownTags';
import {snackbar} from '../src/utils/snackbarStore';
import AlignLeft from 'lucide-react-native/icons/align-left';
import BanknoteArrowUp from 'lucide-react-native/icons/banknote-arrow-up';
import FileText from 'lucide-react-native/icons/file-text';

const DISABLED_BUTTON = {opacity: 0.5} as const;

const AddIncome = () => {
  const router = useRouter();
  // A bank message opens this form with values filled in (see SmsImportScreen); the form still
  // has to be confirmed with the add button.
  const params = useLocalSearchParams();
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
  } = useTransactionForm(prefillFromParams(params));
  const knownTags = useKnownTags();
  const recordTags = useRecordTags();
  const categoryLists = useCategoryLists('income');
  const categoryHistory = useCategoryHistory('income', categoryLists.values);
  const categorySuggestion = useCategorySuggestion({
    title,
    category,
    setCategory,
    allowed: categoryLists.values,
    keywordMap: INCOME_KEYWORD_MAP,
    history: categoryHistory,
  });
  const titleIndex = useTransactionTitleIndex('income', categoryLists.values);
  const titleSuggestions = useTitleSuggestions({
    index: titleIndex,
    title,
    setTitle,
    onCategory: categorySuggestion.applyGuess,
  });

  const getUid = (): string => getAuth().currentUser!.uid;

  const saveIncome = async () => {
    if (!validateForm('income')) {
      return;
    }
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
      recordTags(tags, knownTags).catch(reportError);
      snackbar.success('Income added');
      router.back();
    } catch (e) {
      reportError(e as Error);
      setErrorMessage(
        'An error occurred while adding the income. Please try again.',
      );
    }
  };
  const {run: handleSubmit, pending: isSubmitting} = useAsyncAction(saveIncome);

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
              onFocus={titleSuggestions.onFocus}
              onBlur={titleSuggestions.onBlur}
              disabled={isSubmitting}
              maxLength={100}>
              <TitleSuggestions
                suggestions={titleSuggestions.suggestions}
                onPick={titleSuggestions.pick}
                disabled={isSubmitting}
              />
            </TextField>

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
                categories={categoryLists.categories}
                createType="income"
                selectedCategory={category}
                onSelect={categorySuggestion.pickByHand}
                suggested={categorySuggestion.suggested}
                guessed={categorySuggestion.guessed}
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
              <FormButton
                buttonTitle="Add Income"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={!isFormValid()}
                style={!isFormValid() ? DISABLED_BUTTON : undefined}
              />
            </View>
          </FormCard>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
};

export default AddIncome;
