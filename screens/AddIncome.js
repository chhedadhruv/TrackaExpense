import { View, Text, TouchableOpacity, StyleSheet, TextInput, SafeAreaView, ScrollView, Image } from 'react-native'
import React, { useState, useEffect, useCallback } from 'react'
import DropDownPicker from 'react-native-dropdown-picker'
import auth from '@react-native-firebase/auth'
import firestore from '@react-native-firebase/firestore'
import { ActivityIndicator } from 'react-native-paper'
import { DatePickerModal } from 'react-native-paper-dates'
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import FormButton from '../components/FormButton';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

const AddIncome = ({ navigation }) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState('')
  const [open, setOpen] = useState(false)
  const [openDate, setOpenDate] = useState(false)
  const [value, setValue] = useState(null)
  const [items, setItems] = useState([
    { label: 'Salary', value: 'Salary' },
    { label: 'Bonus', value: 'Bonus' },
    { label: 'Gift', value: 'Gift' },
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

  // const handleSubmit = async () => {
  //   if (title === '' || description === '' || amount === '' || category === '' || date === '') {
  //     alert('Please fill in all fields')
  //   } else {
  //     const expenseData = {
  //       userId: getUser(),
  //       title: title,
  //       description: description,
  //       amount: amount,
  //       category: category,
  //       date: date,
  //       createdAt: firestore.Timestamp.fromDate(new Date()),
  //       type: 'income'
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
  //     alert('Income added successfully')

  //     // add the amount to the user's balance
  //     firestore()
  //     .collection('users')
  //     .doc(getUser())
  //     .get()
  //     .then(documentSnapshot => {
  //       if (documentSnapshot.exists) {
  //         const balance = documentSnapshot.data().balance
  //         const newBalance = balance + parseInt(amount)
  //         firestore()
  //         .collection('users')
  //         .doc(getUser())
  //         .set({
  //           balance: newBalance
  //         }, { merge: true })
  //       }
  //     })
  //     navigation.goBack()
  //   }
  // }

  const handleSubmit = async () => {
    if (title === '' || description === '' || amount === '' || category === '' || date === '') {
      alert('Please fill in all fields')
    }
    else {
      const userDocRef = firestore().collection('users').doc(getUser())

      await firestore().runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userDocRef)
        const userData = userDoc.data()
        const newBalance = userData.balance + parseInt(amount)
        transaction.update(userDocRef, { balance: newBalance })
        
        const expenseData = {
          userId: getUser(),
          title: title,
          description: description,
          amount: amount,
          category: category,
          date: date,
          createdAt: firestore.Timestamp.fromDate(new Date()),
          type: 'income'
        }
        transaction.update(userDocRef, { transactions: firestore.FieldValue.arrayUnion(expenseData) })
      }
      )
      setAmount('')
      setTitle('')
      setDescription('')
      setCategory('')
      setDate('')
      alert('Income added successfully')
      navigation.goBack()
    }
  }

  return (
    <View style={styles.container}>
      {/* <KeyboardAwareScrollView keyboardShouldPersistTaps="always"> */}
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
        {/* </KeyboardAwareScrollView> */}
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
          {/* <KeyboardAwareScrollView keyboardShouldPersistTaps="always"> */}
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
        {/* </KeyboardAwareScrollView> */}
        <FormButton buttonTitle="Submit" onPress={() => handleSubmit()} />
    </View>
  )
}

export default AddIncome

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 20,
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
    marginTop: 0,
    // paddingLeft: 10,
    marginBottom: 10,
    // color: '#333333',
  },
});