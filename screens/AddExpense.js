import {View, StyleSheet, TextInput, Image} from 'react-native';
import React, {useState, useEffect} from 'react';
import DropDownPicker from 'react-native-dropdown-picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import {
  ActivityIndicator,
  Button,
  Modal,
  Portal,
  Provider,
} from 'react-native-paper';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {DatePickerModal} from 'react-native-paper-dates';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import FormButton from '../components/FormButton';

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

  const onDismissSingle = () => {
    setOpenDate(false);
  };

  const onConfirmSingle = params => {
    setOpenDate(false);
    const formattedDate = `${params.date.getFullYear()}-${
      params.date.getMonth() + 1
    }-${params.date.getDate()}`;
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

  const handleSubmit = async () => {
    if (
      title === '' ||
      description === '' ||
      amount === '' ||
      category === '' ||
      !date
    ) {
      alert('Please fill in all fields');
    } else {
      setUploading(true);
      setIsSubmitting(true);
      try {
        let imageUrl = null;

        if (image) {
          // Upload image to Firebase Storage
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
            title: title,
            description: description,
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
        setDate(undefined);
        setImage(null);
        alert('Expense added successfully');
        navigation.goBack();
      } catch (error) {
        console.error('Error adding expense:', error);
        alert('An error occurred while adding the expense. Please try again.');
      } finally {
        setUploading(false);
        setIsSubmitting(false);
      }
    }
  };

  const uploadImage = async () => {
    if (image == null) {
      return null;
    }

    const uploadUri = image;
    let filename = uploadUri.substring(uploadUri.lastIndexOf('/') + 1);

    const extension = filename.split('.').pop();
    const name = filename.split('.').slice(0, -1).join('.');
    filename = name + Date.now() + '.' + extension;

    setUploading(true);
    setTransferred(0);

    const storageRef = storage().ref(`bills/${getUser()}/${filename}`);
    const task = storageRef.putFile(uploadUri);

    task.on('state_changed', taskSnapshot => {
      console.log(
        `${taskSnapshot.bytesTransferred} transferred out of ${taskSnapshot.totalBytes}`,
      );

      setTransferred(
        Math.round(taskSnapshot.bytesTransferred / taskSnapshot.totalBytes) *
          100,
      );
    });

    try {
      await task;

      const url = await storageRef.getDownloadURL();

      setUploading(false);
      setImage(null);

      return url;
    } catch (e) {
      console.log(e);
      return null;
    }
  };

  const takePhotoFromCamera = () => {
    launchCamera(
      {
        mediaType: 'photo',
        includeBase64: false,
      },
      response => {
        console.log(response);
        if (response.didCancel) {
          console.log('User cancelled camera picker');
        } else if (response.errorCode) {
          console.log('Camera error: ', response.errorMessage);
        } else {
          const imageUri = response.assets[0].uri;
          setImage(imageUri);
          console.log(imageUri);
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
      },
      response => {
        console.log(response);
        if (response.didCancel) {
          console.log('User cancelled image picker');
        } else if (response.errorCode) {
          console.log('ImagePicker Error: ', response.errorMessage);
        } else {
          const imageUri = response.assets[0].uri;
          setImage(imageUri);
          console.log(imageUri);
        }
      },
    );
    toggleModal();
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

  if (uploading) {
    return (
      <View style={styles.progressBarContainer}>
        <ActivityIndicator size="large" color="#677CD2" />
      </View>
    );
  }

  return (
    <Provider>
      <SafeAreaProvider>
        <View style={styles.container}>
          <View style={styles.action}>
            <FontAwesome name="font" color="#333333" size={20} />
            <TextInput
              placeholder="Title"
              placeholderTextColor="#666666"
              autoCorrect={false}
              value={title}
              onChangeText={text => setTitle(text)}
              style={styles.textInput}
              editable={!isSubmitting}
            />
          </View>
          <View style={styles.action}>
            <FontAwesome name="pencil" color="#333333" size={20} />
            <TextInput
              placeholder="Description"
              placeholderTextColor="#666666"
              autoCorrect={false}
              value={description}
              onChangeText={text => setDescription(text)}
              style={styles.textInput}
              editable={!isSubmitting}
            />
          </View>
          <View style={styles.action}>
            <DropDownPicker
              placeholder="Category"
              placeholderStyle={{
                color: '#666666',
              }}
              open={open}
              value={value}
              items={items}
              setOpen={setOpen}
              setValue={setValue}
              setItems={setItems}
              style={styles.dropdown}
              onChangeValue={text => setCategory(text)}
              disabled={isSubmitting}
            />
          </View>
          <View style={styles.action}>
            <FontAwesome name="money" color="#333333" size={20} />
            <TextInput
              placeholder="Amount"
              placeholderTextColor="#666666"
              keyboardType="numeric"
              autoCorrect={false}
              value={amount}
              onChangeText={text => setAmount(text)}
              style={styles.textInput}
              editable={!isSubmitting}
            />
          </View>
          <View style={styles.action}>
            <FontAwesome name="calendar" color="#333333" size={20} />
            <TextInput
              placeholder="Date"
              placeholderTextColor="#666666"
              autoCorrect={false}
              value={date}
              onChangeText={setDate}
              style={styles.textInput}
              onFocus={() => !isSubmitting && setOpenDate(true)}
              editable={!isSubmitting}
            />
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
          </View>
          <View style={styles.action}>
            <Button
              mode="contained"
              style={styles.button}
              onPress={() => !isSubmitting && setModalVisible(true)}
              disabled={isSubmitting}>
              {image ? 'Change Image' : 'Attach Image'}
            </Button>
          </View>
          {image && (
            <View style={styles.action}>
              <Image source={{uri: image.uri}} style={{width: 100, height: 100}} />
            </View>
          )}
          <FormButton 
            buttonTitle={isSubmitting ? "Adding Expense..." : "Submit"} 
            onPress={() => handleSubmit()} 
            disabled={!isFormValid()}
            style={!isFormValid() && styles.disabledButton}
          />
          {isSubmitting && (
            <View style={styles.loadingIndicator}>
              <ActivityIndicator size="small" color="#677CD2" />
            </View>
          )}
          <Portal>
            <Modal
              visible={modalVisible}
              contentContainerStyle={styles.modalContent}
              onDismiss={() => setModalVisible(false)}>
              <Button
                mode="contained"
                style={styles.button}
                onPress={() => {
                  setModalVisible(false);
                  takePhotoFromCamera();
                }}>
                Take Photo
              </Button>
              <Button
                mode="contained"
                style={styles.button}
                onPress={() => {
                  setModalVisible(false);
                  choosePhotoFromLibrary();
                }}>
                Choose from Gallery
              </Button>
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
    padding: 20, // Add padding for spacing
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center', // Align items vertically
    marginBottom: 20, // Add margin bottom for spacing
  },
  textInput: {
    flex: 1,
    marginLeft: 10, // Add left margin for spacing
    height: 40, // Specify input height
    borderBottomWidth: 1, // Add bottom border for clarity
    borderBottomColor: '#ccc', // Light gray border color
    color: '#333', // Dark text color
  },
  dropdown: {
    flex: 1,
    // marginLeft: 10, // Add left margin for spacing
    marginVertical: 20, // Add vertical margin for spacing
  },
  progressBarContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 50,
    borderRadius: 10, // Add border radius for modal
  },
  button: {
    backgroundColor: '#677CD2',
    marginTop: 10,
  },
  datePicker: {
    flex: 1,
    marginLeft: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  loadingIndicator: {
    alignItems: 'center',
    marginTop: 10,
  },
});
