import { View, Text, TouchableOpacity, StyleSheet, TextInput, SafeAreaView, ScrollView, Image } from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import DropDownPicker from 'react-native-dropdown-picker'
import auth from '@react-native-firebase/auth'
import firestore from '@react-native-firebase/firestore'
import storage from '@react-native-firebase/storage'
import { ActivityIndicator } from 'react-native-paper'
import ImagePicker from 'react-native-image-crop-picker'
import { DatePickerModal } from 'react-native-paper-dates'
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import FormButton from '../components/FormButton';
import Animated from 'react-native-reanimated';
import BottomSheet from 'reanimated-bottom-sheet';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

const AddExpense = ({navigation}) => {
  const [userData, setUserData] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState('')
  const [image, setImage] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [transferred, setTransferred] = useState(0)
  const [open, setOpen] = useState(false)
  const [openDate, setOpenDate] = useState(false)
  const [value, setValue] = useState(null)
  const [items, setItems] = useState([
    { label: 'Bills', value: 'Bills' },
    { label: 'Education', value: 'Education' },
    { label: 'Entertainment', value: 'Entertainment' },
    { label: 'Food', value: 'Food' },
    { label: 'Health', value: 'Health' },
    { label: 'Travel', value: 'Travel' },
    { label: 'Shopping', value: 'Shopping' },
    { label: 'Others', value: 'Others' },
  ])

  const onDismissSingle = useCallback(() => {
    setOpenDate(false)
  }, [setOpenDate])

  const onConfirmSingle = useCallback(
    (params) => {
      setOpenDate(false);
      // Make sure to format the date before setting it to state
      const formattedDate = `${params.date.getFullYear()}-${
        params.date.getMonth() + 1
      }-${params.date.getDate()}`;
      setDate(formattedDate);
    },
    [setOpenDate, setDate]
  );

  const getUser = () => {
    const user = auth().currentUser
    return user.uid
  }

  useEffect(() => {
    getUser()
  } , [])

  const fetchUserData = async () => {
    const user = auth().currentUser
    const documentSnapshot = await firestore()
      .collection('users')
      .doc(user.uid)
      .get()
    setUserData(documentSnapshot.data())
  }

  useEffect(() => {
    fetchUserData()
  }
  , [])

  // const handleSubmit = async () => {
  //   let imageUrl = await uploadImage()

  //   if (title === '' || description === '' || amount === '' || category === '' || date === '') {
  //     alert('Please fill in all fields')
  //   } else {
  //     setUploading(true)
  //     const expenseData = {
  //       userId: getUser(),
  //       title: title,
  //       description: description,
  //       amount: amount,
  //       category: category,
  //       date: date,
  //       imageUrl: imageUrl,
  //       createdAt: firestore.Timestamp.fromDate(new Date()),
  //       // timestamp: firestore.FieldValue.serverTimestamp(),
  //       type: 'expense'
  //     }
  //     firestore()
  //     .collection('users')
  //     .doc(getUser())
  //     .set({
  //       transactions: firestore.FieldValue.arrayUnion(expenseData)
  //     }, { merge: true })
  //     setAmount('')
  //     setTitle('')
  //     setDescription('')
  //     setCategory('')
  //     setDate('')
  //     setImage(null)
  //     setUploading(false)
  //     alert('Expense added successfully')

  //     // reduce the amount from the user's balance
  //     firestore()
  //     .collection('users')
  //     .doc(getUser())
  //     .get()
  //     .then(documentSnapshot => {
  //       if (documentSnapshot.exists) {
  //         const userData = documentSnapshot.data()
  //         const balance = userData.balance
  //         const newBalance = balance - amount
  //         firestore()
  //         .collection('users')
  //         .doc(getUser())
  //         .update({
  //           balance: newBalance
  //         })
  //       }
  //     })
  //     navigation.goBack()
  //   }
  // }

  // const checkIfExpenseGreaterThanBalance = () => {
  //   if (amount > userData.balance) {
  //     alert('Expense cannot be greater than balance')
  //   }
  //   else {
  //     handleSubmit()
  //   }
  // }

  const handleSubmit = async () => {
    let imageUrl = await uploadImage();
  
    if (title === '' || description === '' || amount === '' || category === '' || date === '') {
      alert('Please fill in all fields');
    } else {
      setUploading(true);
  
      try {
        const userDocRef = firestore().collection('users').doc(getUser());
  
        // Use a transaction to ensure data consistency
        await firestore().runTransaction(async (transaction) => {
          // Get the latest user data
          const userDoc = await transaction.get(userDocRef);
          const userData = userDoc.data();
  
          // Check if the expense is greater than the balance
          if (amount > userData.balance) {
            alert('Expense cannot be greater than balance');
          } else {
            // Update user's balance
            const newBalance = userData.balance - amount;
            transaction.update(userDocRef, { balance: newBalance });
  
            // Add the expense transaction
            const expenseData = {
              userId: getUser(),
              title: title,
              description: description,
              amount: amount,
              category: category,
              date: date,
              imageUrl: imageUrl,
              createdAt: firestore.Timestamp.fromDate(new Date()),
              type: 'expense'
            };
  
            // Use arrayUnion to add a new transaction to the transactions array
            transaction.update(userDocRef, {
              transactions: firestore.FieldValue.arrayUnion(expenseData)
            });
            alert('Expense added successfully');
            navigation.goBack();
          }
        });
  
        setAmount('');
        setTitle('');
        setDescription('');
        setCategory('');
        setDate('');
        setImage(null);
        setUploading(false);
      } catch (error) {
        console.error('Error adding expense:', error);
        alert('An error occurred while adding the expense. Please try again.');
        setUploading(false);
      }
    }
  };  

  const uploadImage = async () => {
    if (image == null) {
      return null
    }
    const uploadUri = image
    let filename = uploadUri.substring(uploadUri.lastIndexOf('/') + 1)

    // Add timestamp to File Name
    const extension = filename.split('.').pop()
    const name = filename.split('.').slice(0, -1).join('.')
    filename = name + Date.now() + '.' + extension

    setUploading(true)
    setTransferred(0)

    const storageRef = storage().ref(`bills/${getUser()}/${filename}`)
    const task = storageRef.putFile(uploadUri)

    // Set transferred state
    task.on('state_changed', (taskSnapshot) => {
      console.log(
        `${taskSnapshot.bytesTransferred} transferred out of ${taskSnapshot.totalBytes}`
      )

      setTransferred(
        Math.round(taskSnapshot.bytesTransferred / taskSnapshot.totalBytes) *
          100
      )
    })

    try {
      await task

      const url = await storageRef.getDownloadURL()

      setUploading(false)
      setImage(null)

      return url
    } catch (e) {
      console.log(e)
      return null
    }
  }

  const takePhotoFromCamera = () => {
    ImagePicker.openCamera({
      compressImageMaxWidth: 300,
      compressImageMaxHeight: 300,
      cropping: true,
      compressImageQuality: 0.7,
    }).then(image => {
      console.log(image);
      const imageUri = Platform.OS === 'ios' ? image.sourceURL : image.path;
      setImage(imageUri);
      this.bs.current.snapTo(1);
    });
  };

  const choosePhotoFromLibrary = () => {
    ImagePicker.openPicker({
      width: 300,
      height: 300,
      cropping: true,
      compressImageQuality: 0.7,
    }).then(image => {
      console.log(image);
      const imageUri = Platform.OS === 'ios' ? image.sourceURL : image.path;
      setImage(imageUri);
      this.bs.current.snapTo(1);
    });
  };

  renderInner = () => (
    <View style={styles.panel}>
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.panelTitle}>Upload Bill</Text>
        <Text style={styles.panelSubtitle}>Choose Your Bill</Text>
      </View>
      <TouchableOpacity style={styles.panelButton} onPress={takePhotoFromCamera}>
        <Text style={styles.panelButtonTitle}>Take Photo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.panelButton} onPress={choosePhotoFromLibrary}>
        <Text style={styles.panelButtonTitle}>Choose From Library</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.panelButton}
        onPress={() => this.bs.current.snapTo(1)}>
        <Text style={styles.panelButtonTitle}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.panelHeader}>
        <View style={styles.panelHandle} />
      </View>
    </View>
  );

  bs = React.createRef();
  fall = new Animated.Value(1);

  if (uploading) {
    return (
      <View style={styles.progressBarContainer}>
        <ActivityIndicator size="large" color="#333333" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <BottomSheet
        ref={this.bs}
        snapPoints={[330, -5]}
        renderContent={this.renderInner}
        renderHeader={this.renderHeader}
        initialSnap={1}
        callbackNode={this.fall}
        enabledGestureInteraction={true}
      />
      <Animated.View
        style={{
          margin: 20,
          opacity: Animated.add(0.1, Animated.multiply(this.fall, 1.0)),
        }}>
        <KeyboardAwareScrollView keyboardShouldPersistTaps="always">
        <View style={styles.action}>
          <FontAwesome name="font" color="#333333" size={20} />
          <TextInput
            placeholder="Title"
            placeholderTextColor="#666666"
            autoCorrect={false}
            value={title}
            onChangeText={(text) => setTitle(text)}
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
            onChangeText={(text) => setDescription(text)}
            style={styles.textInput}
          />
        </View>
        </KeyboardAwareScrollView>
        {/* <View style={styles.action}> */}
          {/* <FontAwesome name="category" color="#333333" size={20} /> */}
          <DropDownPicker
            placeholder="Category"
            placeholderStyle={{
              color: '#666666'
            }}
            open={open}
            value={value}
            items={items}
            setOpen={setOpen}
            setValue={setValue}
            setItems={setItems}
            style={styles.dropdown}
            onChangeValue={(text) => setCategory(text)}
          />
        {/* </View> */}
        <KeyboardAwareScrollView keyboardShouldPersistTaps="always">
        <View style={styles.action}>
          <FontAwesome name="money" color="#333333" size={20} />
          <TextInput
            placeholder="Amount"
            placeholderTextColor="#666666"
            keyboardType="numeric"
            autoCorrect={false}
            value={amount}
            onChangeText={(text) => setAmount(text)}
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
            onChangeText={(text) => setDate(text)}
            style={styles.textInput}
            onFocus={() => setOpenDate(true)}
          />
          <DatePickerModal
            mode="single"
            visible={openDate}
            onDismiss={onDismissSingle}
            date={date}
            onConfirm={onConfirmSingle}
            saveLabel="Confirm"
            label="Select date"
            animationType="fade"
            />
        </View>
        </KeyboardAwareScrollView>
        {image != null ? (
          <Image source={{uri: image}} style={{width: 200, height: 200, justifyContent: 'center', alignSelf: 'center', marginBottom: 10}} />
        ) : (
          <FormButton buttonTitle="Upload Bill" onPress={() => this.bs.current.snapTo(0)} />
        )}
        <FormButton buttonTitle="Submit" onPress={() => handleSubmit()} />
      </Animated.View>
    </View>
  )
}

