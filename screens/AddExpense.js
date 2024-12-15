import React, {useState, useEffect, useCallback} from 'react';
import {View, StyleSheet, TextInput, Image, Alert} from 'react-native';
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
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import FormButton from '../components/FormButton';

const AddExpense = ({navigation}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [openDate, setOpenDate] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

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

  // Utility to get current user ID
  const getUserId = () => auth().currentUser?.uid;

  // Date picker handlers
  const onDismissSingle = useCallback(() => setOpenDate(false), []);
  const onConfirmSingle = useCallback(params => {
    setOpenDate(false);
    const formattedDate = `${params.date.getFullYear()}-${
      params.date.getMonth() + 1
    }-${params.date.getDate()}`;
    setDate(formattedDate);
  }, []);

  // Fetch user balance on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userDoc = await firestore()
          .collection('users')
          .doc(getUserId())
          .get();
        if (userDoc.exists) {
          console.log('User Data:', userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    fetchUserData();
  }, []);

  // Handle image upload
  const uploadImage = async () => {
    if (!image) return null;

    const uploadUri = image;
    let filename = uploadUri.substring(uploadUri.lastIndexOf('/') + 1);
    const extension = filename.split('.').pop();
    const name = filename.split('.').slice(0, -1).join('.');
    filename = `${name}_${Date.now()}.${extension}`;

    const storageRef = storage().ref(`bills/${getUserId()}/${filename}`);
    const task = storageRef.putFile(uploadUri);

    setUploading(true);

    try {
      await task;
      const downloadURL = await storageRef.getDownloadURL();
      setUploading(false);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploading(false);
      return null;
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!title || !description || !amount || !category || !date) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const imageUrl = await uploadImage();
    setUploading(true);

    try {
      const userDocRef = firestore().collection('users').doc(getUserId());
      await firestore().runTransaction(async transaction => {
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists) throw 'User does not exist';

        const userData = userDoc.data();
        const newBalance = userData.balance - Number(amount);
        transaction.update(userDocRef, {balance: newBalance});

        const transactionsCollectionRef = userDocRef.collection('transactions');
        const expenseData = {
          userId: getUserId(),
          title,
          description,
          amount: Number(amount),
          category,
          date,
          createdAt: firestore.Timestamp.fromDate(new Date()),
          type: 'expense',
          imageUrl,
        };

        await transactionsCollectionRef.add(expenseData);
      });

      Alert.alert('Success', 'Expense added successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Error adding expense:', error);
      Alert.alert('Error', 'Failed to add expense. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Image picker handlers
  const handleImagePicker = (response, isCamera = false) => {
    if (response.didCancel) {
      console.log(`${isCamera ? 'Camera' : 'Library'} picker cancelled`);
    } else if (response.errorCode) {
      console.error(
        `${isCamera ? 'Camera' : 'Library'} error:`,
        response.errorMessage,
      );
    } else {
      const imageUri = response.assets[0].uri;
      setImage(imageUri);
      toggleModal();
    }
  };

  const takePhotoFromCamera = () => {
    launchCamera({mediaType: 'photo'}, response =>
      handleImagePicker(response, true),
    );
  };

  const choosePhotoFromLibrary = () => {
    launchImageLibrary({mediaType: 'photo'}, handleImagePicker);
  };

  const toggleModal = () => setModalVisible(prev => !prev);

  if (uploading) {
    return (
      <View style={styles.progressBarContainer}>
        <ActivityIndicator size="large" color="#333" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Form Fields */}
      <View style={styles.action}>
        <FontAwesome name="font" size={20} color="#333" />
        <TextInput
          placeholder="Title"
          style={styles.textInput}
          value={title}
          onChangeText={setTitle}
          placeholderTextColor={'#666'}
        />
      </View>
      <View style={styles.action}>
        <FontAwesome name="pencil" size={20} color="#333" />
        <TextInput
          placeholder="Description"
          style={styles.textInput}
          value={description}
          onChangeText={setDescription}
          placeholderTextColor={'#666'}
        />
      </View>
      <View style={styles.action}>
        <DropDownPicker
          placeholder="Category"
          open={open}
          value={value}
          items={items}
          setOpen={setOpen}
          setValue={setValue}
          setItems={setItems}
          onChangeValue={setCategory}
          style={styles.dropdown}
        />
      </View>
      <View style={styles.action}>
        <FontAwesome name="money" size={20} color="#333" />
        <TextInput
          placeholder="Amount"
          keyboardType="numeric"
          style={styles.textInput}
          value={amount}
          onChangeText={setAmount}
          placeholderTextColor={'#666'}
        />
      </View>
      <View style={styles.action}>
        <FontAwesome name="calendar" size={20} color="#333" />
        <TextInput
          placeholder="Date"
          style={styles.textInput}
          value={date}
          onFocus={() => setOpenDate(true)}
          placeholderTextColor={'#666'}
        />
        <DatePickerModal
          mode="single"
          visible={openDate}
          onDismiss={onDismissSingle}
          onConfirm={onConfirmSingle}
        />
      </View>
      {image && <Image source={{uri: image}} style={styles.imagePreview} />}
      <FormButton buttonTitle="Upload Bill" onPress={toggleModal} />
      <FormButton buttonTitle="Submit" onPress={handleSubmit} />

      {/* Image Picker Modal */}
      <Provider>
        <Portal>
          <Modal
            visible={modalVisible}
            onDismiss={toggleModal}
            contentContainerStyle={styles.modalContent}>
            <Button
              icon="camera"
              mode="contained"
              onPress={takePhotoFromCamera}>
              Take a Photo
            </Button>
            <Button
              icon="image"
              mode="contained"
              onPress={choosePhotoFromLibrary}
              style={{marginTop: 10}}>
              Choose from Gallery
            </Button>
          </Modal>
        </Portal>
      </Provider>
    </View>
  );
};

export default AddExpense;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  textInput: {
    flex: 1,
    marginLeft: 10,
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    color: '#333',
  },
  dropdown: {
    flex: 1,
    marginVertical: 20,
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
    borderRadius: 10,
  },
  button: {
    backgroundColor: '#677CD2',
    marginTop: 10,
  },
});
