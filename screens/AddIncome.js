import { View, StyleSheet, TextInput } from 'react-native'
import React, { useState, useEffect } from 'react'
import DropDownPicker from 'react-native-dropdown-picker'
import auth from '@react-native-firebase/auth'
import firestore from '@react-native-firebase/firestore'
import { DatePickerInput } from 'react-native-paper-dates'
import { SafeAreaProvider } from "react-native-safe-area-context"
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import FormButton from '../components/FormButton';

const AddIncome = ({ navigation }) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState(undefined)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(null)
  const [items, setItems] = useState([
    { label: 'Salary', value: 'Salary' },
    { label: 'Bonus', value: 'Bonus' },
    { label: 'Gift', value: 'Gift' },
    { label: 'Others', value: 'Others' },
  ])

  const getUser = () => {
    const user = auth().currentUser
    return user.uid
  }

  useEffect(() => {
    getUser()
  } , [])

  const handleSubmit = async () => {
    // Convert date to formatted string if it's a Date object
    const formattedDate = date ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` : '';

    if (title === '' || description === '' || amount === '' || category === '' || !formattedDate) {
      alert('Please fill in all fields')
    } else {
      const userDocRef = firestore().collection('users').doc(getUser())
  
      await firestore().runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userDocRef)
        const userData = userDoc.data()
        const newBalance = userData.balance + parseInt(amount)
        transaction.update(userDocRef, { balance: newBalance })
  
        const transactionRef = userDocRef.collection('transactions')
        const incomeData = {
          userId: getUser(),
          title: title,
          description: description,
          amount: amount,
          category: category,
          date: formattedDate,
          createdAt: firestore.Timestamp.fromDate(new Date()),
          type: 'income'
        }
  
        const incomeDocRef = await transactionRef.add(incomeData)
        incomeData.documentId = incomeDocRef.id // Save the document ID along with the data
        transaction.update(incomeDocRef, { documentId: incomeDocRef.id }) // Update the document with the document ID
      })
  
      setAmount('')
      setTitle('')
      setDescription('')
      setCategory('')
      setDate(undefined)
      alert('Income added successfully')
      navigation.goBack()
    }
  }  
  
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
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
        <View style={styles.action}>
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
        </View>
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
          <DatePickerInput
            locale="en"
            label="Date"
            value={date}
            onChange={(d) => setDate(d)}
            inputMode="start"
            style={styles.datePicker}
          />
        </View>
        <FormButton buttonTitle="Submit" onPress={() => handleSubmit()} />
      </View>
    </SafeAreaProvider>
  )
}

export default AddIncome

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
  datePicker: {
    flex: 1,
    marginLeft: 10,
  },
});