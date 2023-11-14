import React, {useContext, useState} from 'react';
import {View, ScrollView, KeyboardAvoidingView, Text, TouchableOpacity,TextInput, Platform, StyleSheet, Button} from 'react-native';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import SocialButton from '../components/SocialButton';
import {AuthContext} from '../navigation/AuthProvider';
import DropDownPicker from 'react-native-dropdown-picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const SignupScreen = ({navigation, labelValue, placeholderText, iconType, ...rest}) => {
  const [email, setEmail] = useState();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState();
  const [age, setAge] = useState();
  const [gender, setGender] = useState();
  const [name, setName] = useState();
  const [balance, setBalance] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const {register, googleLogin } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(null);
  const [items, setItems] = useState([
    {label: 'Male', value: 'male'},
    {label: 'Female', value: 'female'},
    {label: 'Other', value: 'other'}
  ]);

  const isValidEmail = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  }

  const isValidAge = (age) => {
    const re = /^\d{1,2}$/;
    return re.test(age);
  }

  const isValidName = (name) => {
    const re = /^[a-zA-Z]+(?:[\s-][a-zA-Z]+)*$/;
    return re.test(name);
  }

  const isValidPassword = (password) => {
    const re = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{6,}$/;
    return re.test(password);
  }

  const isValidBalance = (balance) => {
    const re = /^\d{1,}$/;
    return re.test(balance);
  }

  const handleSignup = () => {
    if (!email) {
      setErrorMessage('Please enter an email address');
    }
    else if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
    }
    else if (!password) {
      setErrorMessage('Please enter a password');
    }
    // else if (!isValidPassword(password)) {
    //   setErrorMessage('Password must be at least 6 characters, and contain at least one uppercase letter, one lowercase letter, and one number');
    // }
    else if (!confirmPassword) {
      setErrorMessage('Please confirm your password');
    }
    else if (!isValidAge(age)) {
      setErrorMessage('Please enter a valid age');
    }
    else if (!name) {
      setErrorMessage('Please enter your name');
    }
    else if (!balance) {
      setErrorMessage('Please enter your balance');
    }
    else if (!isValidBalance(balance)) {
      setErrorMessage('Please enter a valid balance');
    }
    else if (!isValidName(name)) {
      setErrorMessage('Please enter a valid name');
    }
    else if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
    }
    else if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
    }
    else {
      register(email, password, name, balance);
    }
  }

  return (
    // <View style={styles.container}>
    //     <Text style={styles.text}>Create an account</Text>
    //     {errorMessage && <Text style={{color: 'red', marginBottom: 10}}>{errorMessage}</Text>}
    //     <FormInput
    //       labelValue={name}
    //       onChangeText={(userName) => setName(userName)}
    //       placeholderText="Name"
    //       iconType="user"
    //       autoCapitalize="words"
    //       autoCorrect={false}
    //     />
    //     <FormInput
    //       labelValue={email}
    //       onChangeText={(userEmail) => setEmail(userEmail)}
    //       placeholderText="Email"
    //       iconType="mail"
    //       keyboardType="email-address"
    //       autoCapitalize="none"
    //       autoCorrect={false}
    //     />
    //     <FormInput
    //       labelValue={age}
    //       onChangeText={(userAge) => setAge(userAge)}
    //       placeholderText="Age"
    //       iconType="calendar"
    //       keyboardType="numeric"
    //       autoCapitalize="none"
    //       autoCorrect={false}
    //     />
    //     <DropDownPicker
    //       open={open}
    //       value={value}
    //       items={items}
    //       setOpen={setOpen}
    //       setValue={setValue}
    //       setItems={setItems}
    //       placeholder={'Select Gender'}
    //       onChangeValue={(value) => setGender(value)}
    //     />
    //     <FormInput
    //       labelValue={password}
    //       onChangeText={(userPassword) => setPassword(userPassword)}
    //       placeholderText="Password"
    //       iconType="lock"
    //       secureTextEntry={true}
    //     />
    //     <FormInput
    //       labelValue={confirmPassword}
    //       onChangeText={(userConfirmPassword) => setConfirmPassword(userConfirmPassword)}
    //       placeholderText="Confirm Password"
    //       iconType="lock"
    //       secureTextEntry={true}
    //     />
    //     <FormButton
    //       buttonTitle="Sign Up"
    //       onPress={() => {
    //         handleSignup();
    //       }}
    //     />
    //     <View style={styles.textPrivate}>
    //     <Text style={styles.color_textPrivate}>
    //       By registering, you confirm that you accept our{' '}
    //     </Text>
    //     <TouchableOpacity onPress={() => alert('Terms Clicked!')}>
    //       <Text style={[styles.color_textPrivate, {color: '#e88832'}]}>
    //         Terms of service
    //       </Text>
    //     </TouchableOpacity>
    //     <Text style={styles.color_textPrivate}> and </Text>
    //     <Text style={[styles.color_textPrivate, {color: '#e88832'}]}>
    //       Privacy Policy
    //     </Text>
    //   </View>
    //     <TouchableOpacity
    //       style={styles.forgotButton}
    //       onPress={() => navigation.navigate('Login')}>
    //       <Text style={styles.navButtonText}>
    //         Already have an account? Login here
    //       </Text>
    //     </TouchableOpacity>
    //     <SocialButton
    //       buttonTitle="Sign Up with Google"
    //       btnType="google"
    //       color="#fff"
    //       backgroundColor="#5CB85C"
    //       onPress={() => googleLogin()}
    //     />
    // </View>

    <KeyboardAwareScrollView style={{flex: 1, width: '100%'}} keyboardShouldPersistTaps="always">
      <View style={styles.container}>
        <Text style={styles.text}>Create an account</Text>
        {errorMessage && <Text style={{color: 'red', marginBottom: 10}}>{errorMessage}</Text>}
        <FormInput
          labelValue={name}
          onChangeText={(userName) => setName(userName)}
          placeholderText="Name"
          iconType="user"
          autoCapitalize="words"
          autoCorrect={false}
        />
        <FormInput
          labelValue={email}
          onChangeText={(userEmail) => setEmail(userEmail)}
          placeholderText="Email"
          iconType="mail"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FormInput
          labelValue={balance}
          onChangeText={(userBalance) => setBalance(userBalance)}
          placeholderText="Balance"
          iconType="wallet"
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FormInput
          labelValue={password}
          onChangeText={(userPassword) => setPassword(userPassword)}
          placeholderText="Password"
          iconType="lock"
          secureTextEntry={true}
        />
        <FormInput
          labelValue={confirmPassword}
          onChangeText={(userConfirmPassword) => setConfirmPassword(userConfirmPassword)}
          placeholderText="Confirm Password"
          iconType="lock"
          secureTextEntry={true}
        />
        <FormButton
          buttonTitle="Sign Up"
          onPress={() => {
            handleSignup();
          }}
        />
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
        <SocialButton
          buttonTitle="Sign Up with Google"
          btnType="google"
          color="#fff"
          backgroundColor="#5CB85C"
          onPress={() => googleLogin()}
        />
    </View>
    </KeyboardAwareScrollView>
  );
};

export default SignupScreen;

const styles = StyleSheet.create({
  container: {
    // backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    // paddingTop: 20,
    flex: 1,
  },
  text: {
    fontFamily: 'Kufam-SemiBoldItalic',
    fontSize: 28,
    marginBottom: 10,
    color: '#333',
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
