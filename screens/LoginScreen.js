import React, {useContext, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import {AuthContext} from '../navigation/AuthProvider';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

const LoginScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const {login} = useContext(AuthContext);

  const isValidEmail = email => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const isValidPassword = password => {
    const re =
      /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])[0-9a-zA-Z!@#$%^&*]{6,}$/;
    return re.test(password);
  };

  const handleSignIn = async () => {
    setErrorMessage(null);
    if (!email) {
      setErrorMessage('Please enter an email address');
    } else if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
    } else if (!password) {
      setErrorMessage('Please enter a password');
    } else if (!isValidPassword(password)) {
      setErrorMessage(
        'Password must contain at least 6 characters, one number, one uppercase letter, and one lowercase letter.',
      );
    } else {
      setLoading(true);
      try {
        await login(email, password);
      } catch (error) {
        setErrorMessage(
          'Login failed. Please check your credentials or try again later.',
        );
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{flex: 1, width: '100%'}}
      keyboardShouldPersistTaps="always">
      <View style={styles.container}>
        <Image source={require('../assets/Tracka.png')} style={styles.logo} />
        {errorMessage && (
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        )}

        <FormInput
          labelValue={email}
          onChangeText={setEmail}
          placeholderText="Email"
          iconType="user"
          keyboardType="email-address"
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

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#677CD2"
            style={styles.loadingIndicator}
          />
        ) : (
          <FormButton buttonTitle="Sign In" onPress={handleSignIn} />
        )}

        <TouchableOpacity
          style={styles.forgotButton}
          onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={styles.navButtonText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.forgotButton}
          onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.navButtonText}>
            Don't have an account? Create one here
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logo: {
    height: 250,
    width: 250,
    resizeMode: 'cover',
    marginBottom: 10,
    marginTop: 20,
  },
  errorMessage: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 16,
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  forgotButton: {
    marginVertical: 20,
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    fontFamily: 'Lato-Regular',
  },
});

export default LoginScreen;
