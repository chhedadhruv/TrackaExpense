import {View, Text} from 'react-native';
import React, {useState, useEffect, useRef} from 'react';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {prefillFromParams} from '../src/utils/smsImport';
import {ActivityIndicator} from 'react-native';
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
import {getConfig} from '../src/services/RemoteConfigService';
import {
  discardUploadedReceipt,
  requestScan,
  uploadReceipt,
  type UploadedReceipt,
} from '../src/services/ReceiptScanService';
import {applyGuess, scanErrorMessage} from '../src/utils/receiptScan';
import {requestPushPermissionAfterFirstExpense} from '../src/services/PushService';
import * as PerformanceService from '../src/services/PerformanceService';
import * as AnalyticsService from '../src/services/AnalyticsService';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from '../src/components/KeyboardAwareScrollView';
import FormButton from '../components/FormButton';
import {useAsyncAction} from '../src/hooks/useAsyncAction';
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
import CardField from '../src/components/form/CardField';
import {useCards} from '../src/hooks/useCards';
import ScanNote from '../src/components/form/ScanNote';
import {useKnownTags, useRecordTags} from '../src/hooks/useKnownTags';
import {snackbar} from '../src/utils/snackbarStore';
import AlignLeft from 'lucide-react-native/icons/align-left';
import BanknoteArrowDown from 'lucide-react-native/icons/banknote-arrow-down';
import FileText from 'lucide-react-native/icons/file-text';

const DISABLED_BUTTON = {opacity: 0.5} as const;

