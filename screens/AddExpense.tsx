import {View, StyleSheet, TextInput, Image, Text, TouchableOpacity, Platform} from 'react-native';
import React, {useState, useEffect, useRef} from 'react';
import {Card, ActivityIndicator} from 'react-native-paper';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import crashlytics from '@react-native-firebase/crashlytics';
import * as PerformanceService from '../src/services/PerformanceService';
import * as AnalyticsService from '../src/services/AnalyticsService';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FormButton from '../components/FormButton';
import {useCurrency} from '../utils/CurrencyUtil';
import {EXPENSE_CATEGORIES, EXPENSE_KEYWORD_MAP} from '../utils/CategoryData';
import {PRIMARY_COLOR, BACKGROUND_COLOR, EXPENSE_COLOR} from '../src/constants/theme';
import {useTransactionForm} from '../src/hooks/useTransactionForm';
import CategorySelector from '../src/components/CategorySelector';
import AmountInput from '../src/components/AmountInput';
import DateInput from '../src/components/DateInput';
import ImagePickerModal from '../src/components/ImagePickerModal';

const AddExpense = ({navigation}: {navigation: any}) => {
  const {currency} = useCurrency();
  const {
    title, description, amount, category, date, image,
    setTitle, setDescription, setAmount, setCategory, setDate, setImage,
    errorMessage, setErrorMessage, isFormValid, validateForm,
  } = useTransactionForm();

  const [uploading, setUploading] = useState(false);
  const [transferred, setTransferred] = useState(0);
  const [imagePickerVisible, setImagePickerVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
  }, []);

  // Auto-suggest category from title keywords
  useEffect(() => {
    if (title.trim().length < 3 || category) return;
    const lower = title.toLowerCase();
    const match = Object.keys(EXPENSE_KEYWORD_MAP).find(kw => lower.includes(kw));
    if (match) setCategory(EXPENSE_KEYWORD_MAP[match]);
  }, [title]);

  const getUid = (): string => auth().currentUser!.uid;

  const uploadImageAsync = async (): Promise<string | null> => {
    if (!image) return null;
    const uploadUri = image;
    let filename = uploadUri.substring(uploadUri.lastIndexOf('/') + 1);
    const extension = filename.split('.').pop();
    const name = filename.split('.').slice(0, -1).join('.');
    filename = name + Date.now() + '.' + extension;
    setTransferred(0);
    const storageRef = storage().ref(`bills/${getUid()}/${filename}`);
    const task = storageRef.putFile(uploadUri);
    task.on('state_changed', snapshot => {
      setTransferred(Math.round(snapshot.bytesTransferred / snapshot.totalBytes) * 100);
    });
    try {
      const stopTrace = await PerformanceService.traceUploadReceipt();
      await task;
      await stopTrace?.();
      return await storageRef.getDownloadURL();
    } catch (e) {
      crashlytics().recordError(e as Error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm('expense')) return;
    setUploading(true);
    setIsSubmitting(true);
    try {
      const imageUrl = image ? await uploadImageAsync() : null;
      const uid = getUid();
      const userDocRef = firestore().collection('users').doc(uid);
      await firestore().runTransaction(async transaction => {
        const transactionRef = userDocRef.collection('transactions');
        const expenseData = {
          userId: uid,
          title: title.trim(),
          description: description.trim(),
          amount,
          category,
          date,
          image: imageUrl,
          createdAt: firestore.Timestamp.fromDate(new Date()),
          type: 'expense',
        };
        const expenseDocRef = await transactionRef.add(expenseData);
        transaction.update(expenseDocRef, {documentId: expenseDocRef.id});
        transaction.update(userDocRef, {
          balance: firestore.FieldValue.increment(-parseFloat(amount)),
        });
      });
      AnalyticsService.logAddExpense({
        amount_range: AnalyticsService.getAmountRange(parseFloat(amount)),
        category: category ?? 'uncategorized',
        has_image: !!image,
        has_description: description.trim().length > 0,
      });
      setSuccessMessage('Expense added successfully!');
      navTimeoutRef.current = setTimeout(() => navigation.goBack(), 1500);
    } catch (e) {
      crashlytics().recordError(e as Error);
      setErrorMessage('An error occurred while adding the expense. Please try again.');
    } finally {
      setUploading(false);
      setIsSubmitting(false);
    }
  };

  if (uploading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>
          {transferred > 0 ? `Uploading image... ${transferred}%` : 'Adding your expense...'}
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
              <MaterialCommunityIcons name="cash-minus" size={32} color={EXPENSE_COLOR} />
              <Text style={styles.headerTitle}>Add Expense</Text>
            </View>
            <Text style={styles.headerSubtitle}>Record your expenses to track your spending</Text>
          </View>

          <Card
            style={[styles.formCard, Platform.OS === 'android' && styles.cardAndroid]}
            elevation={Platform.OS === 'android' ? 0 : 4}>
            <View style={styles.cardContent}>
              {errorMessage && (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color="#C62828" />
                  <Text style={styles.errorMessage}>{errorMessage}</Text>
                </View>
              )}
              {successMessage && (
                <View style={styles.successContainer}>
                  <MaterialCommunityIcons name="check-circle" size={20} color={EXPENSE_COLOR} />
                  <Text style={styles.successMessage}>{successMessage}</Text>
                </View>
              )}

              {/* Title */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Title</Text>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons name="text" size={20} color={PRIMARY_COLOR} style={styles.inputIcon} />
                  <TextInput
                    placeholder="Enter expense title"
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
                  Description <Text style={styles.optionalText}>(Optional)</Text>
                </Text>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons name="text-box" size={20} color={PRIMARY_COLOR} style={styles.inputIcon} />
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
                <Text style={styles.characterCount}>{description.length}/500</Text>
              </View>

              {/* Category */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Category</Text>
                <CategorySelector
                  categories={EXPENSE_CATEGORIES}
                  selectedCategory={category}
                  onSelect={setCategory}
                  disabled={isSubmitting}
                  placeholder="Select expense category"
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

              {/* Image */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Receipt/Image <Text style={styles.optionalText}>(Optional)</Text>
                </Text>
                {image ? (
                  <View style={styles.imageContainer}>
                    <Image source={{uri: image}} style={styles.imagePreview} />
                    <View style={styles.imageActions}>
                      <TouchableOpacity
                        style={styles.imageActionButton}
                        onPress={() => !isSubmitting && setImagePickerVisible(true)}
                        disabled={isSubmitting}>
                        <MaterialCommunityIcons name="camera-switch" size={20} color={PRIMARY_COLOR} />
                        <Text style={styles.imageActionText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.imageActionButton, styles.removeButton]}
                        onPress={() => setImage(null)}
                        disabled={isSubmitting}>
                        <MaterialCommunityIcons name="delete" size={20} color={EXPENSE_COLOR} />
                        <Text style={[styles.imageActionText, styles.removeText]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.imageUploadButton}
                    onPress={() => !isSubmitting && setImagePickerVisible(true)}
                    disabled={isSubmitting}>
                    <MaterialCommunityIcons name="camera-plus" size={32} color={PRIMARY_COLOR} />
                    <Text style={styles.imageUploadText}>Add Receipt Image</Text>
                    <Text style={styles.imageUploadSubtext}>Tap to take photo or choose from gallery</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Submit */}
              <View style={styles.buttonContainer}>
                {isSubmitting ? (
                  <View style={styles.submittingContainer}>
                    <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                    <Text style={styles.submittingText}>Adding Expense...</Text>
                  </View>
                ) : (
                  <FormButton
                    buttonTitle="Add Expense"
                    onPress={handleSubmit}
                    disabled={!isFormValid()}
                    style={[styles.submitButton, !isFormValid() && styles.disabledButton]}
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

export default AddExpense;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: BACKGROUND_COLOR},
  scrollView: {flex: 1},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BACKGROUND_COLOR},
  loadingText: {fontSize: 16, color: PRIMARY_COLOR, marginTop: 15, fontFamily: 'Lato-Regular'},
  headerSection: {alignItems: 'center', paddingHorizontal: 20, paddingTop: 30, paddingBottom: 20},
  headerTitleRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  headerTitle: {fontSize: 28, fontWeight: 'bold', color: PRIMARY_COLOR, fontFamily: 'Kufam-SemiBoldItalic', marginLeft: 12},
  headerSubtitle: {fontSize: 16, color: '#666', textAlign: 'center', fontFamily: 'Lato-Regular'},
  formCard: {backgroundColor: '#FFFFFF', borderRadius: 20, marginHorizontal: 20, marginBottom: 40},
  cardAndroid: {borderWidth: 1, borderColor: '#E8EBF7'},
  cardContent: {padding: 30},
  errorContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE',
    borderRadius: 12, padding: 15, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#F44336',
  },
  errorMessage: {color: '#C62828', fontSize: 14, fontFamily: 'Lato-Regular', marginLeft: 10, flex: 1},
  successContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0',
    borderRadius: 12, padding: 15, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: EXPENSE_COLOR,
  },
  successMessage: {color: EXPENSE_COLOR, fontSize: 14, fontFamily: 'Lato-Regular', marginLeft: 10, flex: 1},
  inputContainer: {marginBottom: 20},
  inputLabel: {fontSize: 16, fontWeight: '600', color: '#2C2C2C', marginBottom: 8, fontFamily: 'Lato-Bold'},
  optionalText: {fontSize: 14, fontWeight: '400', color: '#999', fontFamily: 'Lato-Regular'},
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA',
    borderRadius: 12, borderWidth: 1, borderColor: '#E8EBF7', paddingHorizontal: 15, paddingVertical: 10,
  },
  inputIcon: {marginRight: 12},
  textInput: {flex: 1, fontSize: 16, color: '#2C2C2C', fontFamily: 'Lato-Regular', textAlignVertical: 'top'},
  characterCount: {fontSize: 12, color: '#999', marginTop: 4, textAlign: 'right', fontFamily: 'Lato-Regular'},
  imageContainer: {backgroundColor: '#F8F9FA', borderRadius: 12, borderWidth: 1, borderColor: '#E8EBF7', padding: 15},
  imagePreview: {width: '100%', height: 200, borderRadius: 8, marginBottom: 15},
  imageActions: {flexDirection: 'row', justifyContent: 'space-between'},
  imageActionButton: {
    flexDirection: 'row', alignItems: 'center', flex: 0.48, paddingVertical: 12,
    paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1,
    borderColor: PRIMARY_COLOR, justifyContent: 'center',
  },
  removeButton: {borderColor: EXPENSE_COLOR},
  imageActionText: {marginLeft: 8, fontSize: 14, fontWeight: '600', color: PRIMARY_COLOR, fontFamily: 'Lato-Bold'},
  removeText: {color: EXPENSE_COLOR},
  imageUploadButton: {
    backgroundColor: '#F8F9FA', borderRadius: 12, borderWidth: 2,
    borderColor: '#E8EBF7', borderStyle: 'dashed', paddingVertical: 40,
    paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center',
  },
  imageUploadText: {fontSize: 16, fontWeight: '600', color: PRIMARY_COLOR, marginTop: 12, fontFamily: 'Lato-Bold'},
  imageUploadSubtext: {fontSize: 14, color: '#666', marginTop: 4, textAlign: 'center', fontFamily: 'Lato-Regular'},
  buttonContainer: {marginTop: 20},
  submitButton: {backgroundColor: PRIMARY_COLOR},
  disabledButton: {opacity: 0.5},
  submittingContainer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15},
  submittingText: {fontSize: 16, color: PRIMARY_COLOR, marginLeft: 10, fontFamily: 'Lato-Regular'},
});
