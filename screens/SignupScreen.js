import React, {useContext, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import {AuthContext} from '../navigation/AuthProvider';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

const SignupScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [balance, setBalance] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const {register} = useContext(AuthContext);

  const isValidEmail = email => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const isValidName = name => {
    const re = /^[a-zA-Z]+(?:[\s-][a-zA-Z]+)*$/;
    return re.test(name);
  };

  const isValidBalance = balance => {
    const re = /^\d+(\.\d{1,2})?$/;
    return re.test(balance);
  };

  const isValidPhone = phone => {
    const re = /^\d{10}$/;
    return re.test(phone);
  };

  const handleSignup = async () => {
    setErrorMessage(null);
    setLoading(true);

    if (!email) {
      setErrorMessage('Please enter an email address');
      setLoading(false);
    } else if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      setLoading(false);
    } else if (!password) {
      setErrorMessage('Please enter a password');
      setLoading(false);
    } else if (!confirmPassword) {
      setErrorMessage('Please confirm your password');
      setLoading(false);
    } else if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      setLoading(false);
    } else if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      setLoading(false);
    } else if (!name) {
      setErrorMessage('Please enter your name');
      setLoading(false);
    } else if (!isValidName(name)) {
      setErrorMessage('Please enter a valid name');
      setLoading(false);
    } else if (!phone) {
      setErrorMessage('Please enter your phone number');
      setLoading(false);
    } else if (!isValidPhone(phone)) {
      setErrorMessage('Please enter a valid phone number');
      setLoading(false);
    } else if (!balance) {
      setErrorMessage('Please enter your balance');
      setLoading(false);
    } else if (!isValidBalance(balance)) {
      setErrorMessage('Please enter a valid balance');
      setLoading(false);
    } else {
      try {
        await register(email, password, name, phone, parseFloat(balance));
        setLoading(false);
      } catch (error) {
        setErrorMessage(error.message || 'Registration failed');
        setLoading(false);
      }
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{flex: 1, width: '100%'}}
      keyboardShouldPersistTaps="always">
      <View style={styles.container}>
        <Text style={styles.text}>Create an account</Text>
        {errorMessage && (
          <Text style={{color: 'red', marginBottom: 10}}>{errorMessage}</Text>
        )}
        <FormInput
          labelValue={name}
          onChangeText={setName}
          placeholderText="Name"
          iconType="user"
          autoCapitalize="words"
          autoCorrect={false}
        />
        <FormInput
          labelValue={email}
          onChangeText={setEmail}
          placeholderText="Email"
          iconType="mail"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FormInput
          labelValue={phone}
          onChangeText={setPhone}
          placeholderText="Phone"
          iconType="phone"
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FormInput
          labelValue={balance}
          onChangeText={setBalance}
          placeholderText="Balance"
          iconType="wallet"
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FormInput
          labelValue={password}
          onChangeText={setPassword}
          placeholderText="Password"
          iconType="lock"
          secureTextEntry={true}
        />
        <FormInput
          labelValue={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholderText="Confirm Password"
          iconType="lock"
          secureTextEntry={true}
        />
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#677CD2"
            style={styles.loader}
          />
        ) : (
          <FormButton buttonTitle="Sign Up" onPress={handleSignup} />
        )}
        <View style={styles.textPrivate}>
          <Text style={styles.color_textPrivate}>
            By registering, you confirm that you accept our{' '}
          </Text>
          <TouchableOpacity onPress={() => alert('Terms Clicked!')}>
            <Text style={[styles.color_textPrivate, {color: '#e88832'}]}>
              Terms of service
            </Text>
          </TouchableOpacity>
          <Text style={styles.color_textPrivate}> and </Text>
          <Text style={[styles.color_textPrivate, {color: '#e88832'}]}>
            Privacy Policy
          </Text>
        </View>
        <TouchableOpacity
          style={styles.forgotButton}
          onPress={() => navigation.navigate('Login')}>
          <Text style={styles.navButtonText}>
            Already have an account? Login here
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
};

export default SignupScreen;

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    flex: 1,
  },
  text: {
    fontFamily: 'Kufam-SemiBoldItalic',
    fontSize: 28,
    marginBottom: 10,
    color: '#333',
  },
  loader: {
    marginTop: 20,
  },
  navButton: {
    marginTop: 15,
  },
  forgotButton: {
    marginVertical: 10,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    fontFamily: 'Lato-Regular',
    marginBottom: 10,
  },
  textPrivate: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  color_textPrivate: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: 'Lato-Regular',
    color: 'grey',
  },
});
