import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, TextInput, Image} from 'react-native';
import {Button, Modal, Portal, Provider} from 'react-native-paper';
import DropDownPicker from 'react-native-dropdown-picker';
import {DatePickerModal} from 'react-native-paper-dates';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';

const EditTransactionScreen = ({route, navigation}) => {
  const {transaction} = route.params;

  const [title, setTitle] = useState(transaction.title);
  const [description, setDescription] = useState(transaction.description);
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [category, setCategory] = useState(transaction.category);
  const [date, setDate] = useState(transaction.date);
  const [image, setImage] = useState(transaction.imageUrl);
  const [openDate, setOpenDate] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transferred, setTransferred] = useState(0);
  const [open, setOpen] = useState(false);
  const [expenseItems] = useState([
    {label: 'Bills', value: 'Bills'},
    {label: 'Education', value: 'Education'},
    {label: 'Entertainment', value: 'Entertainment'},
    {label: 'Food', value: 'Food'},
    {label: 'Health', value: 'Health'},
    {label: 'Travel', value: 'Travel'},
    {label: 'Shopping', value: 'Shopping'},
    {label: 'Others', value: 'Others'},
  ]);
  const [incomeItems] = useState([
    {label: 'Salary', value: 'Salary'},
    {label: 'Bonus', value: 'Bonus'},
    {label: 'Gift', value: 'Gift'},
    {label: 'Others', value: 'Others'},
  ]);

  const toggleModal = () => {
    setModalVisible(!modalVisible);
  };

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

  const getUser = () => {
    const user = auth().currentUser;
    return user.uid;
  };

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth().currentUser;
      await firestore().collection('users').doc(user.uid).get();
    };
    fetchUserData();
  }, []);

  const handleSubmit = async () => {
    let imageUrl = await uploadImage();

    if (
      title === '' ||
      description === '' ||
      amount === '' ||
      category === '' ||
      date === ''
    ) {
      alert('Please fill in all fields');
      return;
    }

    setUploading(true);

    try {
      const userDocRef = firestore().collection('users').doc(getUser());
      const transactionRef = userDocRef
        .collection('transactions')
        .doc(transaction.id);

      await firestore().runTransaction(async transaction => {
        const transactionDoc = await transaction.get(transactionRef);
        const transactionData = transactionDoc.data();

        if (transactionData.type === 'expense') {
          imageUrl = imageUrl || transactionData.imageUrl;
        } else if (typeof imageUrl === 'undefined') {
          delete transactionData.imageUrl;
        }

        transaction.update(transactionRef, {
          title,
          description,
          amount: parseFloat(amount),
          category,
          date,
          imageUrl,
          createdAt: firestore.Timestamp.fromDate(new Date()),
        });

        const userData = await transaction.get(userDocRef);
        const userBalance = userData.data().balance;
        const transactionAmount = parseFloat(amount);
        let newBalance;

        if (transactionData.type === 'expense') {
          newBalance = userBalance + transactionData.amount - transactionAmount;
        } else {
          newBalance = userBalance - transactionData.amount + transactionAmount;
        }

        transaction.update(userDocRef, {balance: newBalance});
      });

      setUploading(false);
      alert('Transaction updated successfully');
      navigation.navigate('Home');
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert(
        'An error occurred while updating the transaction. Please try again.',
      );
      setUploading(false);
    }
  };

  const uploadImage = async () => {
    if (!image) return null;

    const uploadUri = image;
    let filename = uploadUri.substring(uploadUri.lastIndexOf('/') + 1);
    const extension = filename.split('.').pop();
    const name = filename.split('.').slice(0, -1).join('.');
    filename = `${name}${Date.now()}.${extension}`;

    const storageRef = storage().ref(`bills/${getUser()}/${filename}`);
    const task = storageRef.putFile(uploadUri);

    task.on('state_changed', taskSnapshot => {
      setTransferred(
        Math.round(taskSnapshot.bytesTransferred / taskSnapshot.totalBytes) *
          100,
      );
    });

    try {
      await task;
      return await storageRef.getDownloadURL();
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

  return (
    <View style={styles.container}>
      <View style={styles.action}>
        <FontAwesome name="font" color="#333333" size={20} />
        <TextInput
          placeholder="Title"
          placeholderTextColor="#666666"
          autoCorrect={false}
          value={title}
          onChangeText={setTitle}
          style={styles.textInput}
        />
      </View>
      <View style={styles.action}>
        <FontAwesome name="pencil" color="#333333" size={20} />
        <TextInput
          placeholder="Description"
          placeholderTextColor="#666666"
          autoCorrect={false}
          value={description}
          onChangeText={setDescription}
          style={styles.textInput}
        />
      </View>
      <View style={styles.action}>
        <DropDownPicker
          placeholder="Category"
          placeholderStyle={{color: '#666666'}}
          open={open}
          value={category}
          items={transaction.type === 'expense' ? expenseItems : incomeItems}
          setOpen={setOpen}
          setValue={setCategory}
          style={styles.dropdown}
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
          onChangeText={setAmount}
          style={styles.textInput}
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
          onFocus={() => setOpenDate(true)}
        />
        <DatePickerModal
          mode="single"
          visible={openDate}
          onDismiss={onDismissSingle}
          date={new Date(date)}
          onConfirm={onConfirmSingle}
          saveLabel="Confirm"
          label="Select date"
          animationType="fade"
        />
      </View>
      {transaction.type === 'expense' && (
        <View>
          {image ? (
            <View>
              <Image source={{uri: image}} style={styles.image} />
              <Button
                icon="camera"
                mode="contained"
                onPress={toggleModal}
                style={styles.button}>
                Change Image
              </Button>
            </View>
          ) : (
            <View>
              <Text style={styles.uploadText}>Image not uploaded</Text>
              <Button
                icon="camera"
                mode="contained"
                onPress={toggleModal}
                style={styles.button}>
                Upload Bill
              </Button>
            </View>
          )}
        </View>
      )}

      <Button mode="contained" onPress={handleSubmit} style={styles.button}>
        Submit
      </Button>
      <Provider>
        <Portal>
          <Modal
            visible={modalVisible}
            onDismiss={toggleModal}
            contentContainerStyle={styles.modalContent}>
            <View>
              <Button
                icon="camera"
                mode="contained"
                onPress={takePhotoFromCamera}
                style={styles.button}>
                Take a photo
              </Button>
              <Button
                icon="image"
                mode="contained"
                onPress={choosePhotoFromLibrary}
                style={[styles.button, {marginTop: 10}]}>
                Choose from gallery
              </Button>
            </View>
          </Modal>
        </Portal>
      </Provider>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
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
  image: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    marginBottom: 10,
  },
  uploadText: {
    alignSelf: 'center',
    marginBottom: 10,
    color: '#677CD2',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#677CD2',
    marginTop: 10,
  },
  modalContent: {
    height: 200,
    width: 300,
    position: 'absolute',
    bottom: '100%',
    right: 'auto',
    backgroundColor: '#fff',
    padding: 20,
    margin: 50,
    borderRadius: 10,
  },
});

export default EditTransactionScreen;
