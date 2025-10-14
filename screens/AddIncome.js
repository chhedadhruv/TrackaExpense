import {View, StyleSheet, TextInput, Text, TouchableOpacity, Platform} from 'react-native';
import React, {useState, useEffect} from 'react';
import {Card, ActivityIndicator} from 'react-native-paper';
import DropDownPicker from 'react-native-dropdown-picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {DatePickerModal} from 'react-native-paper-dates';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FormButton from '../components/FormButton';
import {useCurrency} from '../utils/CurrencyUtil';
const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const SUCCESS_COLOR = '#25B07F';
const AddIncome = ({navigation}) => {
  const {currency, formatAmount} = useCurrency();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(null);
  const [items, setItems] = useState([
    {label: 'Salary', value: 'Salary', icon: 'currency-usd'},
    {label: 'Bonus', value: 'Bonus', icon: 'gift'},
    {label: 'Gift', value: 'Gift', icon: 'gift'},
    {label: 'Others', value: 'Others', icon: 'dots-horizontal'},
  ]);
  const [openDate, setOpenDate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const onDismissSingle = () => {
    setOpenDate(false);
  };
  const onConfirmSingle = params => {
    setOpenDate(false);
    const formattedDate = `${params.date.getFullYear()}-${String(
      params.date.getMonth() + 1
    ).padStart(2, '0')}-${String(params.date.getDate()).padStart(2, '0')}`;
    setDate(formattedDate);
  };
  const getUser = () => {
    const user = auth().currentUser;
    return user.uid;
  };
  useEffect(() => {
    getUser();
  }, []);
  const validateForm = () => {
    setErrorMessage(null);
    if (!title.trim()) {
      setErrorMessage('Please enter a title for your income');
      return false;
    }
    if (!amount.trim()) {
      setErrorMessage('Please enter an amount');
      return false;
    }
    if (isNaN(amount) || parseFloat(amount) <= 0) {
      setErrorMessage('Please enter a valid amount');
      return false;
    }
    if (!category) {
      setErrorMessage('Please select a category');
      return false;
    }
    if (!date) {
      setErrorMessage('Please select a date');
      return false;
    }
    return true;
  };
  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    setIsSubmitting(true);
    try {
      const userDocRef = firestore().collection('users').doc(getUser());
      await firestore().runTransaction(async transaction => {
        const userDoc = await transaction.get(userDocRef);
        const userData = userDoc.data();
        const transactionRef = userDocRef.collection('transactions');
        const incomeData = {
          userId: getUser(),
          title: title.trim(),
          description: description.trim(),
          amount: amount,
          category: category,
          date: date,
          createdAt: firestore.Timestamp.fromDate(new Date()),
          type: 'income',
        };
        const incomeDocRef = await transactionRef.add(incomeData);
        incomeData.documentId = incomeDocRef.id;
        transaction.update(incomeDocRef, {documentId: incomeDocRef.id});
      });
      setAmount('');
      setTitle('');
      setDescription('');
      setCategory('');
      setValue(null);
      setDate(undefined);
      setSuccessMessage('Income added successfully!');
      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } catch (error) {
      setErrorMessage('An error occurred while adding the income. Please try again.');
    } finally {
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };
  const isFormValid = () => {
    return (
      title.trim() !== '' &&
      amount.trim() !== '' &&
      category !== '' &&
      date !== undefined &&
      !isSubmitting
    );
  };
  const formatDisplayDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Adding your income...</Text>
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
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="cash-plus" size={32} color={SUCCESS_COLOR} />
              <Text style={styles.headerTitle}>Add Income</Text>
            </View>
            <Text style={styles.headerSubtitle}>Record your income to track your finances</Text>
          </View>
          {/* Form Card */}
          <Card style={styles.formCard} elevation={4}>
            <View style={styles.cardContent}>
              {errorMessage && (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color="#C62828" />
                  <Text style={styles.errorMessage}>{errorMessage}</Text>
                </View>
              )}
              {successMessage && (
                <View style={styles.successContainer}>
                  <MaterialCommunityIcons name="check-circle" size={20} color={SUCCESS_COLOR} />
                  <Text style={styles.successMessage}>{successMessage}</Text>
                </View>
              )}
              {/* Title Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Title</Text>
                <View style={styles.inputWrapper}>
                  <MaterialCommunityIcons name="text" size={20} color={PRIMARY_COLOR} style={styles.inputIcon} />
                  <TextInput
                    placeholder="Enter income title"
                    placeholderTextColor="#999"
                    autoCorrect={false}
                    value={title}
                    onChangeText={setTitle}
                    style={styles.textInput}
                    editable={!isSubmitting}
                  />
                </View>
              </View>
              {/* Description Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description <Text style={styles.optionalText}>(Optional)</Text></Text>
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
                  />
                </View>
              </View>
              {/* Category Dropdown */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.dropdownContainer}>
                  <DropDownPicker
                    open={open}
                    value={value}
                    items={items.map(cat => ({
                      ...cat,
                      icon: () => (
                        <MaterialCommunityIcons
                          name={cat.icon}
                          size={20}
                          color={PRIMARY_COLOR}
                        />
                      ),
                    }))}
                    setOpen={setOpen}
                    setValue={setValue}
                    setItems={setItems}
                    placeholder="Select income category"
                    style={styles.dropdown}
                    dropDownContainerStyle={styles.dropdownContainer}
                    searchable={true}
                    searchPlaceholder="Search categories..."
                    listMode="MODAL"
                    modalTitle="Select Income Category"
                    modalAnimationType="slide"
                    onChangeValue={setCategory}
                    disabled={isSubmitting}
                  />
                </View>
              </View>
                {/* Amount Input */}
                <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Amount ({currency.symbol})</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                  <TextInput
                    placeholder="Enter amount"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    autoCorrect={false}
                    value={amount}
                    onChangeText={setAmount}
                    style={styles.textInput}
                    editable={!isSubmitting}
                  />
                </View>
                </View>
              {/* Date Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Date</Text>
                <TouchableOpacity
                  style={styles.dateInputWrapper}
                  onPress={() => !isSubmitting && setOpenDate(true)}
                  disabled={isSubmitting}>
                  <MaterialCommunityIcons name="calendar" size={20} color={PRIMARY_COLOR} style={styles.inputIcon} />
                  <Text style={[styles.dateText, !date && styles.placeholderText]}>
                    {date ? formatDisplayDate(date) : 'Select date'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={20} color="#999" />
                </TouchableOpacity>
              </View>
              <DatePickerModal
                locale="en"
                mode="single"
                visible={openDate}
                onDismiss={onDismissSingle}
                date={date ? new Date(date) : new Date()}
                onConfirm={onConfirmSingle}
                saveLabel="Confirm"
                label="Select date"
                uppercase={false}
                {...(Platform.OS === 'ios' && { presentationStyle: 'pageSheet' })}
              />
              {/* Submit Button */}
              <View style={styles.buttonContainer}>
                {isSubmitting ? (
                  <View style={styles.submittingContainer}>
                    <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                    <Text style={styles.submittingText}>Adding Income...</Text>
                  </View>
                ) : (
                  <FormButton 
                    buttonTitle="Add Income" 
                    onPress={handleSubmit} 
                    disabled={!isFormValid()}
                    style={[
                      styles.submitButton,
                      !isFormValid() && styles.disabledButton
                    ]}
                  />
                )}
              </View>
            </View>
          </Card>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaProvider>
  );
};
export default AddIncome;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollView: {
    flex: 1,
  },
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
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
  cardContent: {
    padding: 30,
  },
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
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: SUCCESS_COLOR,
  },
  successMessage: {
    color: SUCCESS_COLOR,
    fontSize: 14,
    fontFamily: 'Lato-Regular',
    marginLeft: 10,
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
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
  inputIcon: {
    marginRight: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    marginRight: 12,
    fontFamily: 'Lato-Bold',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
    textAlignVertical: 'top',
  },
  dropdownContainer: {
    zIndex: 1000,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  dropdown: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
  },
  dropdownPlaceholder: {
    color: '#999',
    fontSize: 16,
    fontFamily: 'Lato-Regular',
  },
  dropdownText: {
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#2C2C2C',
    fontFamily: 'Lato-Regular',
    marginLeft: 12,
  },
  placeholderText: {
    color: '#999',
  },
  buttonContainer: {
    marginTop: 20,
  },
  submitButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  disabledButton: {
    opacity: 0.5,
  },
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
