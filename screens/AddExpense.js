import {View, StyleSheet, TextInput, Image, Text, TouchableOpacity} from 'react-native';
import React, {useState, useEffect} from 'react';
import {Card, ActivityIndicator, Modal, Portal, Provider} from 'react-native-paper';
import DropDownPicker from 'react-native-dropdown-picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {DatePickerModal} from 'react-native-paper-dates';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FormButton from '../components/FormButton';

const PRIMARY_COLOR = '#677CD2';
const BACKGROUND_COLOR = '#F4F6FA';
const EXPENSE_COLOR = '#F64E4E';

const AddExpense = ({navigation}) => {
  const [userData, setUserData] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(undefined);
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [transferred, setTransferred] = useState(0);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(null);
  const [items, setItems] = useState([
    {label: 'Bills', value: 'Bills'},
    {label: 'Education', value: 'Education'},
    {label: 'Entertainment', value: 'Entertainment'},
    {label: 'Food', value: 'Food'},
    {label: 'Health', value: 'Health'},
    {label: 'Travel', value: 'Travel'},
    {label: 'Shopping', value: 'Shopping'},
    {label: 'Others', value: 'Others'},
  ]);
  const [modalVisible, setModalVisible] = useState(false);
  const [openDate, setOpenDate] = useState(false);
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

  const toggleModal = () => {
    setModalVisible(!modalVisible);
  };

  const getUser = () => {
    const user = auth().currentUser;
    return user.uid;
  };

  useEffect(() => {
    getUser();
  }, []);

  const fetchUserData = async () => {
    const user = auth().currentUser;
    const documentSnapshot = await firestore()
      .collection('users')
      .doc(user.uid)
      .get();
    setUserData(documentSnapshot.data());
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const validateForm = () => {
    setErrorMessage(null);
    
    if (!title.trim()) {
      setErrorMessage('Please enter a title for your expense');
      return false;
    }
    if (!description.trim()) {
      setErrorMessage('Please enter a description');
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

  const uploadImageAsync = async () => {
    if (image == null) {
      return null;
    }

    const uploadUri = image;
    let filename = uploadUri.substring(uploadUri.lastIndexOf('/') + 1);

    const extension = filename.split('.').pop();
    const name = filename.split('.').slice(0, -1).join('.');
    filename = name + Date.now() + '.' + extension;

    setTransferred(0);

    const storageRef = storage().ref(`bills/${getUser()}/${filename}`);
    const task = storageRef.putFile(uploadUri);

    task.on('state_changed', taskSnapshot => {
      setTransferred(
        Math.round(taskSnapshot.bytesTransferred / taskSnapshot.totalBytes) * 100,
      );
    });

    try {
      await task;
      const url = await storageRef.getDownloadURL();
      return url;
    } catch (e) {
      console.log(e);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setUploading(true);
    setIsSubmitting(true);
    try {
      let imageUrl = null;

      if (image) {
        imageUrl = await uploadImageAsync();
      }

      const userDocRef = firestore().collection('users').doc(getUser());

      await firestore().runTransaction(async transaction => {
        const userDoc = await transaction.get(userDocRef);
        const userData = userDoc.data();
        const newBalance = userData.balance - parseInt(amount);
        transaction.update(userDocRef, {balance: newBalance});

        const transactionRef = userDocRef.collection('transactions');
        const expenseData = {
          userId: getUser(),
          title: title.trim(),
          description: description.trim(),
          amount: amount,
          category: category,
          date: date,
          image: imageUrl,
          createdAt: firestore.Timestamp.fromDate(new Date()),
          type: 'expense',
        };

        const expenseDocRef = await transactionRef.add(expenseData);
        expenseData.documentId = expenseDocRef.id;
        transaction.update(expenseDocRef, {documentId: expenseDocRef.id});
      });

      setAmount('');
      setTitle('');
      setDescription('');
      setCategory('');
      setValue(null);
      setDate(undefined);
      setImage(null);
      setSuccessMessage('Expense added successfully!');
      
      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } catch (error) {
      console.error('Error adding expense:', error);
      setErrorMessage('An error occurred while adding the expense. Please try again.');
    } finally {
      setUploading(false);
      setIsSubmitting(false);
    }
  };

  const takePhotoFromCamera = () => {
    launchCamera(
      {
        mediaType: 'photo',
        includeBase64: false,
        quality: 0.8
      },
      response => {
        if (response.didCancel) {
          console.log('User cancelled camera picker');
        } else if (response.errorCode) {
          console.log('Camera error: ', response.errorMessage);
        } else {
          const imageUri = response.assets[0].uri;
          setImage(imageUri);
        }
      },
    );
    toggleModal();
  };

  const choosePhotoFromLibrary = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        includeBase64: false,
        quality: 0.8
      },
      response => {
        if (response.didCancel) {
          console.log('User cancelled image picker');
        } else if (response.errorCode) {
          console.log('ImagePicker Error: ', response.errorMessage);
        } else {
          const imageUri = response.assets[0].uri;
          setImage(imageUri);
        }
      },
    );
    toggleModal();
  };

  const removeImage = () => {
    setImage(null);
  };

  const isFormValid = () => {
    return (
      title.trim() !== '' &&
      description.trim() !== '' &&
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
    <Provider>
      <SafeAreaProvider>
        <View style={styles.container}>
          <KeyboardAwareScrollView
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            
            {/* Header Section */}
            <View style={styles.headerSection}>
              <View style={styles.headerTitleRow}>
                <MaterialCommunityIcons name="cash-minus" size={32} color={EXPENSE_COLOR} />
                <Text style={styles.headerTitle}>Add Expense</Text>
              </View>
              <Text style={styles.headerSubtitle}>Record your expenses to track your spending</Text>
            </View>

            {/* Form Card */}
            <Card style={styles.formCard}>
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

                {/* Title Input */}
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
                    />
                  </View>
                </View>

                {/* Description Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Description</Text>
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
                      placeholder="Select expense category"
                      placeholderStyle={styles.dropdownPlaceholder}
                      open={open}
                      value={value}
                      items={items}
                      setOpen={setOpen}
                      setValue={setValue}
                      setItems={setItems}
                      style={styles.dropdown}
                      dropDownContainerStyle={styles.dropdownList}
                      textStyle={styles.dropdownText}
                      onChangeValue={setCategory}
                      disabled={isSubmitting}
                      listMode="SCROLLVIEW"
                    />
                  </View>
                </View>

                {/* Amount Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Amount (₹)</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="currency-inr" size={20} color={PRIMARY_COLOR} style={styles.inputIcon} />
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
                  mode="single"
                  visible={openDate}
                  onDismiss={onDismissSingle}
                  date={date ? new Date(date) : new Date()}
                  onConfirm={onConfirmSingle}
                  saveLabel="Confirm"
                  label="Select date"
                  animationType="fade"
                />

                {/* Image Upload Section */}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Receipt/Image (Optional)</Text>
                  
                  {image ? (
                    <View style={styles.imageContainer}>
                      <Image source={{uri: image}} style={styles.imagePreview} />
                      <View style={styles.imageActions}>
                        <TouchableOpacity
                          style={styles.imageActionButton}
                          onPress={() => !isSubmitting && setModalVisible(true)}
                          disabled={isSubmitting}>
                          <MaterialCommunityIcons name="camera-switch" size={20} color={PRIMARY_COLOR} />
                          <Text style={styles.imageActionText}>Change</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.imageActionButton, styles.removeButton]}
                          onPress={removeImage}
                          disabled={isSubmitting}>
                          <MaterialCommunityIcons name="delete" size={20} color={EXPENSE_COLOR} />
                          <Text style={[styles.imageActionText, styles.removeText]}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.imageUploadButton}
                      onPress={() => !isSubmitting && setModalVisible(true)}
                      disabled={isSubmitting}>
                      <MaterialCommunityIcons name="camera-plus" size={32} color={PRIMARY_COLOR} />
                      <Text style={styles.imageUploadText}>Add Receipt Image</Text>
                      <Text style={styles.imageUploadSubtext}>Tap to take photo or choose from gallery</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Submit Button */}
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

          {/* Image Picker Modal */}
          <Portal>
            <Modal
              visible={modalVisible}
              contentContainerStyle={styles.modalContent}
              onDismiss={() => setModalVisible(false)}>
              <View style={styles.modalHeader}>
                <MaterialCommunityIcons name="camera" size={32} color={PRIMARY_COLOR} />
                <Text style={styles.modalTitle}>Add Receipt Image</Text>
              </View>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={takePhotoFromCamera}>
                <MaterialCommunityIcons name="camera" size={24} color={PRIMARY_COLOR} />
                <Text style={styles.modalButtonText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={choosePhotoFromLibrary}>
                <MaterialCommunityIcons name="image" size={24} color={PRIMARY_COLOR} />
                <Text style={styles.modalButtonText}>Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
                <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
            </Modal>
          </Portal>
        </View>
      </SafeAreaProvider>
    </Provider>
  );
};

export default AddExpense;

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
    elevation: 8,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: EXPENSE_COLOR,
  },
  successMessage: {
    color: EXPENSE_COLOR,
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  inputIcon: {
    marginRight: 12,
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
  },
  dropdown: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  dropdownList: {
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
  imageContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EBF7',
    padding: 15,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 15,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
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
  removeButton: {
    borderColor: EXPENSE_COLOR,
  },
  imageActionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    fontFamily: 'Lato-Bold',
  },
  removeText: {
    color: EXPENSE_COLOR,
  },
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
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    margin: 20,
    padding: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 25,
    paddingHorizontal: 20,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EBF7',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C2C2C',
    marginTop: 10,
    fontFamily: 'Kufam-SemiBoldItalic',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalButtonText: {
    fontSize: 16,
    color: '#2C2C2C',
    marginLeft: 15,
    fontFamily: 'Lato-Regular',
    fontWeight: '500',
  },
  cancelButton: {
    borderBottomWidth: 0,
  },
  cancelButtonText: {
    color: '#666',
  },
});