const AddExpense = () => {
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
  } = useTransactionForm(prefillFromParams(params));
  const knownTags = useKnownTags();
  const recordTags = useRecordTags();

  // "Paid with" (behind the Remote Config flag). It always starts on Cash / UPI; a card is picked
  // on purpose and a card purchase does not change the balance until the bill is paid.
  const [cardsEnabled] = useState(() => getConfig().enable_cards);
  const cards = useCards().data;
  const [cardId, setCardId] = useState<string | null>(null);
  const pickableCards = (cards ?? []).filter(c => !c.archived);
  // A bank message matched to a card pre-selects it, once, when the cards have loaded. The
  // person can still change it, and a card that no longer exists is ignored.
  const prefillCardId = prefillFromParams(params).cardId;
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (
      prefillApplied.current ||
      !cardsEnabled ||
      !prefillCardId ||
      cards === undefined
    ) {
      return;
    }
    prefillApplied.current = true;
    if (cards.some(c => c.id === prefillCardId && !c.archived)) {
      setCardId(prefillCardId);
    }
  }, [cards, cardsEnabled, prefillCardId]);

  const [uploading, setUploading] = useState(false);
  const [transferred, setTransferred] = useState(0);
  const [imagePickerVisible, setImagePickerVisible] = useState(false);

  // Receipt scanning (behind the Remote Config flag). A scan uploads the photo to the person's
  // own receipt folder; if it is still the receipt when the expense is saved, that upload is
  // reused. A scan only fills the form: the person checks it and taps Add Expense.
  const [scanEnabled] = useState(() => getConfig().enable_receipt_scan);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<UploadedReceipt | null>(null);
  const [scanNote, setScanNote] = useState<{
    filled: string[];
    alternatives: string[];
  } | null>(null);
  const scannedRef = useRef<UploadedReceipt | null>(null);
  const savedRef = useRef(false);

  const rememberScan = (value: UploadedReceipt | null) => {
    scannedRef.current = value;
    setScanned(value);
  };

  // A photo uploaded only for a scan is removed again if the person leaves without saving.
  useEffect(
    () => () => {
      const leftover = scannedRef.current;
      if (leftover && !savedRef.current) {
        discardUploadedReceipt(leftover).catch(() => undefined);
      }
    },
    [],
  );

  const changeImage = (next: string | null) => {
    if (scanned && scanned.localUri !== next) {
      discardUploadedReceipt(scanned).catch(() => undefined);
      rememberScan(null);
    }
    setScanNote(null);
    setImage(next);
  };

  const handleScan = async () => {
    if (!image || scanning) {
      return;
    }
    setScanning(true);
    try {
      let uploaded = scanned && scanned.localUri === image ? scanned : null;
      if (!uploaded) {
        uploaded = await uploadReceipt(image);
        rememberScan(uploaded);
      }
      const fill = applyGuess(
        await requestScan(uploaded.storagePath, currency.code),
        {title, amount, date},
      );
      if (fill.title !== undefined) {
        setTitle(fill.title);
      }
      if (fill.amount !== undefined) {
        setAmount(fill.amount);
      }
      if (fill.date !== undefined) {
        setDate(fill.date);
      }
      setScanNote({filled: fill.filled, alternatives: fill.alternatives});
    } catch (scanError) {
      const code = String((scanError as {code?: unknown})?.code ?? '');
      if (!/resource-exhausted|failed-precondition/.test(code)) {
        reportError(scanError);
      }
      snackbar.error(scanErrorMessage(scanError));
    } finally {
      setScanning(false);
    }
  };

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
    if (scanned && scanned.localUri === image) {
      // Already uploaded for the scan.
      return scanned.downloadUrl;
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

  const saveExpense = async () => {
    if (!validateForm('expense')) {
      return;
    }
    try {
      let imageUrl: string | null = null;
      if (image) {
        // The full-screen progress view is only for the photo upload; the button shows the rest.
        setUploading(true);
        try {
          imageUrl = await uploadImageAsync();
        } finally {
          setUploading(false);
        }
      }
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
          // Only written for a card purchase; cash and UPI documents stay as they always were.
          ...(cardId !== null ? {cardId} : {}),
          createdAt: Timestamp.fromDate(new Date()),
          type: 'expense',
        };
        const expenseDocRef = await addDoc(transactionRef, expenseData);
        transaction.update(expenseDocRef, {documentId: expenseDocRef.id});
        const balanceDelta = balanceEffect(
          'expense',
          {amount, cardId},
          currency.code,
        );
        if (balanceDelta !== 0) {
          transaction.update(userDocRef, {
            balance: increment(balanceDelta),
          });
        }
      });
      AnalyticsService.logAddExpense({
        amount_range: AnalyticsService.getAmountRange(parseFloat(amount)),
        category: category ?? 'uncategorized',
        has_image: !!image,
        has_description: description.trim().length > 0,
      });
      // The suggestion list is a convenience: record the tags without holding up the screen.
      recordTags(tags, knownTags).catch(reportError);
      // Deferred notification prompt: asked once, right after a saved expense.
      requestPushPermissionAfterFirstExpense();
      savedRef.current = true;
      snackbar.success('Expense added');
      router.back();
    } catch (e) {
      reportError(e as Error);
      setErrorMessage(
        'An error occurred while adding the expense. Please try again.',
      );
    }
  };
  const {run: handleSubmit, pending: isSubmitting} =
    useAsyncAction(saveExpense);

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

            {cardsEnabled && pickableCards.length > 0 ? (
              <CardField
                cards={pickableCards}
                value={cardId}
                onChange={setCardId}
                disabled={isSubmitting}
              />
            ) : null}

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
              onRemove={() => changeImage(null)}
              onScan={scanEnabled ? handleScan : undefined}
              scanning={scanning}
            />
            {scanNote ? (
              <ScanNote
                filled={scanNote.filled}
                alternatives={scanNote.alternatives}
                onPickAmount={setAmount}
              />
            ) : null}

            <View className="mt-5">
              <FormButton
                buttonTitle="Add Expense"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={!isFormValid()}
                style={!isFormValid() ? DISABLED_BUTTON : undefined}
              />
            </View>
          </FormCard>
        </KeyboardAwareScrollView>

        <ImagePickerModal
          visible={imagePickerVisible}
          onDismiss={() => setImagePickerVisible(false)}
          onImageSelected={uri => changeImage(uri)}
        />
      </View>
    </SafeAreaProvider>
  );
};

export default AddExpense;
