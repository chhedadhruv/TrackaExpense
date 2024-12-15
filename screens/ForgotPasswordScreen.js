import {View, Text, StyleSheet, ActivityIndicator} from 'react-native';
import React, {useState, useContext} from 'react';
import FormInput from '../components/FormInput';
import FormButton from '../components/FormButton';
import {AuthContext} from '../navigation/AuthProvider';

const ForgotPasswordScreen = ({navigation}) => {
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const {forgotPassword} = useContext(AuthContext);

  const isValidEmail = email => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const handleForgotPassword = async () => {
    setErrorMessage(null);

    if (!email) {
      setErrorMessage('Please enter an email address');
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      await forgotPassword(email);
      navigation.navigate('Login');
    } catch (error) {
      // Display an error message if the reset password process fails
      setErrorMessage('Error resetting password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Forgot Password?</Text>
      <Text style={styles.text}>
        Enter your email address below to reset your password
      </Text>
      {errorMessage && (
        <Text style={{color: 'red', marginBottom: 10}}>{errorMessage}</Text>
      )}
      <FormInput
        labelValue={email}
        onChangeText={userEmail => setEmail(userEmail)}
        placeholderText="Email"
        iconType="user"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FormButton buttonTitle="Reset Password" onPress={handleForgotPassword} />
      {isLoading && (
        <ActivityIndicator
          style={styles.activityIndicator}
          size="large"
          color="#0000ff"
        />
      )}
    </View>
  );
};

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    fontSize: 20,
    color: '#333333',
  },
  activityIndicator: {
    marginTop: 20,
  },
});
