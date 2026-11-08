import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {Card, ActivityIndicator} from 'react-native-paper';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  putFile,
  ref as createStorageRef,
} from '@react-native-firebase/storage';
import {reportError} from '../src/services/ErrorReporter';
import * as PerformanceService from '../src/services/PerformanceService';
import * as AnalyticsService from '../src/services/AnalyticsService';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import FormButton from '../components/FormButton';
import {useCurrency} from '../utils/CurrencyUtil';
import {EXPENSE_CATEGORIES, INCOME_CATEGORIES} from '../utils/CategoryData';
import {
  PRIMARY_COLOR,
  BACKGROUND_COLOR,
  EXPENSE_COLOR,
  INCOME_COLOR,
} from '../src/constants/theme';
import {useTransactionForm} from '../src/hooks/useTransactionForm';
import CategorySelector from '../src/components/CategorySelector';
import AmountInput from '../src/components/AmountInput';
import DateInput from '../src/components/DateInput';
import ImagePickerModal from '../src/components/ImagePickerModal';

const EditTransactionScreen = ({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) => {
  const {currency} = useCurrency();
  const {transaction} = route.params;

  const {
    title,
    description,
    amount,
    category,
    date,
    image,
    setTitle,
    setDescription,
    setAmount,
    setCategory,
    setDate,
    setImage,
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
    image: transaction.imageUrl ?? null,
  });

  const [uploading, setUploading] = useState(false);
  const [transferred, setTransferred] = useState(0);
  const [imagePickerVisible, setImagePickerVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
      }
    },
    [],
  );

  const getUid = (): string => auth().currentUser!.uid;

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
      const userDocRef = firestore().collection('users').doc(uid);
      const transactionRef = userDocRef
        .collection('transactions')
        .doc(transaction.id);

      await firestore().runTransaction(async txn => {
        const snap = await txn.get(transactionRef);
        const existing = snap.data();

        const updatePayload: Record<string, any> = {
          title: title.trim(),
          description: description.trim(),
          amount: parseFloat(amount),
          category,
          date,
          createdAt: firestore.Timestamp.fromDate(new Date()),
        };
        if (existing?.type === 'expense') {
          updatePayload.imageUrl = imageUrl;
        }

        txn.update(transactionRef, updatePayload);

        const oldAmount = parseFloat(existing?.amount);
        const newAmount = parseFloat(amount);
        const delta =
          existing?.type === 'expense'
            ? oldAmount - newAmount
            : newAmount - oldAmount;
        if (delta !== 0) {
          txn.update(userDocRef, {
            balance: firestore.FieldValue.increment(delta),
          });
        }
      });

      AnalyticsService.logEditTransaction({
        type: transaction.type,
        category: category ?? 'uncategorized',
        amount_changed:
          parseFloat(amount) !== parseFloat(transaction.amount.toString()),
      });
      setSuccessMessage('Transaction updated successfully!');
      navTimeoutRef.current = setTimeout(
        () => navigation.navigate('Home'),
        1500,
      );
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
    transaction.type === 'expense' ? EXPENSE_COLOR : INCOME_COLOR;

  if (uploading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>
          {transferred > 0
            ? `Uploading image... ${transferred}%`
            : 'Updating transaction...'}
        </Text>
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
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons
                name={
                  transaction.type === 'expense' ? 'cash-minus' : 'cash-plus'
                }
                size={32}
                color={accentColor}
              />
              <Text style={styles.headerTitle}>Edit Transaction</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {transaction.type === 'expense'
                ? 'Update your expense details'
                : 'Update your income details'}
            </Text>
          </View>

          <Card
            style={[
              styles.formCard,
              Platform.OS === 'android' && styles.cardAndroid,
            ]}
            elevation={Platform.OS === 'android' ? 0 : 4}>
            <View style={styles.cardContent}>
              {errorMessage && (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={20}
                    color="#C62828"
                  />
                  <Text style={styles.errorMessage}>{errorMessage}</Text>
                </View>
              )}
              {successMessage && (
                <View style={styles.successContainer}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={20}
                    color={accentColor}
                  />
                  <Text style={styles.successMessage}>{successMessage}</Text>
                </View>
              )}

              {/* Title */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Title</Text>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons
                    name="text"
                    size={20}
                    color={PRIMARY_COLOR}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder={`Enter ${transaction.type} title`}
                    placeholderTextColor="#999"
                    autoCorrect={false}
                    value={title}
                    onChangeText={setTitle}
                    style={styles.textInput}
                    editable={!isSubmitting}
                    maxLength={100}
                  />
                </View>
                <Text style={styles.characterCount}>{title.length}/100</Text>
              </View>

              {/* Description */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Description{' '}
                  <Text style={styles.optionalText}>(Optional)</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons
                    name="text-box"
                    size={20}
                    color={PRIMARY_COLOR}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Enter description"
                    placeholderTextColor="#999"
                    autoCorrect={false}
                    value={description}
                    onChangeText={setDescription}
                    style={styles.textInput}
                    multiline
                    numberOfLines={2}
                    editable={!isSubmitting}
                    maxLength={500}
                  />
                </View>
                <Text style={styles.characterCount}>
                  {description.length}/500
                </Text>
              </View>

              {/* Category */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Category</Text>
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
              </View>

              {/* Amount */}
              <View style={styles.inputContainer}>
                <AmountInput
                  value={amount}
                  onChangeText={setAmount}
                  currencySymbol={currency.symbol}
                  disabled={isSubmitting}
                  label={`Amount (${currency.symbol})`}
                />
              </View>

              {/* Date */}
              <View style={styles.inputContainer}>
                <DateInput
                  date={date}
                  onConfirm={setDate}
                  disabled={isSubmitting}
                  label="Date"
                />
              </View>

              {/* Image — only for expenses */}
              {transaction.type === 'expense' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>
                    Receipt/Image{' '}
                    <Text style={styles.optionalText}>(Optional)</Text>
                  </Text>
                  {image ? (
                    <View style={styles.imageContainer}>
                      <Image
                        source={{uri: image}}
                        style={styles.imagePreview}
                      />
                      <View style={styles.imageActions}>
                        <TouchableOpacity
                          style={styles.imageActionButton}
                          onPress={() =>
                            !isSubmitting && setImagePickerVisible(true)
                          }
                          disabled={isSubmitting}>
                          <MaterialCommunityIcons
                            name="camera-switch"
                            size={20}
                            color={PRIMARY_COLOR}
                          />
                          <Text style={styles.imageActionText}>Change</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.imageActionButton,
                            styles.removeButton,
                          ]}
                          onPress={() => setImage(null)}
                          disabled={isSubmitting}>
                          <MaterialCommunityIcons
                            name="delete"
                            size={20}
                            color={EXPENSE_COLOR}
                          />
                          <Text
                            style={[styles.imageActionText, styles.removeText]}>
                            Remove
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.imageUploadButton}
                      onPress={() =>
                        !isSubmitting && setImagePickerVisible(true)
                      }
                      disabled={isSubmitting}>
                      <MaterialCommunityIcons
                        name="camera-plus"
                        size={32}
                        color={PRIMARY_COLOR}
                      />
                      <Text style={styles.imageUploadText}>
                        Add Receipt Image
                      </Text>
                      <Text style={styles.imageUploadSubtext}>
                        Tap to take photo or choose from gallery
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Submit */}
              <View style={styles.buttonContainer}>
                {isSubmitting ? (
                  <View style={styles.submittingContainer}>
                    <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                    <Text style={styles.submittingText}>
                      Updating Transaction...
                    </Text>
                  </View>
                ) : (
                  <FormButton
                    buttonTitle="Update Transaction"
                    onPress={handleSubmit}
                    disabled={!isFormValid()}
                    style={[
                      styles.submitButton,
                      !isFormValid() && styles.disabledButton,
                    ]}
                  />
                )}
              </View>
            </View>
          </Card>
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
  headerTitleRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
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
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 40,
  },
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
  cardContent: {padding: 30},
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorMessage: {
    color: '#C62828',
    fontSize: 14,
    fontFamily: 'Lato-Regular',
    marginLeft: 10,
    flex: 1,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: EXPENSE_COLOR,
  },
  successMessage: {
    fontSize: 14,
    fontFamily: 'Lato-Regular',
    marginLeft: 10,
    flex: 1,
    color: '#333',
  },
  inputContainer: {marginBottom: 20},
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2C',
    marginBottom: 8,
    fontFamily: 'Lato-Bold',
  },
  optionalText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999',
    fontFamily: 'Lato-Regular',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  inputIcon: {marginRight: 12},
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
    fontFamily: 'Lato-Regular',
  },
  imageContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    padding: 15,
  },
  imagePreview: {width: '100%', height: 200, borderRadius: 8, marginBottom: 15},
  imageActions: {flexDirection: 'row', justifyContent: 'space-between'},
  imageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    justifyContent: 'center',
  },
  removeButton: {borderColor: EXPENSE_COLOR},
  imageActionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    fontFamily: 'Lato-Bold',
  },
  removeText: {color: EXPENSE_COLOR},
  imageUploadButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8EBF7',
    borderStyle: 'dashed',
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageUploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginTop: 12,
    fontFamily: 'Lato-Bold',
  },
  imageUploadSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
  buttonContainer: {marginTop: 20},
  submitButton: {backgroundColor: PRIMARY_COLOR},
  disabledButton: {opacity: 0.5},
  submittingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  submittingText: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    marginLeft: 10,
    fontFamily: 'Lato-Regular',
  },
});
