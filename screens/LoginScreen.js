import React, {useContext, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Platform,
  StyleSheet,
  ScrollView,
} from 'react-native';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import SocialButton from '../components/SocialButton';
import {AuthContext} from '../navigation/AuthProvider';

const LoginScreen = ({navigation}) => {
  const [email, setEmail] = useState();
  const [password, setPassword] = useState();
  const [errorMessage, setErrorMessage] = useState(null);

  const {login, googleLogin} = useContext(AuthContext);

  const isValidEmail = email => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const isValidPassword = password => {
    const re = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{6,}$/;
    return re.test(password);
  };

  const handleSignIn = () => {
    if (!email) {
      setErrorMessage('Please enter an email address');
      // return;
    }
    else if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      // return;
    }
    else if (!password) {
      setErrorMessage('Please enter a password');
      // return;
    }
    // else if (!isValidPassword(password)) {
    //   setErrorMessage('Password must be at least 6 characters, and contain at least one uppercase letter, one lowercase letter, and one number');
    //   // return;
    // }
    else {
      login(email, password);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={require('../assets/Tracka.png')} style={styles.logo} />
      {/* <Text style={styles.text}>Vritti</Text> */}
      {errorMessage && <Text style={{color: 'red', marginBottom: 10}}>{errorMessage}</Text>}

      <FormInput
        labelValue={email}
        onChangeText={userEmail => setEmail(userEmail)}
        placeholderText="Email"
        iconType="user"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <FormInput
        labelValue={password}
        onChangeText={userPassword => setPassword(userPassword)}
        placeholderText="Password"
        iconType="lock"
        secureTextEntry={true}
      />

      <FormButton
        buttonTitle="Sign In"
        onPress={() => {
          handleSignIn();
        }}
      />

      <TouchableOpacity
        style={styles.forgotButton}
        onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.navButtonText}>Forgot Password?</Text>
      </TouchableOpacity>

      <SocialButton
            buttonTitle="Sign In with Google"
            btnType="google"
            color="#fff"
            backgroundColor="#5CB85C"
            onPress={() => googleLogin()}
          />

      <TouchableOpacity
        style={styles.forgotButton}
        onPress={() => navigation.navigate('Signup')}>
        <Text style={styles.navButtonText}>
          Don't have an acount? Create here
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingTop: 0,
    // paddingBottom: 130,
    flex: 1,
  },
  logo: {
    height: 250,
    width: 250,
    resizeMode: 'cover',
    marginBottom: 10,
    // marginTop: 20,
  },
  text: {
    fontFamily: 'Kufam-SemiBoldItalic',
    fontSize: 28,
    // marginBottom: 10,
    color: '#333',
  },
  navButton: {
    marginTop: 15,
  },
  forgotButton: {
    marginVertical: 25,
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    fontFamily: 'Lato-Regular',
  },
  forgotButton: {
    marginVertical: 20,
    marginBottom: 10,
  },
});
