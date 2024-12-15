import React, {useState, useEffect} from 'react';
import {View, Alert, StyleSheet} from 'react-native';
import {ActivityIndicator, Text} from 'react-native-paper';
import FormButton from '../components/FormButton';
import FormInput from '../components/FormInput';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const EditProfileScreen = ({navigation}) => {
  const [userData, setUserData] = useState({
    name: '',
    email: '',
    phone: '',
    balance: 0,
    transactions: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch user data from Firebase Auth and Firestore
    const fetchUserData = async () => {
      try {
        const currentUser = auth().currentUser;
        if (!currentUser) {
          Alert.alert('Error', 'No user is logged in');
          navigation.goBack();
          return;
        }

        const userDoc = await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .get();

        if (userDoc.exists) {
          setUserData(userDoc.data());
        } else {
          Alert.alert('Error', 'User data not found');
        }
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Failed to load user data');
      }
    };

    fetchUserData();
  }, []);

  // Handle profile update
  const handleUpdate = async () => {
    if (validateInputs()) {
      setLoading(true);
      const currentUser = auth().currentUser;

      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        await firestore().collection('users').doc(currentUser.uid).update({
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          balance: userData.balance,
        });

        Alert.alert('Success', 'Profile updated successfully');
        navigation.goBack();
      } catch (error) {
        setLoading(false);
        setError('Error updating profile. Please try again later.');
        console.error(error);
      }
    }
  };

  // Input validation
  const validateInputs = () => {
    if (!userData.name) {
      Alert.alert('Validation Error', 'Name is required');
      return false;
    }
    if (!userData.email || !validateEmail(userData.email)) {
      Alert.alert('Validation Error', 'Valid email is required');
      return false;
    }
    if (!userData.phone || userData.phone.length !== 10) {
      Alert.alert('Validation Error', 'Phone number must be 10 digits');
      return false;
    }
    return true;
  };

  // Email validation
  const validateEmail = email => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    return emailRegex.test(email);
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  return (
    <View style={styles.container}>
      <FormInput
        labelName="Name"
        value={userData.name}
        autoCapitalize="none"
        onChangeText={name => setUserData({...userData, name})}
      />
      <FormInput
        labelName="Email"
        value={userData.email}
        autoCapitalize="none"
        onChangeText={email => setUserData({...userData, email})}
      />
      <FormInput
        labelName="Phone"
        value={userData.phone}
        autoCapitalize="none"
        onChangeText={phone => setUserData({...userData, phone})}
      />
      <FormButton
        buttonTitle="Update"
        modeValue="contained"
        labelStyle={styles.buttonLabel}
        onPress={() => handleUpdate()}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

export default EditProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  buttonLabel: {
    fontSize: 22,
  },
  error: {
    color: 'red',
    marginTop: 10,
  },
});