export default AddExpense

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  commandButton: {
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#FF6347',
    alignItems: 'center',
    marginTop: 10,
  },
  panel: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    width: '100%',
  },
  header: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#333333',
    shadowOffset: {width: -1, height: -3},
    shadowRadius: 2,
    shadowOpacity: 0.4,
    paddingTop: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  panelHeader: {
    alignItems: 'center',
  },
  panelHandle: {
    width: 40,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00000040',
    marginBottom: 10,
  },
  panelTitle: {
    fontSize: 27,
    height: 35,
  },
  panelSubtitle: {
    fontSize: 14,
    color: 'gray',
    height: 30,
    marginBottom: 10,
  },
  panelButton: {
    padding: 13,
    borderRadius: 10,
    backgroundColor: '#2e64e5',
    alignItems: 'center',
    marginVertical: 7,
  },
  panelButtonTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: 'white',
  },
  action: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 10,
    // borderBottomWidth: 1,
    // borderBottomColor: '#',
    // give little gray color to the border
    // borderBottomColor: '#f2f2f2',
    paddingBottom: 5,
  },
  actionError: {
    flexDirection: 'row',
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FF0000',
    paddingBottom: 5,
  },
  textInput: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 0 : -12,
    paddingLeft: 10,
    color: '#333333',
  },
  dropdown: {
    // flex: 1,
    marginTop: Platform.OS === 'ios' ? 0 : -12,
    paddingLeft: 10,
    marginBottom: 10,
    // color: '#333333',
  },
  progressBarContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50
  },
});