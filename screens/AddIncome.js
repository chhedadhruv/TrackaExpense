import {View, StyleSheet, TextInput, ActivityIndicator} from 'react-native';
import React, {useState, useCallback} from 'react';
import DropDownPicker from 'react-native-dropdown-picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {DatePickerModal} from 'react-native-paper-dates';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import FormButton from '../components/FormButton';

const AddIncome = ({navigation}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    category: '',
    date: '',
  });
  const [open, setOpen] = useState(false);
  const [openDate, setOpenDate] = useState(false);
  const [value, setValue] = useState(null);
  const [items, setItems] = useState([
    {label: 'Salary', value: 'Salary'},
    {label: 'Bonus', value: 'Bonus'},
    {label: 'Gift', value: 'Gift'},
    {label: 'Others', value: 'Others'},
  ]);
  const [loading, setLoading] = useState(false);

  const getUser = () => {
    const user = auth().currentUser;
    return user?.uid;
  };

  const handleInputChange = (field, value) => {
    setFormData(prevState => ({...prevState, [field]: value}));
  };

  const onDismissSingle = useCallback(() => {
    setOpenDate(false);
  }, []);

  const onConfirmSingle = useCallback(params => {
    setOpenDate(false);
    const formattedDate = `${params.date.getFullYear()}-${(
      params.date.getMonth() + 1
    )
      .toString()
      .padStart(2, '0')}-${params.date.getDate().toString().padStart(2, '0')}`;
    handleInputChange('date', formattedDate);
  }, []);

  const handleSubmit = async () => {
    const {title, description, amount, category, date} = formData;

    if (!title || !description || !amount || !category || !date) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const userDocRef = firestore().collection('users').doc(getUser());

      await firestore().runTransaction(async transaction => {
        const userDoc = await transaction.get(userDocRef);
        const userData = userDoc.data();
        const newBalance = userData.balance + parseInt(amount);

        transaction.update(userDocRef, {balance: newBalance});

        const transactionRef = userDocRef.collection('transactions');
        const incomeData = {
          userId: getUser(),
          ...formData,
          createdAt: firestore.Timestamp.fromDate(new Date()),
          type: 'income',
        };

        const incomeDocRef = await transactionRef.add(incomeData);
        incomeData.documentId = incomeDocRef.id;
        transaction.update(incomeDocRef, {documentId: incomeDocRef.id});
      });

      setFormData({
        title: '',
        description: '',
        amount: '',
        category: '',
        date: '',
      });
      alert('Income added successfully');
      navigation.goBack();
    } catch (error) {
      alert('Error adding income, please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.action}>
        <FontAwesome name="font" color="#333333" size={20} />
        <TextInput
          placeholder="Title"
          placeholderTextColor="#666666"
          autoCorrect={false}
          value={formData.title}
          onChangeText={text => handleInputChange('title', text)}
          style={styles.textInput}
        />
      </View>

      <View style={styles.action}>
        <FontAwesome name="pencil" color="#333333" size={20} />
        <TextInput
          placeholder="Description"
          placeholderTextColor="#666666"
          autoCorrect={false}
          value={formData.description}
          onChangeText={text => handleInputChange('description', text)}
          style={styles.textInput}
        />
      </View>

      <DropDownPicker
        placeholder="Category"
        placeholderStyle={{color: '#666666'}}
        open={open}
        value={value}
        items={items}
        setOpen={setOpen}
        setValue={setValue}
        setItems={setItems}
        style={styles.dropdown}
        onChangeValue={text => handleInputChange('category', text)}
      />

      <View style={styles.action}>
        <FontAwesome name="money" color="#333333" size={20} />
        <TextInput
          placeholder="Amount"
          placeholderTextColor="#666666"
          keyboardType="numeric"
          autoCorrect={false}
          value={formData.amount}
          onChangeText={text => handleInputChange('amount', text)}
          style={styles.textInput}
        />
      </View>

      <View style={styles.action}>
        <FontAwesome name="calendar" color="#333333" size={20} />
        <TextInput
          placeholder="Date"
          placeholderTextColor="#666666"
          autoCorrect={false}
          value={formData.date}
          onChangeText={text => handleInputChange('date', text)}
          style={styles.textInput}
          onFocus={() => setOpenDate(true)}
        />
        <DatePickerModal
          mode="single"
          visible={openDate}
          onDismiss={onDismissSingle}
          date={formData.date}
          onConfirm={onConfirmSingle}
          saveLabel="Confirm"
          label="Select date"
          animationType="fade"
        />
      </View>

      <FormButton
        buttonTitle="Submit"
        onPress={handleSubmit}
        disabled={loading}
      />

      {loading && (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      )}
    </View>
  );
};

export default AddIncome;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 20,
  },
  action: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 10,
    paddingBottom: 5,
  },
  textInput: {
    flex: 1,
    marginTop: Platform.OS === 'ios' ? 0 : -12,
    paddingLeft: 10,
    color: '#333333',
  },
  dropdown: {
    marginTop: 0,
    marginBottom: 10,
  },
  loader: {
    marginTop: 20,
  },
});
